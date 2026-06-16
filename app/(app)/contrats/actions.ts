"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createSignatureRequest } from "@/app/(app)/signatures/actions";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/file-storage";
import {
  buildSignaturePaymentPlan,
  centsToChf,
  chfToCents,
  computeAssietteCommissionContrat,
  computeCommissionSignature,
  computeValeurAn1,
  addMonthsKeepEndOfMonth,
} from "@/lib/commissions";
import {
  PREFIX_CONTRAT,
  PREFIX_FACTURE_CLIENT,
  FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT,
} from "@/lib/constants";
import {
  ContractCreateSchema,
  ResilierContractSchema,
} from "@/lib/schemas/contract";
import { ForbiddenError, requireUser } from "@/lib/session";

export interface ContractActionResult {
  ok: boolean;
  contractId?: string;
  numero?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Calcule le prix unitaire EFFECTIF d'une ligne après application de "offert"
 * ou d'une remise (par ligne).
 *  - offert        → 0 (unique = gratuit ; récurrent = gratuit sur la durée du
 *                    contrat, puis payant au renouvellement géré ailleurs).
 *  - POURCENT      → applique le % sur le one-shot ET le mensuel.
 *  - MONTANT fixe  → soustrait du one-shot s'il existe, sinon du mensuel.
 */
function effectiveUnitPrices(
  baseOneShot: number,
  baseMensuel: number,
  line: {
    offert?: boolean;
    remiseType?: "POURCENT" | "MONTANT";
    remiseValeur?: number;
  },
): { oneShot: number; mensuel: number } {
  if (line.offert) return { oneShot: 0, mensuel: 0 };
  const r = line.remiseValeur ?? 0;
  if (line.remiseType && r > 0) {
    if (line.remiseType === "POURCENT") {
      const f = Math.max(0, 1 - r / 100);
      return { oneShot: baseOneShot * f, mensuel: baseMensuel * f };
    }
    if (baseOneShot > 0) {
      return { oneShot: Math.max(0, baseOneShot - r), mensuel: baseMensuel };
    }
    return { oneShot: baseOneShot, mensuel: Math.max(0, baseMensuel - r) };
  }
  return { oneShot: baseOneShot, mensuel: baseMensuel };
}

// ===========================================================================
// CREATE depuis un Deal — la cascade complète
// ===========================================================================
//
// En une seule transaction Prisma :
//   1. Calcul des montants (oneShot, mensuel, valeurAn1) à partir des lignes
//   2. Incrément du Counter "contract" pour l'année → numéro
//   3. Création du Contract + liaison m2m products
//   4. Update du Deal (stage SIGNE + closeReelLe) si dealId fourni
//   5. Update du Prospect (statut SIGNE)
//   6. Création de la Commission + 12 CommissionPayment (1 signature + 11
//      étalements) via computeCommissionSignature & buildSignaturePaymentPlan
//   7. Création des ClientInvoices selon modalitePaiement
//      + ClientInvoiceLines pour chaque produit
//   8. Incrément du Counter "client_invoice" pour chaque facture
//
// Si une étape échoue, tout est rollback.

export async function createContractFromDeal(
  input: unknown,
): Promise<ContractActionResult> {
  const user = await requireUser();
  const parsed = ContractCreateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  // RLS prospect + récup pays (pour défaut devise)
  const prospectForDevise = await prisma.prospect.findUnique({
    where: { id: parsed.data.prospectId },
    select: { assigneAId: true, pays: true, raisonSociale: true },
  });
  if (!prospectForDevise) {
    return { ok: false, error: "Prospect introuvable." };
  }
  if (user.role !== "ADMIN" && prospectForDevise.assigneAId !== user.id) {
    return { ok: false, error: "Tu n'as pas accès à ce prospect." };
  }
  // Devise : choix explicite du wizard, sinon auto selon le pays du client
  const paysLower = (prospectForDevise.pays ?? "").toLowerCase();
  const deviseDefault =
    parsed.data.devise ??
    (paysLower.includes("suisse") ||
    paysLower.includes("switzerland") ||
    paysLower.includes("schweiz") ||
    paysLower === "ch" ||
    paysLower === ""
      ? "CHF"
      : "EUR");

  // Charge le taux commission de la commerciale (le créateur)
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tauxCommissionSignature: true },
  });
  if (!userFull) {
    return { ok: false, error: "Utilisateur introuvable." };
  }
  const tauxCommission = Number(userFull.tauxCommissionSignature);

  // Charge tous les produits référencés (pour le nom + prix par défaut)
  const productIds = parsed.data.lines.map((l) => l.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  // Calcul des montants en cents (précision exacte)
  let oneShotCents = 0;
  let mensuelCents = 0;
  const linesEnriched = parsed.data.lines.map((line) => {
    const prod = productById.get(line.productId);
    if (!prod) {
      throw new Error(`Produit introuvable : ${line.productId}`);
    }
    // Prix d'ORIGINE (override saisi ou prix catalogue) — pour l'affichage
    // "prix barré" et la traçabilité.
    const baseOneShot =
      line.prixOneShot ?? (prod.prixOneShot ? Number(prod.prixOneShot) : 0);
    const baseMensuel =
      line.prixMensuel ?? (prod.prixMensuel ? Number(prod.prixMensuel) : 0);
    // Prix EFFECTIF après "offert" / remise (ce qui est réellement facturé).
    const eff = effectiveUnitPrices(baseOneShot, baseMensuel, line);
    const oneShotUnit = eff.oneShot;
    const mensuelUnit = eff.mensuel;
    const lineOneShot = chfToCents(oneShotUnit * line.quantite);
    const lineMensuel = chfToCents(mensuelUnit * line.quantite);
    oneShotCents += lineOneShot;
    mensuelCents += lineMensuel;
    const note = (line.note ?? "").trim();
    const nom = note ? `${prod.nom} — ${note}` : prod.nom;
    return {
      productId: line.productId,
      categorie: prod.categorie, // utilisé pour la règle commission ADS
      nom,
      quantite: line.quantite,
      oneShotUnit,
      mensuelUnit,
      baseOneShot,
      baseMensuel,
      offert: !!line.offert,
      remiseType: line.remiseType ?? null,
      remiseValeur: line.remiseValeur ?? 0,
      lineOneShot,
      lineMensuel,
    };
  });

  // Métadonnées par ligne (offert / remise / prix d'origine) → affichage PDF.
  const lignesMeta = linesEnriched.map((l) => ({
    productId: l.productId,
    prixOneShotOriginal: l.baseOneShot,
    prixMensuelOriginal: l.baseMensuel,
    offert: l.offert,
    remiseType: l.remiseType,
    remiseValeur: l.remiseValeur,
  }));

  // "valeurAn1" du contrat (colonne DB, affichage compta) = formule
  // historique an 1 standard, indépendante de la catégorie des produits.
  const valeurAn1Cents = computeValeurAn1({
    oneShotCents,
    mensuelCents,
  });

  // Assiette COMMISSION : règle hybride par ligne.
  //   - Ligne ADS (Google Ads / Meta Ads) → revenu réel sur la durée du
  //     contrat (× dureeMois sans cap). Cohérent avec engagement court
  //     typique (3 mois) et budget pub payé direct à Google/Meta.
  //   - Ligne non-ADS → assiette an 1 classique (× 12, cap renouvellement
  //     pour les contrats > 12 mois).
  const assietteCommissionCents = computeAssietteCommissionContrat(
    linesEnriched.map((l) => ({
      oneShotCents: l.lineOneShot,
      mensuelCents: l.lineMensuel,
      categorie: l.categorie,
    })),
    parsed.data.dureeMois,
  );

  const commission = computeCommissionSignature({
    valeurAn1Cents: assietteCommissionCents,
    taux: tauxCommission,
  });
  const plan = buildSignaturePaymentPlan({
    valeurAn1Cents: assietteCommissionCents,
    taux: tauxCommission,
    dateSignature: parsed.data.dateSignature,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ---- 1. Counter contract ----
      const annee = parsed.data.dateSignature.getFullYear();
      const counter = await tx.counter.upsert({
        where: { scope_year: { scope: "contract", year: annee } },
        create: { scope: "contract", year: annee, value: 1 },
        update: { value: { increment: 1 } },
      });
      const numero = `${PREFIX_CONTRAT}-${annee}-${String(counter.value).padStart(4, "0")}`;

      // ---- 1b. Présence pipeline ----
      // Tout contrat NAÎT dans le pipeline (vente en cours) puis gradue vers
      // l'espace Contrats une fois signé + validé. Si la création ne vient pas
      // déjà d'un deal, on crée l'affaire pipeline correspondante à l'étape
      // choisie (son « attribut »), reliée au contrat. Un seul objet côté
      // usage : un bouton, une carte qui avance, puis bascule dans Contrats.
      let pipelineDealId = parsed.data.dealId ?? null;
      if (!pipelineDealId) {
        const stage = parsed.data.stagePipeline ?? "PROPOSITION";
        const probaParStage: Record<string, number> = {
          DECOUVERTE: 10,
          PROPOSITION: 40,
          NEGOCIATION: 70,
        };
        const dealCree = await tx.deal.create({
          data: {
            prospectId: parsed.data.prospectId,
            assigneAId: user.id,
            titre: `Contrat — ${prospectForDevise.raisonSociale}`,
            montantPrevu: centsToChf(valeurAn1Cents),
            stage,
            probabilite: probaParStage[stage] ?? 40,
            productsProposes: {
              connect: linesEnriched.map((l) => ({ id: l.productId })),
            },
          },
          select: { id: true },
        });
        pipelineDealId = dealCree.id;
      }

      // ---- 2. Création du Contract ----
      const contract = await tx.contract.create({
        data: {
          numero,
          prospectId: parsed.data.prospectId,
          dealId: pipelineDealId,
          assigneAId: user.id,
          dateSignature: parsed.data.dateSignature,
          dateDebut: parsed.data.dateDebut,
          dureeMois: parsed.data.dureeMois,
          modalitePaiement: parsed.data.modalitePaiement,
          devise: deviseDefault,
          montantOneShot: centsToChf(oneShotCents),
          montantMensuel: centsToChf(mensuelCents),
          valeurAn1: centsToChf(valeurAn1Cents),
          lignesMeta,
          // Workflow : contrat naît en attente de signature client.
          // → ATTENTE_VALIDATION_ADMIN après signByClient
          // → ACTIF après validateContract (admin uniquement)
          statut: "ATTENTE_SIGNATURE_CLIENT",
          products: {
            connect: linesEnriched.map((l) => ({ id: l.productId })),
          },
        },
      });

      // ---- 2b. Prix sur-mesure par ligne ----
      // On persiste le prix saisi sur le produit CUSTOM (description
      // "[Custom]", créé pour ce contrat) pour que le PDF affiche exactement
      // le prix configuré ligne par ligne. Jamais sur le catalogue partagé.
      for (const l of linesEnriched) {
        const prod = productById.get(l.productId);
        if (!prod?.description?.startsWith("[Custom]")) continue;
        const curOneShot =
          prod.prixOneShot != null ? Number(prod.prixOneShot) : 0;
        const curMensuel =
          prod.prixMensuel != null ? Number(prod.prixMensuel) : 0;
        if (curOneShot !== l.oneShotUnit || curMensuel !== l.mensuelUnit) {
          await tx.product.update({
            where: { id: l.productId },
            data: {
              prixOneShot: l.oneShotUnit > 0 ? l.oneShotUnit.toString() : null,
              prixMensuel: l.mensuelUnit > 0 ? l.mensuelUnit.toString() : null,
            },
          });
        }
      }

      // ---- 3. Deal / Prospect : pas de changement de statut à ce stade ----
      // Le contrat existe mais n'est pas encore signé par le client.
      // Le passage du deal en SIGNE et du prospect en SIGNE se fera dans
      // signByClient() au moment où le client appose effectivement sa
      // signature manuscrite (cf. app/(app)/signatures/actions.ts).
      //
      // Conséquence : tant que le client n'a pas signé, le deal reste
      // visible dans sa colonne d'origine (typiquement NEGOCIATION) avec
      // le badge "📝 Contrat prêt — en attente signature client", et le
      // prospect reste dans la liste /prospects.

      // ---- 5. Commission + 12 versements ----
      const commissionRecord = await tx.commission.create({
        data: {
          contractId: contract.id,
          userId: user.id,
          montantTotal: centsToChf(commission.totalCents),
          montantPart1: centsToChf(commission.partSignatureCents),
          montantPart2: centsToChf(commission.totalEtalementsCents),
          statut: "DUE",
        },
      });

      for (const item of plan) {
        await tx.commissionPayment.create({
          data: {
            commissionId: commissionRecord.id,
            typePart: item.typePart,
            numeroMois: item.numeroMois ?? null,
            montant: centsToChf(item.montantCents),
            dateVersementPrevue: item.dateVersementPrevue,
            statut: "PREVU",
          },
        });
      }

      // ---- 6. ClientInvoices selon modalité ----
      const invoicesData = buildClientInvoicesForContract({
        modalite: parsed.data.modalitePaiement,
        dateSignature: parsed.data.dateSignature,
        dateDebut: parsed.data.dateDebut,
        dureeMois: parsed.data.dureeMois,
        oneShotCents,
        mensuelCents,
        lines: linesEnriched,
      });

      for (const inv of invoicesData) {
        const cAnnee = inv.dateEmission.getFullYear();
        const cCounter = await tx.counter.upsert({
          where: { scope_year: { scope: "client_invoice", year: cAnnee } },
          create: { scope: "client_invoice", year: cAnnee, value: 1 },
          update: { value: { increment: 1 } },
        });
        const facNumero = `${PREFIX_FACTURE_CLIENT}-${cAnnee}-${String(cCounter.value).padStart(4, "0")}`;

        await tx.clientInvoice.create({
          data: {
            contractId: contract.id,
            numero: facNumero,
            dateEmission: inv.dateEmission,
            dateEcheance: inv.dateEcheance,
            type: inv.type,
            periodeMoisDebut: inv.periodeMoisDebut ?? null,
            periodeMoisFin: inv.periodeMoisFin ?? null,
            devise: deviseDefault,
            sousTotal: centsToChf(inv.sousTotalCents),
            totalTVA: 0,
            total: centsToChf(inv.sousTotalCents),
            statut: "BROUILLON",
            lignes: {
              create: inv.lines.map((l, idx) => ({
                designation: l.designation,
                quantite: l.quantite,
                prixUnitaire: l.prixUnitaire,
                montantHT: l.montantHT,
                tauxTVA: 0,
                ordre: idx,
                productId: l.productId ?? null,
              })),
            },
          },
        });
      }

      return { contractId: contract.id, numero };
    }, { timeout: 30_000 });

    revalidatePath("/contrats");
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${parsed.data.prospectId}`);

    return {
      ok: true,
      contractId: result.contractId,
      numero: result.numero,
    };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// UPDATE d'un contrat NON SIGNÉ — rejoue la cascade
// ===========================================================================
//
// Mêmes calculs que createContractFromDeal, mais sur un contrat existant :
//   - met à jour montants + modalité + dates + liaison m2m produits
//   - SUPPRIME puis recrée commission + 12 versements (tous PREVU)
//   - SUPPRIME puis recrée les ClientInvoices brouillon
//
// Garde-fous : interdit si le client a déjà signé OU si une facture est
// déjà payée (dans ces cas, il faut résilier puis refaire).
export async function updateContract(
  contractId: string,
  input: unknown,
): Promise<ContractActionResult> {
  const user = await requireUser();
  const parsed = ContractCreateSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  try {
    const existing = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        assigneAId: true,
        devise: true,
        numero: true,
        signatures: { select: { signeParClient: true } },
        clientInvoices: {
          select: { statut: true, payments: { select: { id: true } } },
        },
        commissions: { select: { id: true } },
      },
    });
    if (!existing) return { ok: false, error: "Contrat introuvable." };
    if (user.role !== "ADMIN" && existing.assigneAId !== user.id) {
      return { ok: false, error: "Accès refusé." };
    }
    if (existing.signatures.some((s) => s.signeParClient)) {
      return {
        ok: false,
        error:
          "Contrat déjà signé par le client — modification impossible. Utilise 'Résilier' puis refais un contrat.",
      };
    }
    if (
      existing.clientInvoices.some(
        (inv) => inv.statut === "PAYEE" || inv.payments.length > 0,
      )
    ) {
      return {
        ok: false,
        error: "Au moins une facture est déjà payée — modification impossible.",
      };
    }

    // Taux commission de l'utilisateur courant (créateur/éditeur)
    const userFull = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tauxCommissionSignature: true },
    });
    if (!userFull) return { ok: false, error: "Utilisateur introuvable." };
    const tauxCommission = Number(userFull.tauxCommissionSignature);

    // Charge les produits référencés
    const productIds = parsed.data.lines.map((l) => l.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { _count: { select: { contracts: true } } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    let oneShotCents = 0;
    let mensuelCents = 0;
    const linesEnriched = parsed.data.lines.map((line) => {
      const prod = productById.get(line.productId);
      if (!prod) throw new Error(`Produit introuvable : ${line.productId}`);
      const baseOneShot =
        line.prixOneShot ?? (prod.prixOneShot ? Number(prod.prixOneShot) : 0);
      const baseMensuel =
        line.prixMensuel ?? (prod.prixMensuel ? Number(prod.prixMensuel) : 0);
      const eff = effectiveUnitPrices(baseOneShot, baseMensuel, line);
      const oneShotUnit = eff.oneShot;
      const mensuelUnit = eff.mensuel;
      const lineOneShot = chfToCents(oneShotUnit * line.quantite);
      const lineMensuel = chfToCents(mensuelUnit * line.quantite);
      oneShotCents += lineOneShot;
      mensuelCents += lineMensuel;
      const note = (line.note ?? "").trim();
      const nom = note ? `${prod.nom} — ${note}` : prod.nom;
      return {
        productId: line.productId,
        categorie: prod.categorie,
        nom,
        quantite: line.quantite,
        oneShotUnit,
        mensuelUnit,
        baseOneShot,
        baseMensuel,
        offert: !!line.offert,
        remiseType: line.remiseType ?? null,
        remiseValeur: line.remiseValeur ?? 0,
        lineOneShot,
        lineMensuel,
      };
    });

    const lignesMeta = linesEnriched.map((l) => ({
      productId: l.productId,
      prixOneShotOriginal: l.baseOneShot,
      prixMensuelOriginal: l.baseMensuel,
      offert: l.offert,
      remiseType: l.remiseType,
      remiseValeur: l.remiseValeur,
    }));

    const valeurAn1Cents = computeValeurAn1({ oneShotCents, mensuelCents });
    const assietteCommissionCents = computeAssietteCommissionContrat(
      linesEnriched.map((l) => ({
        oneShotCents: l.lineOneShot,
        mensuelCents: l.lineMensuel,
        categorie: l.categorie,
      })),
      parsed.data.dureeMois,
    );
    const commission = computeCommissionSignature({
      valeurAn1Cents: assietteCommissionCents,
      taux: tauxCommission,
    });
    const plan = buildSignaturePaymentPlan({
      valeurAn1Cents: assietteCommissionCents,
      taux: tauxCommission,
      dateSignature: parsed.data.dateSignature,
    });
    const invoicesData = buildClientInvoicesForContract({
      modalite: parsed.data.modalitePaiement,
      dateSignature: parsed.data.dateSignature,
      dateDebut: parsed.data.dateDebut,
      dureeMois: parsed.data.dureeMois,
      oneShotCents,
      mensuelCents,
      lines: linesEnriched,
    });

    await prisma.$transaction(
      async (tx) => {
        // 1. Contrat : montants + paramètres + liaison produits (remplace tout)
        await tx.contract.update({
          where: { id: contractId },
          data: {
            dateSignature: parsed.data.dateSignature,
            dateDebut: parsed.data.dateDebut,
            dureeMois: parsed.data.dureeMois,
            modalitePaiement: parsed.data.modalitePaiement,
            devise: parsed.data.devise ?? existing.devise,
            montantOneShot: centsToChf(oneShotCents),
            montantMensuel: centsToChf(mensuelCents),
            valeurAn1: centsToChf(valeurAn1Cents),
            lignesMeta,
            products: {
              set: linesEnriched.map((l) => ({ id: l.productId })),
            },
          },
        });

        // 1b. Prix sur-mesure par ligne : on persiste le prix saisi sur le
        // produit afin que le PDF affiche exactement le prix configuré ligne
        // par ligne. On le fait SI le produit est "[Custom]" OU s'il n'est
        // utilisé que par ce contrat (contracts === 1) — jamais un produit du
        // catalogue partagé par plusieurs contrats.
        for (const l of linesEnriched) {
          const prod = productById.get(l.productId);
          const isCustom = prod?.description?.startsWith("[Custom]") ?? false;
          const singleUse = prod?._count?.contracts === 1;
          if (!prod || (!isCustom && !singleUse)) continue;
          const curOneShot =
            prod.prixOneShot != null ? Number(prod.prixOneShot) : 0;
          const curMensuel =
            prod.prixMensuel != null ? Number(prod.prixMensuel) : 0;
          if (curOneShot !== l.oneShotUnit || curMensuel !== l.mensuelUnit) {
            await tx.product.update({
              where: { id: l.productId },
              data: {
                prixOneShot: l.oneShotUnit > 0 ? l.oneShotUnit.toString() : null,
                prixMensuel: l.mensuelUnit > 0 ? l.mensuelUnit.toString() : null,
              },
            });
          }
        }

        // 2. Commission + versements : suppression puis recréation
        await tx.commission.deleteMany({ where: { contractId } });
        const commissionRecord = await tx.commission.create({
          data: {
            contractId,
            userId: user.id,
            montantTotal: centsToChf(commission.totalCents),
            montantPart1: centsToChf(commission.partSignatureCents),
            montantPart2: centsToChf(commission.totalEtalementsCents),
            statut: "DUE",
          },
        });
        for (const item of plan) {
          await tx.commissionPayment.create({
            data: {
              commissionId: commissionRecord.id,
              typePart: item.typePart,
              numeroMois: item.numeroMois,
              montant: centsToChf(item.montantCents),
              dateVersementPrevue: item.dateVersementPrevue,
              statut: "PREVU",
            },
          });
        }

        // 3. Factures brouillon : suppression puis régénération
        await tx.clientInvoice.deleteMany({ where: { contractId } });
        for (const inv of invoicesData) {
          const cAnnee = inv.dateEmission.getFullYear();
          const cCounter = await tx.counter.upsert({
            where: { scope_year: { scope: "client_invoice", year: cAnnee } },
            create: { scope: "client_invoice", year: cAnnee, value: 1 },
            update: { value: { increment: 1 } },
          });
          const facNumero = `${PREFIX_FACTURE_CLIENT}-${cAnnee}-${String(cCounter.value).padStart(4, "0")}`;
          await tx.clientInvoice.create({
            data: {
              contractId,
              numero: facNumero,
              dateEmission: inv.dateEmission,
              dateEcheance: inv.dateEcheance,
              type: inv.type,
              periodeMoisDebut: inv.periodeMoisDebut ?? null,
              periodeMoisFin: inv.periodeMoisFin ?? null,
              devise: parsed.data.devise ?? existing.devise,
              sousTotal: centsToChf(inv.sousTotalCents),
              totalTVA: 0,
              total: centsToChf(inv.sousTotalCents),
              statut: "BROUILLON",
              lignes: {
                create: inv.lines.map((l, idx) => ({
                  designation: l.designation,
                  quantite: l.quantite,
                  prixUnitaire: l.prixUnitaire,
                  montantHT: l.montantHT,
                  tauxTVA: 0,
                  ordre: idx,
                  productId: l.productId ?? null,
                })),
              },
            },
          });
        }
      },
      { timeout: 30_000 },
    );

    revalidatePath("/contrats");
    revalidatePath(`/contrats/${contractId}`);
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${parsed.data.prospectId}`);

    return { ok: true, contractId, numero: existing.numero };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// ===========================================================================
// RÉSILIER un contrat
// ===========================================================================

export async function resilierContract(
  input: unknown,
): Promise<ContractActionResult> {
  const user = await requireUser();
  const parsed = ResilierContractSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  // RLS
  const c = await prisma.contract.findUnique({
    where: { id: parsed.data.contractId },
    select: { assigneAId: true, statut: true },
  });
  if (!c) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && c.assigneAId !== user.id) {
    return { ok: false, error: "Ce contrat ne t'appartient pas." };
  }
  if (c.statut !== "ACTIF") {
    return { ok: false, error: `Statut actuel : ${c.statut}.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update contract
      await tx.contract.update({
        where: { id: parsed.data.contractId },
        data: {
          statut: "RESILIE",
          dateResiliation: parsed.data.dateResiliation,
          raisonResiliation: parsed.data.raison,
        },
      });
      // 2. Annule tous les CommissionPayment PREVU (étape 2 règle métier)
      const commissions = await tx.commission.findMany({
        where: { contractId: parsed.data.contractId },
        select: { id: true },
      });
      for (const com of commissions) {
        await tx.commissionPayment.updateMany({
          where: { commissionId: com.id, statut: "PREVU" },
          data: { statut: "ANNULE" },
        });
      }
    });

    revalidatePath("/contrats");
    revalidatePath(`/contrats/${parsed.data.contractId}`);
    return { ok: true, contractId: parsed.data.contractId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

// markPaymentEncaisse a été déplacé dans app/(app)/paiements/actions.ts
// (logique plus complète : marque aussi ClientInvoice PAYEE).

// ===========================================================================
// SIGNER UN DEAL EN RDV CLIENT (Sophie autonome)
// ===========================================================================
//
// Use-case : Sophie est en RDV face client, le client est OK pour signer.
// Elle clique "Signer en direct" sur le panneau du deal → l'action :
//   1. Crée le contrat à partir du deal (réutilise productsProposes, défauts
//      raisonnables pour modalité/durée/date)
//   2. Crée immédiatement une Signature avec token unique
//   3. Renvoie le token → l'UI ouvre /sign/{token} dans un nouvel onglet
//   4. Sophie tend la tablette au client
//
// Si un contrat existe déjà pour ce deal (signature interrompue, relance),
// on le réutilise au lieu d'en créer un nouveau.

const SignDealInPersonSchema = z.object({
  dealId: z.string().min(1),
  modalitePaiement: z
    .enum(["CINQUANTE_CINQUANTE", "CENT_AU_SIGNING", "MENSUEL"])
    .default("CINQUANTE_CINQUANTE"),
  dureeMois: z.coerce.number().int().min(1).max(60).default(12),
  dateDebut: z.coerce.date().optional(),
});

export interface SignDealInPersonResult {
  ok: boolean;
  contractId?: string;
  numero?: string;
  lienSignature?: string;
  error?: string;
}

export async function signDealInPerson(
  input: unknown,
): Promise<SignDealInPersonResult> {
  const user = await requireUser();
  const parsed = SignDealInPersonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Paramètres invalides." };
  }

  // Charge le deal avec son contexte
  const deal = await prisma.deal.findUnique({
    where: { id: parsed.data.dealId },
    include: {
      productsProposes: { select: { id: true } },
      contracts: {
        select: { id: true, numero: true },
        take: 1,
      },
    },
  });
  // productNotes est stocké en Json
  const dealNotes =
    (deal?.productNotes as Record<string, string> | null) ?? {};
  if (!deal) return { ok: false, error: "Deal introuvable." };
  if (user.role !== "ADMIN" && deal.assigneAId !== user.id) {
    return { ok: false, error: "Ce deal ne t'appartient pas." };
  }

  let contractId: string;
  let numero: string | undefined;

  // Cas 1 : un contrat existe déjà → on le réutilise (signature relancée)
  if (deal.contracts.length > 0) {
    contractId = deal.contracts[0].id;
    numero = deal.contracts[0].numero;
  } else {
    // Cas 2 : on crée le contrat depuis le deal
    if (deal.productsProposes.length === 0) {
      return {
        ok: false,
        error:
          "Le deal n'a aucun produit. Ajoute au moins un produit avant de signer.",
      };
    }
    const today = parsed.data.dateDebut ?? new Date();
    const res = await createContractFromDeal({
      prospectId: deal.prospectId,
      dealId: deal.id,
      dateSignature: today,
      dateDebut: today,
      dureeMois: parsed.data.dureeMois,
      modalitePaiement: parsed.data.modalitePaiement,
      lines: deal.productsProposes.map((p) => ({
        productId: p.id,
        quantite: 1,
        note: dealNotes[p.id] ?? undefined,
      })),
    });
    if (!res.ok || !res.contractId) {
      return {
        ok: false,
        error: res.error ?? "Échec de la création du contrat.",
      };
    }
    contractId = res.contractId;
    numero = res.numero;
  }

  // Crée (ou récupère) la signature et le token
  const sigRes = await createSignatureRequest(contractId);
  if (!sigRes.ok || !sigRes.lienSignature) {
    return {
      ok: false,
      contractId,
      numero,
      error: sigRes.error ?? "Échec de la création du lien de signature.",
    };
  }

  // TODO (étape mail) : envoyer à l'admin un récap "Sophie a déclenché une
  // signature RDV chez {prospect}" via lib/email.ts dès que Resend est câblé.
  console.log(
    `[signDealInPerson] ${user.name} déclenche une signature RDV deal=${deal.id} contract=${contractId}`,
  );

  revalidatePath("/pipeline");
  revalidatePath("/contrats");
  revalidatePath(`/contrats/${contractId}`);

  return {
    ok: true,
    contractId,
    numero,
    lienSignature: sigRes.lienSignature,
  };
}

// ===========================================================================
// ENVOYER LE LIEN DE SIGNATURE PAR EMAIL
// ===========================================================================
//
// Variante "à distance" de signDealInPerson : on prépare le contrat + le
// lien de signature et on envoie un mail au prospect. Le client clique sur
// le lien quand il veut, signe sur son téléphone/PC, on récupère tout.
//
// V1 : on enregistre l'Email en DB (table Email) et on log côté serveur.
// V2 : intégration Resend réelle (cf. /emails/actions.ts).

const SendSignatureByEmailSchema = z.object({
  dealId: z.string().min(1),
  modalitePaiement: z
    .enum(["CINQUANTE_CINQUANTE", "CENT_AU_SIGNING", "MENSUEL"])
    .default("CINQUANTE_CINQUANTE"),
  dureeMois: z.coerce.number().int().min(1).max(60).default(12),
  dateDebut: z.coerce.date().optional(),
});

export interface SendSignatureByEmailResult {
  ok: boolean;
  contractId?: string;
  numero?: string;
  lienSignature?: string;
  emailDest?: string;
  dryRun?: boolean;
  error?: string;
}

export async function sendSignatureByEmail(
  input: unknown,
): Promise<SendSignatureByEmailResult> {
  const user = await requireUser();
  const parsed = SendSignatureByEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  // Réutilise signDealInPerson pour créer contrat + signature
  const inPersonRes = await signDealInPerson(parsed.data);
  if (!inPersonRes.ok || !inPersonRes.lienSignature || !inPersonRes.contractId) {
    return { ok: false, error: inPersonRes.error ?? "Échec." };
  }

  // Charge le prospect pour avoir l'email
  const contract = await prisma.contract.findUnique({
    where: { id: inPersonRes.contractId },
    select: {
      numero: true,
      valeurAn1: true,
      prospect: {
        select: {
          id: true,
          email: true,
          raisonSociale: true,
          contactPrenom: true,
          contactNom: true,
        },
      },
    },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (!contract.prospect.email) {
    return {
      ok: false,
      error:
        "Pas d'email connu pour ce prospect. Ajoute-le sur sa fiche avant d'envoyer.",
    };
  }

  // Construction de l'email
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const signUrl = `${appUrl}/sign/${inPersonRes.lienSignature}`;
  const pdfUrl = `${appUrl}/api/contrats/${inPersonRes.contractId}/pdf?token=${inPersonRes.lienSignature}`;
  const greeting = contract.prospect.contactPrenom
    ? `Bonjour ${contract.prospect.contactPrenom},`
    : `Bonjour,`;
  const objet = `Votre contrat ${contract.numero} — Make Your Com`;
  const contenuTexte = [
    greeting,
    "",
    `Merci pour notre échange. Vous trouverez ci-joint le récapitulatif de votre contrat (${contract.numero}, valeur 12 mois : CHF ${Number(contract.valeurAn1).toLocaleString("fr-CH")}).`,
    "",
    "Pour le signer en ligne en 2 minutes :",
    signUrl,
    "",
    "Vous pouvez aussi télécharger le PDF du contrat ici :",
    pdfUrl,
    "",
    "Si vous préférez l'imprimer, le signer à la main et nous le renvoyer scanné, c'est tout à fait possible — répondez simplement à cet email avec le PDF signé.",
    "",
    "Bien cordialement,",
    user.name,
    "ACLR Sàrl — Make Your Com",
  ].join("\n");
  const contenuHtml = `
    <p>${greeting}</p>
    <p>Merci pour notre échange. Vous trouverez ci-joint le récapitulatif de votre contrat <strong>${contract.numero}</strong> (valeur 12 mois : CHF ${Number(contract.valeurAn1).toLocaleString("fr-CH")}).</p>
    <p><strong>Pour le signer en ligne en 2 minutes :</strong><br>
    <a href="${signUrl}" style="display:inline-block;background:#0E1936;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">Signer le contrat ✍</a></p>
    <p>Vous pouvez aussi <a href="${pdfUrl}">télécharger le PDF du contrat</a> pour le consulter, l'imprimer, le signer à la main et nous le renvoyer scanné par retour d'email.</p>
    <p>Bien cordialement,<br>
    ${user.name}<br>
    <em>ACLR Sàrl — Make Your Com</em></p>
  `;

  // Récupère l'email expéditeur
  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });

  const isDryRun = process.env.EMAIL_MODE !== "live";
  const { randomBytes } = await import("node:crypto");
  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@aclr.ch>`;
  const threadId = randomBytes(8).toString("hex");

  if (isDryRun) {
    console.log("📧 [DRY-RUN] Lien de signature envoyé", {
      to: contract.prospect.email,
      objet,
      signUrl,
    });
  } else {
    // V2 : appel Resend ici
    console.log("📧 [LIVE] Envoi Resend non implémenté en V1");
  }

  // Enregistre l'email
  await prisma.email.create({
    data: {
      prospectId: contract.prospect.id,
      userId: user.id,
      direction: "SORTANT",
      threadId,
      messageId,
      expediteurEmail: userFull?.email ?? "noreply@aclr.ch",
      expediteurNom: userFull?.name ?? "",
      destinataireEmail: contract.prospect.email,
      objet,
      contenuHtml,
      contenuTexte,
      statut: "ENVOYE",
      envoyeLe: new Date(),
      labels: ["signature"],
    },
  });

  // Activity
  await prisma.activity.create({
    data: {
      prospectId: contract.prospect.id,
      userId: user.id,
      type: "EMAIL_ENVOYE",
      date: new Date(),
      sujet: `Lien de signature contrat ${contract.numero}`,
      contenu: `Lien envoyé à ${contract.prospect.email}`,
      statut: "FAIT",
    },
  });

  revalidatePath(`/prospects/${contract.prospect.id}`);
  revalidatePath(`/contrats/${inPersonRes.contractId}`);

  return {
    ok: true,
    contractId: inPersonRes.contractId,
    numero: inPersonRes.numero,
    lienSignature: inPersonRes.lienSignature,
    emailDest: contract.prospect.email,
    dryRun: isDryRun,
  };
}

// ===========================================================================
// UPLOAD MANUEL DU CONTRAT SIGNÉ (PDF retourné par le client)
// ===========================================================================
//
// Workflow papier / signature manuscrite scannée :
//   1. Sophie envoie le PDF par mail au client
//   2. Le client imprime, signe à la main, scanne, renvoie le PDF signé
//   3. Sophie (ou Arthur) clique "Joindre le PDF signé" sur la page contrat
//   4. Le PDF est stocké, la signature passe en SIGNEE_CLIENT type=MANUEL,
//      et la cascade habituelle se déclenche (deal SIGNE, prospect SIGNE).

const UploadSignedContractSchema = z.object({
  contractId: z.string().min(1),
  /** Data URL base64 du contrat signé retourné par le client (PDF ou image
   *  scannée / photographiée, max ~5 MB). */
  fileDataUrl: z
    .string()
    .min(1)
    .refine(
      (v) =>
        v.startsWith("data:application/pdf") ||
        v.startsWith("data:image/jpeg") ||
        v.startsWith("data:image/jpg") ||
        v.startsWith("data:image/png") ||
        v.startsWith("data:image/webp"),
      { message: "Le fichier doit être un PDF ou une image (scan/photo)." },
    ),
  /** Nom du fichier d'origine (pour traçabilité). */
  fileName: z.string().trim().max(200).optional(),
  /** Nom du client signataire (audit légal). */
  nomClient: z.string().trim().min(2).max(200),
});

export interface UploadSignedContractResult {
  ok: boolean;
  signatureId?: string;
  error?: string;
}

export async function uploadSignedContract(
  input: unknown,
): Promise<UploadSignedContractResult> {
  const user = await requireUser();
  const parsed = UploadSignedContractSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
  }

  // Vérification d'accès au contrat
  const contract = await prisma.contract.findUnique({
    where: { id: parsed.data.contractId },
    select: {
      id: true,
      numero: true,
      assigneAId: true,
      dealId: true,
      prospectId: true,
    },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return { ok: false, error: "Pas d'accès à ce contrat." };
  }

  // Garde-fou taille : 5 MB max sur la data URL (~3.75 MB de PDF réel)
  if (parsed.data.fileDataUrl.length > 5_500_000) {
    return {
      ok: false,
      error: "PDF trop volumineux (max 4 MB).",
    };
  }

  // Décodage du base64 → upload via l'abstraction de stockage (local dev / Vercel Blob prod)
  const mime =
    parsed.data.fileDataUrl.match(/^data:([^;]+);base64,/)?.[1] ??
    "application/pdf";
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/jpeg" || mime === "image/jpg"
          ? "jpg"
          : "pdf";
  const base64 = parsed.data.fileDataUrl.split(",")[1] ?? "";
  if (!base64) return { ok: false, error: "Fichier illisible." };
  const buffer = Buffer.from(base64, "base64");

  const upload = await uploadFile({
    prefix: `signed-contracts/${contract.id}`,
    filename: `signed.${ext}`,
    buffer,
    contentType: mime,
  });
  const publicUrl = upload.url;

  // Trouve la signature existante ou en crée une nouvelle pour ce contrat
  const existingSig = await prisma.signature.findFirst({
    where: { contractId: contract.id, signeParClient: false },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const sigData = {
    type: "SIGNATURE_MANUELLE_PDF" as const,
    statut: "SIGNEE_CLIENT" as const,
    signeParClient: true,
    dateSignatureClient: now,
    nomClient: parsed.data.nomClient,
    documentSigneUrl: publicUrl,
  };

  let signatureId: string;
  await prisma.$transaction(async (tx) => {
    if (existingSig) {
      const updated = await tx.signature.update({
        where: { id: existingSig.id },
        data: sigData,
      });
      signatureId = updated.id;
    } else {
      const { randomBytes } = await import("node:crypto");
      const created = await tx.signature.create({
        data: {
          contractId: contract.id,
          ...sigData,
          // Champs requis pour une signature manuelle (pas de lien public)
          lienSignature: randomBytes(16).toString("base64url"),
          documentPdfUrl: `/api/contrats/${contract.id}/pdf`,
          expireA: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
        },
      });
      signatureId = created.id;
    }

    // Cascade : deal → SIGNE + prospect → SIGNE (idem signature digitale)
    if (contract.dealId) {
      await tx.deal.update({
        where: { id: contract.dealId },
        data: { stage: "SIGNE", probabilite: 100, closeReelLe: now },
      });
    }
    await tx.prospect.update({
      where: { id: contract.prospectId },
      data: { statut: "SIGNE" },
    });
  });

  revalidatePath("/pipeline");
  revalidatePath("/contrats");
  revalidatePath(`/contrats/${contract.id}`);
  revalidatePath("/signatures");

  return { ok: true, signatureId: signatureId! };
}

// ===========================================================================
// HELPERS
// ===========================================================================

interface InvoiceLineDraft {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  montantHT: number;
  productId: string | null;
}

interface InvoiceDraft {
  dateEmission: Date;
  dateEcheance: Date;
  type: "ACOMPTE" | "SOLDE" | "MENSUALITE" | "ANNUELLE" | "PONCTUELLE";
  periodeMoisDebut?: Date;
  periodeMoisFin?: Date;
  sousTotalCents: number;
  lines: InvoiceLineDraft[];
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Génère le planning des factures clients selon la modalité de paiement.
 */
function buildClientInvoicesForContract(params: {
  modalite: "CINQUANTE_CINQUANTE" | "CENT_AU_SIGNING" | "MENSUEL";
  dateSignature: Date;
  dateDebut: Date;
  dureeMois: number;
  oneShotCents: number;
  mensuelCents: number;
  lines: Array<{
    productId: string;
    nom: string;
    quantite: number;
    oneShotUnit: number;
    mensuelUnit: number;
    lineOneShot: number;
    lineMensuel: number;
  }>;
}): InvoiceDraft[] {
  const invoices: InvoiceDraft[] = [];
  const echeance = (from: Date) =>
    addDays(from, FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT);

  if (params.modalite === "CENT_AU_SIGNING") {
    const totalCents = params.oneShotCents + params.mensuelCents * 12;
    invoices.push({
      dateEmission: params.dateSignature,
      dateEcheance: echeance(params.dateSignature),
      type: "PONCTUELLE",
      sousTotalCents: totalCents,
      lines: params.lines
        .filter((l) => l.lineOneShot > 0 || l.lineMensuel > 0)
        .map((l) => ({
          designation: l.nom,
          quantite: l.quantite,
          prixUnitaire: l.oneShotUnit + l.mensuelUnit * 12,
          montantHT: centsToChf(l.lineOneShot + l.lineMensuel * 12),
          productId: l.productId,
        })),
    });
  } else if (params.modalite === "CINQUANTE_CINQUANTE") {
    // Acompte 50% du oneShot à la signature
    if (params.oneShotCents > 0) {
      const acompteCents = Math.round(params.oneShotCents / 2);
      const soldeCents = params.oneShotCents - acompteCents;
      invoices.push({
        dateEmission: params.dateSignature,
        dateEcheance: echeance(params.dateSignature),
        type: "ACOMPTE",
        sousTotalCents: acompteCents,
        lines: params.lines
          .filter((l) => l.lineOneShot > 0)
          .map((l) => ({
            designation: `${l.nom} — acompte 50%`,
            quantite: l.quantite,
            prixUnitaire: l.oneShotUnit / 2,
            montantHT: centsToChf(Math.round(l.lineOneShot / 2)),
            productId: l.productId,
          })),
      });
      // Solde 50% à la livraison (= dateDebut)
      invoices.push({
        dateEmission: params.dateDebut,
        dateEcheance: echeance(params.dateDebut),
        type: "SOLDE",
        sousTotalCents: soldeCents,
        lines: params.lines
          .filter((l) => l.lineOneShot > 0)
          .map((l) => ({
            designation: `${l.nom} — solde 50%`,
            quantite: l.quantite,
            prixUnitaire: l.oneShotUnit / 2,
            montantHT: centsToChf(l.lineOneShot - Math.round(l.lineOneShot / 2)),
            productId: l.productId,
          })),
      });
    }
    // Mensualités 12 mois
    if (params.mensuelCents > 0) {
      for (let i = 0; i < 12; i++) {
        const dateEmission = addMonthsKeepEndOfMonth(params.dateDebut, i);
        const periodeFin = new Date(dateEmission);
        periodeFin.setMonth(periodeFin.getMonth() + 1);
        periodeFin.setDate(periodeFin.getDate() - 1);
        invoices.push({
          dateEmission,
          dateEcheance: echeance(dateEmission),
          type: "MENSUALITE",
          periodeMoisDebut: dateEmission,
          periodeMoisFin: periodeFin,
          sousTotalCents: params.mensuelCents,
          lines: params.lines
            .filter((l) => l.lineMensuel > 0)
            .map((l) => ({
              designation: `${l.nom} — mensualité ${i + 1}/12`,
              quantite: l.quantite,
              prixUnitaire: l.mensuelUnit,
              montantHT: centsToChf(l.lineMensuel),
              productId: l.productId,
            })),
        });
      }
    }
  } else if (params.modalite === "MENSUEL") {
    // Tout en mensuel — LISSAGE :
    //   - oneShot étalé en 12 parts égales sur les 12 mois
    //   - mensuel récurrent ajouté à chaque mois
    //   - Mois 13+ (renouvellement) : SEUL le mensuel récurrent est dû
    //     (le setup est amorti sur l'année 1)
    //
    // Précision centimes : on calcule la part de setup par mois (entière)
    // et on attribue le reste (modulo 12) au DERNIER mois pour que la
    // somme des 12 factures égale exactement le total contrat.
    const setupParCents = Math.floor(params.oneShotCents / 12);
    const setupReste = params.oneShotCents - setupParCents * 12;
    // Par ligne, on calcule aussi la fraction mensuelle de setup
    const linesSetupParCents: Record<string, number> = {};
    const linesSetupReste: Record<string, number> = {};
    for (const l of params.lines) {
      const part = Math.floor(l.lineOneShot / 12);
      linesSetupParCents[l.productId ?? l.nom] = part;
      linesSetupReste[l.productId ?? l.nom] = l.lineOneShot - part * 12;
    }

    for (let i = 0; i < 12; i++) {
      const dateEmission = addMonthsKeepEndOfMonth(params.dateDebut, i);
      const periodeFin = new Date(dateEmission);
      periodeFin.setMonth(periodeFin.getMonth() + 1);
      periodeFin.setDate(periodeFin.getDate() - 1);

      const isLastMonth = i === 11;
      const lineMonth: InvoiceLineDraft[] = [];

      // Lignes mensuel récurrent
      for (const l of params.lines) {
        if (l.lineMensuel > 0) {
          lineMonth.push({
            designation: `${l.nom} — mensualité ${i + 1}/12`,
            quantite: l.quantite,
            prixUnitaire: l.mensuelUnit,
            montantHT: centsToChf(l.lineMensuel),
            productId: l.productId ?? null,
          });
        }
      }
      // Lignes setup amorti (1/12 de l'one-shot — uniquement année 1)
      for (const l of params.lines) {
        if (l.lineOneShot > 0) {
          const key = l.productId ?? l.nom;
          const partCents =
            linesSetupParCents[key] + (isLastMonth ? linesSetupReste[key] : 0);
          if (partCents > 0) {
            lineMonth.unshift({
              designation: `${l.nom} — setup amorti ${i + 1}/12`,
              quantite: 1,
              prixUnitaire: centsToChf(partCents),
              montantHT: centsToChf(partCents),
              productId: l.productId ?? null,
            });
          }
        }
      }

      const monthCents =
        params.mensuelCents +
        setupParCents +
        (isLastMonth ? setupReste : 0);

      invoices.push({
        dateEmission,
        dateEcheance: echeance(dateEmission),
        type: "MENSUALITE",
        periodeMoisDebut: dateEmission,
        periodeMoisFin: periodeFin,
        sousTotalCents: monthCents,
        lines: lineMonth,
      });
    }
  }

  return invoices;
}

function zodErrorToResult(err: import("zod").ZodError): ContractActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !fieldErrors[p]) fieldErrors[p] = issue.message;
  }
  return { ok: false, error: "Formulaire invalide.", fieldErrors };
}

/**
 * Supprime une facture client.
 * RLS : admin OR commercial assigné au contrat.
 * Bloqué si statut = PAYEE (préservation comptable) — utiliser un avoir
 * à la place. Si tu veux quand même supprimer une payée, utilise l'UI admin
 * directe via DB (volontairement absent du CRM).
 */
export async function deleteClientInvoice(
  invoiceId: string,
): Promise<ContractActionResult> {
  const user = await requireUser();
  try {
    const inv = await prisma.clientInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        statut: true,
        contractId: true,
        contract: { select: { assigneAId: true } },
        payments: { select: { id: true } },
      },
    });
    if (!inv) return { ok: false, error: "Facture introuvable." };
    if (user.role !== "ADMIN" && inv.contract.assigneAId !== user.id) {
      return { ok: false, error: "Accès refusé." };
    }
    if (inv.statut === "PAYEE" || inv.payments.length > 0) {
      return {
        ok: false,
        error:
          "Impossible de supprimer une facture payée. Créé un avoir si nécessaire.",
      };
    }
    await prisma.clientInvoice.delete({ where: { id: invoiceId } });
    revalidatePath("/factures-clients");
    revalidatePath(`/contrats/${inv.contractId}`);
    return { ok: true, contractId: inv.contractId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Supprime complètement un contrat (uniquement avant signature client).
 * Bloqué si le contrat est ACTIF / SUSPENDU / RESILIE / EXPIRE → utiliser
 * resilierContract() à la place.
 * RLS : admin OR commercial assigné.
 */
export async function deleteContract(
  contractId: string,
): Promise<ContractActionResult> {
  const user = await requireUser();
  try {
    const c = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        statut: true,
        assigneAId: true,
        prospectId: true,
        signatures: { select: { signeParClient: true } },
        clientInvoices: {
          select: { statut: true, payments: { select: { id: true } } },
        },
      },
    });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (user.role !== "ADMIN" && c.assigneAId !== user.id) {
      return { ok: false, error: "Accès refusé." };
    }
    // Bloque si signature client déjà apposée
    if (c.signatures.some((s) => s.signeParClient)) {
      return {
        ok: false,
        error:
          "Impossible de supprimer : contrat signé par le client. Utilise 'Résilier' à la place.",
      };
    }
    // Bloque si une facture est déjà PAYEE
    const hasPayedInvoice = c.clientInvoices.some(
      (inv) => inv.statut === "PAYEE" || inv.payments.length > 0,
    );
    if (hasPayedInvoice) {
      return {
        ok: false,
        error: "Impossible de supprimer : au moins une facture est payée.",
      };
    }
    // Suppression en cascade : signatures + factures brouillons
    await prisma.$transaction(async (tx) => {
      await tx.signature.deleteMany({ where: { contractId } });
      await tx.clientInvoice.deleteMany({ where: { contractId } });
      await tx.contract.delete({ where: { id: contractId } });
    });
    revalidatePath("/contrats");
    revalidatePath("/pipeline");
    revalidatePath(`/prospects/${c.prospectId}`);
    return { ok: true, contractId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Validation finale par l'admin : passe un contrat de
 * ATTENTE_VALIDATION_ADMIN à ACTIF.
 *
 * Le contrat doit avoir été signé par le client au préalable
 * (statut = ATTENTE_VALIDATION_ADMIN).
 *
 * Réservé aux ADMIN.
 */
export async function validateContract(
  contractId: string,
): Promise<ContractActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return {
      ok: false,
      error: "Seul l'admin peut valider un contrat.",
    };
  }
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { statut: true, numero: true },
    });
    if (!contract) return { ok: false, error: "Contrat introuvable." };
    if (contract.statut !== "ATTENTE_VALIDATION_ADMIN") {
      return {
        ok: false,
        error: `Le contrat ne peut pas être validé (statut actuel : ${contract.statut}). Il doit être en ATTENTE_VALIDATION_ADMIN.`,
      };
    }
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        statut: "ACTIF",
        valideParAdminId: user.id,
        valideALe: new Date(),
      },
    });
    revalidatePath("/contrats");
    revalidatePath(`/contrats/${contractId}`);
    revalidatePath("/pipeline");
    console.info(
      `[validateContract] ${user.name} valide ${contract.numero} → ACTIF`,
    );
    return { ok: true, contractId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

/**
 * Change la devise (CHF / EUR) d'un contrat non encore signé par le client.
 * Admin ou commerciale assignée uniquement.
 */
export async function updateContractDevise(
  contractId: string,
  devise: string,
): Promise<ContractActionResult> {
  const user = await requireUser();
  const cur = devise.toUpperCase();
  if (cur !== "CHF" && cur !== "EUR") {
    return { ok: false, error: "Devise non supportée (CHF / EUR uniquement)." };
  }
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        assigneAId: true,
        signatures: { select: { dateSignatureClient: true } },
      },
    });
    if (!contract) return { ok: false, error: "Contrat introuvable." };
    if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
      return { ok: false, error: "Accès refusé." };
    }
    const signedByClient = contract.signatures.some(
      (s) => s.dateSignatureClient !== null,
    );
    if (signedByClient) {
      return {
        ok: false,
        error:
          "Impossible de modifier la devise : le contrat est déjà signé par le client.",
      };
    }
    await prisma.contract.update({
      where: { id: contractId },
      data: { devise: cur },
    });
    revalidatePath(`/contrats/${contractId}`);
    revalidatePath("/pipeline");
    return { ok: true, contractId };
  } catch (err) {
    return prismaErrorToResult(err);
  }
}

function prismaErrorToResult(err: unknown): ContractActionResult {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[contract action] Prisma error", {
      code: err.code,
      message: err.message,
      meta: err.meta,
    });
    return {
      ok: false,
      error: `Erreur base de données (${err.code}). ${err.message.slice(0, 200)}`,
    };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: err.message };
  }
  console.error("[contract action] erreur inattendue", err);
  return { ok: false, error: "Erreur serveur inattendue." };
}
