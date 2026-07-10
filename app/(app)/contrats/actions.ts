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
 * Calcule le prix unitaire EFFECTIF d'une ligne après "offert" ou remise, en
 * tenant compte de la CIBLE (one-shot, récurrent, ou les deux).
 *  - offert     → met à 0 la/les part(s) ciblée(s). Récurrent offert = gratuit
 *                 sur la durée du contrat, puis payant au renouvellement.
 *  - POURCENT   → applique le % sur la/les part(s) ciblée(s).
 *  - MONTANT    → soustrait le montant de la/les part(s) ciblée(s).
 * Cible par défaut : "DEUX".
 */
/** Dernier instant du mois d'une date (23:59:59.999). Sert de plafond : on ne
 *  persiste JAMAIS de factures au-delà du mois courant — elles sont générées
 *  mois par mois par le cron (generateDueClientInvoices). */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Clé "AAAA-MM" du mois LOCAL d'une date. ROBUSTE au fuseau / DST : on lit les
 * composants locaux (getMonth) plutôt que l'UTC (toISOString), sinon une date
 * stockée en UTC-minuit bascule sur le mois précédent en heure d'été (UTC+2) —
 * ce qui faisait croire au générateur qu'une mensualité de juillet appartenait
 * à juin, et la faisait sauter (doublon apparent).
 */
function moisKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 1er du mois LOCAL d'une date, normalisé en UTC-minuit (stockage propre). */
function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}

function effectiveUnitPrices(
  baseOneShot: number,
  baseMensuel: number,
  line: {
    offert?: boolean;
    offertCible?: "ONESHOT" | "RECURRENT" | "DEUX";
    remiseType?: "POURCENT" | "MONTANT";
    remiseValeur?: number;
    remiseCible?: "ONESHOT" | "RECURRENT" | "DEUX";
  },
): { oneShot: number; mensuel: number } {
  let oneShot = baseOneShot;
  let mensuel = baseMensuel;

  if (line.offert) {
    const c = line.offertCible ?? "DEUX";
    if (c !== "RECURRENT") oneShot = 0;
    if (c !== "ONESHOT") mensuel = 0;
    return { oneShot, mensuel };
  }

  const r = line.remiseValeur ?? 0;
  if (line.remiseType && r > 0) {
    const c = line.remiseCible ?? "DEUX";
    const onOneShot = c !== "RECURRENT";
    const onMensuel = c !== "ONESHOT";
    if (line.remiseType === "POURCENT") {
      const f = Math.max(0, 1 - r / 100);
      if (onOneShot) oneShot = baseOneShot * f;
      if (onMensuel) mensuel = baseMensuel * f;
    } else {
      if (onOneShot) oneShot = Math.max(0, baseOneShot - r);
      if (onMensuel) mensuel = Math.max(0, baseMensuel - r);
    }
  }
  return { oneShot, mensuel };
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
      categorie: prod.categorieCode ?? prod.categorie, // règle commission ADS (catégorie effective)
      nom,
      quantite: line.quantite,
      oneShotUnit,
      mensuelUnit,
      baseOneShot,
      baseMensuel,
      offert: !!line.offert,
      offertCible: line.offertCible ?? null,
      remiseType: line.remiseType ?? null,
      remiseValeur: line.remiseValeur ?? 0,
      remiseCible: line.remiseCible ?? null,
      lineOneShot,
      lineMensuel,
    };
  });

  // Métadonnées par ligne (offert / remise / prix d'origine / quantité) →
  // affichage PDF (tableau en colonnes).
  const lignesMeta = linesEnriched.map((l) => ({
    productId: l.productId,
    quantite: l.quantite,
    prixOneShotOriginal: l.baseOneShot,
    prixMensuelOriginal: l.baseMensuel,
    offert: l.offert,
    offertCible: l.offertCible,
    remiseType: l.remiseType,
    remiseValeur: l.remiseValeur,
    remiseCible: l.remiseCible,
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
          note: parsed.data.note?.trim() || null,
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

      // Les prix de ligne (override / remise / offert) restent PROPRES au
      // contrat — stockés dans `lignesMeta` + les montants agrégés. Le prix
      // du CATALOGUE n'est JAMAIS modifié : un autre contrat repart du prix
      // de base.

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

      // ---- 6. ClientInvoices ----
      // RÈGLE MÉTIER : contrat non signé = ZÉRO facture. Le contrat naît en
      // ATTENTE_SIGNATURE_CLIENT → aucune facture n'est créée ici. Les factures
      // sont générées à l'ACTIVATION (validateContract, après signature +
      // validation admin), puis mois par mois par le cron nocturne
      // (generateDueClientInvoices). Cf. createDueInvoicesForContract.

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
        categorie: prod.categorieCode ?? prod.categorie,
        nom,
        quantite: line.quantite,
        oneShotUnit,
        mensuelUnit,
        baseOneShot,
        baseMensuel,
        offert: !!line.offert,
        offertCible: line.offertCible ?? null,
        remiseType: line.remiseType ?? null,
        remiseValeur: line.remiseValeur ?? 0,
        remiseCible: line.remiseCible ?? null,
        lineOneShot,
        lineMensuel,
      };
    });

    const lignesMeta = linesEnriched.map((l) => ({
      productId: l.productId,
      quantite: l.quantite,
      prixOneShotOriginal: l.baseOneShot,
      prixMensuelOriginal: l.baseMensuel,
      offert: l.offert,
      offertCible: l.offertCible,
      remiseType: l.remiseType,
      remiseValeur: l.remiseValeur,
      remiseCible: l.remiseCible,
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
            note: parsed.data.note?.trim() || null,
            montantOneShot: centsToChf(oneShotCents),
            montantMensuel: centsToChf(mensuelCents),
            valeurAn1: centsToChf(valeurAn1Cents),
            lignesMeta,
            products: {
              set: linesEnriched.map((l) => ({ id: l.productId })),
            },
          },
        });

        // Les prix de ligne restent PROPRES au contrat (lignesMeta + montants
        // agrégés) — le catalogue n'est jamais modifié.

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

        // 3. Factures : un contrat NON signé n'a AUCUNE facture. On purge donc
        //    d'éventuels brouillons résiduels (ex. issus d'une ancienne
        //    version). La génération se fait à l'ACTIVATION (validateContract),
        //    jamais avant signature.
        await tx.clientInvoice.deleteMany({ where: { contractId } });
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

/**
 * Envoie par email le lien de signature d'un contrat DÉJÀ créé (depuis le
 * wizard). Réutilise une demande de signature en cours ou en crée une, puis
 * envoie/enregistre l'email au client (même logique que sendSignatureByEmail).
 */
export async function sendContractSignatureEmail(
  contractId: string,
): Promise<{ ok: boolean; error?: string; dryRun?: boolean }> {
  const user = await requireUser();
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      numero: true,
      valeurAn1: true,
      assigneAId: true,
      prospect: {
        select: {
          id: true,
          email: true,
          contactPrenom: true,
        },
      },
      signatures: {
        where: { signeParClient: false },
        select: { lienSignature: true, expireA: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return { ok: false, error: "Accès refusé à ce contrat." };
  }
  if (!contract.prospect.email) {
    return {
      ok: false,
      error:
        "Pas d'email connu pour ce client. Ajoute-le sur sa fiche avant d'envoyer.",
    };
  }

  // Réutilise une demande de signature valide, sinon en crée une.
  const now = new Date();
  let token =
    contract.signatures.find((s) => s.expireA > now)?.lienSignature ?? null;
  if (!token) {
    const sig = await createSignatureRequest(contractId);
    if (!sig.ok || !sig.lienSignature) {
      return { ok: false, error: sig.error ?? "Échec de la demande de signature." };
    }
    token = sig.lienSignature;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const signUrl = `${appUrl}/sign/${token}`;
  const pdfUrl = `${appUrl}/api/contrats/${contractId}/pdf?token=${token}`;
  const greeting = contract.prospect.contactPrenom
    ? `Bonjour ${contract.prospect.contactPrenom},`
    : "Bonjour,";
  const objet = `Votre contrat ${contract.numero} — Make Your Com`;
  const valeur = Number(contract.valeurAn1).toLocaleString("fr-CH");
  const contenuTexte = [
    greeting,
    "",
    `Merci pour notre échange. Vous trouverez ci-joint le récapitulatif de votre contrat (${contract.numero}, valeur 12 mois : CHF ${valeur}).`,
    "",
    "Pour le signer en ligne en 2 minutes :",
    signUrl,
    "",
    "Vous pouvez aussi télécharger le PDF du contrat ici :",
    pdfUrl,
    "",
    "Bien cordialement,",
    user.name,
    "ACLR Sàrl — Make Your Com",
  ].join("\n");
  const contenuHtml = `
    <p>${greeting}</p>
    <p>Merci pour notre échange. Vous trouverez ci-joint le récapitulatif de votre contrat <strong>${contract.numero}</strong> (valeur 12 mois : CHF ${valeur}).</p>
    <p><strong>Pour le signer en ligne en 2 minutes :</strong><br>
    <a href="${signUrl}" style="display:inline-block;background:#0E1936;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">Signer le contrat ✍</a></p>
    <p>Vous pouvez aussi <a href="${pdfUrl}">télécharger le PDF du contrat</a> pour le consulter, l'imprimer, le signer à la main et nous le renvoyer scanné par retour d'email.</p>
    <p>Bien cordialement,<br>${user.name}<br><em>ACLR Sàrl — Make Your Com</em></p>
  `;

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
  }

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

  revalidatePath("/emails");
  revalidatePath(`/prospects/${contract.prospect.id}`);
  revalidatePath(`/contrats/${contractId}`);
  return { ok: true, dryRun: isDryRun };
}

/**
 * Prépare l'envoi d'un email de signature : garantit qu'une demande de
 * signature existe, et renvoie l'email du client + un sujet/message par défaut
 * (modifiables ensuite dans l'éditeur). Les liens (signature / PDF) sont
 * ajoutés à l'envoi selon les cases cochées.
 */
export async function prepareContractEmail(contractId: string): Promise<{
  ok: boolean;
  error?: string;
  data?: {
    to: string;
    numero: string;
    defaultSubject: string;
    defaultBody: string;
  };
}> {
  const user = await requireUser();
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      numero: true,
      valeurAn1: true,
      assigneAId: true,
      prospect: { select: { email: true, contactPrenom: true } },
      signatures: {
        where: { signeParClient: false },
        select: { lienSignature: true, expireA: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return { ok: false, error: "Accès refusé à ce contrat." };
  }
  if (!contract.prospect.email) {
    return {
      ok: false,
      error: "Pas d'email connu pour ce client. Ajoute-le sur sa fiche.",
    };
  }
  // Garantit une demande de signature valide.
  const hasValid = contract.signatures.some((s) => s.expireA > new Date());
  if (!hasValid) {
    const sig = await createSignatureRequest(contractId);
    if (!sig.ok) return { ok: false, error: sig.error ?? "Échec." };
  }

  const greeting = contract.prospect.contactPrenom
    ? `Bonjour ${contract.prospect.contactPrenom},`
    : "Bonjour,";
  const valeur = Number(contract.valeurAn1).toLocaleString("fr-CH");
  const defaultBody = [
    greeting,
    "",
    `Merci pour notre échange. Veuillez trouver votre contrat ${contract.numero} (valeur 12 mois : CHF ${valeur}).`,
    "",
    "Bien cordialement,",
    user.name,
    "ACLR Sàrl — Make Your Com",
  ].join("\n");

  return {
    ok: true,
    data: {
      to: contract.prospect.email,
      numero: contract.numero,
      defaultSubject: `Votre contrat ${contract.numero} — Make Your Com`,
      defaultBody,
    },
  };
}

const SendContractEmailSchema = z.object({
  contractId: z.string().min(1),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  includeSignLink: z.boolean(),
  includePdf: z.boolean(),
});

/**
 * Envoie l'email de signature avec le message rédigé par l'utilisateur, en y
 * ajoutant (selon les options) le lien de signature en ligne et/ou le lien du
 * PDF (à imprimer / signer à la main). Enregistré dans le module Emails.
 */
export async function sendContractEmailCustom(
  input: unknown,
): Promise<{ ok: boolean; error?: string; dryRun?: boolean }> {
  const user = await requireUser();
  const parsed = SendContractEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide." };
  }
  const { contractId, subject, body, includeSignLink, includePdf } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      numero: true,
      assigneAId: true,
      prospect: { select: { id: true, email: true } },
      signatures: {
        where: { signeParClient: false },
        select: { lienSignature: true, expireA: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return { ok: false, error: "Accès refusé." };
  }
  if (!contract.prospect.email) {
    return { ok: false, error: "Pas d'email connu pour ce client." };
  }

  let token =
    contract.signatures.find((s) => s.expireA > new Date())?.lienSignature ??
    null;
  if (!token && (includeSignLink || includePdf)) {
    const sig = await createSignatureRequest(contractId);
    if (!sig.ok || !sig.lienSignature) {
      return { ok: false, error: sig.error ?? "Échec de la demande de signature." };
    }
    token = sig.lienSignature;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const signUrl = `${appUrl}/sign/${token}`;
  const pdfUrl = `${appUrl}/api/contrats/${contractId}/pdf?token=${token}`;

  // Corps texte (saisi) + blocs optionnels.
  const txtParts = [body.trim()];
  if (includeSignLink) {
    txtParts.push("", "Pour signer en ligne en 2 minutes :", signUrl);
  }
  if (includePdf) {
    txtParts.push(
      "",
      "Télécharger le PDF du contrat (à imprimer / signer à la main) :",
      pdfUrl,
    );
  }
  const contenuTexte = txtParts.join("\n");

  const bodyHtml = body
    .trim()
    .split("\n")
    .map((l) => (l.trim() === "" ? "<br/>" : `<p>${escapeHtml(l)}</p>`))
    .join("");
  let contenuHtml = bodyHtml;
  if (includeSignLink) {
    contenuHtml += `<p style="margin-top:14px;"><a href="${signUrl}" style="display:inline-block;background:#0E1936;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Signer le contrat en ligne ✍</a></p>`;
  }
  if (includePdf) {
    contenuHtml += `<p style="margin-top:10px;">📄 <a href="${pdfUrl}">Télécharger le PDF du contrat</a> (à imprimer / signer à la main et renvoyer scanné par retour d'email).</p>`;
  }

  const userFull = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  });
  const isDryRun = process.env.EMAIL_MODE !== "live";
  const { randomBytes } = await import("node:crypto");
  const messageId = `<${randomBytes(8).toString("hex")}.${Date.now()}@aclr.ch>`;
  const threadId = randomBytes(8).toString("hex");
  if (isDryRun) {
    console.log("📧 [DRY-RUN] Email contrat", {
      to: contract.prospect.email,
      subject,
    });
  }

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
      objet: subject,
      contenuHtml,
      contenuTexte,
      statut: "ENVOYE",
      envoyeLe: new Date(),
      labels: ["signature"],
    },
  });
  await prisma.activity.create({
    data: {
      prospectId: contract.prospect.id,
      userId: user.id,
      type: "EMAIL_ENVOYE",
      date: new Date(),
      sujet: `Contrat ${contract.numero} envoyé par email`,
      contenu: `À ${contract.prospect.email}`,
      statut: "FAIT",
    },
  });

  revalidatePath("/emails");
  revalidatePath(`/prospects/${contract.prospect.id}`);
  revalidatePath(`/contrats/${contractId}`);
  return { ok: true, dryRun: isDryRun };
}

/** Échappe le HTML pour insérer du texte utilisateur sans risque d'injection. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      select: {
        id: true,
        statut: true,
        numero: true,
        modalitePaiement: true,
        dateSignature: true,
        dateDebut: true,
        dureeMois: true,
        devise: true,
        facturationReprendLe: true,
        montantOneShot: true,
        montantMensuel: true,
        lignesMeta: true,
        products: {
          select: { id: true, nom: true, prixOneShot: true, prixMensuel: true },
        },
        clientInvoices: {
          select: { periodeMoisDebut: true, type: true, dateEmission: true },
        },
      },
    });
    if (!contract) return { ok: false, error: "Contrat introuvable." };
    if (contract.statut !== "ATTENTE_VALIDATION_ADMIN") {
      return {
        ok: false,
        error: `Le contrat ne peut pas être validé (statut actuel : ${contract.statut}). Il doit être en ATTENTE_VALIDATION_ADMIN.`,
      };
    }

    const billing = reconstructContractBilling(contract);
    let invoicesCreated = 0;
    await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contractId },
        data: {
          statut: "ACTIF",
          valideParAdminId: user.id,
          valideALe: new Date(),
        },
      });
      // Génération des factures ÉCHUES à l'activation : le contrat est
      // désormais signé + validé, on peut facturer. One-shot (acompte / solde /
      // ponctuelle) + mensualité(s) échues jusqu'au mois courant. Les mois
      // suivants sont générés par le cron. Dédup interne → aucun doublon même
      // si l'activation est rejouée.
      invoicesCreated = await createDueInvoicesForContract(
        tx,
        contract,
        billing,
        {
          includeOneShot: true,
          floorMonth: null,
          cutoff: endOfMonth(new Date()),
        },
      );
    });

    revalidatePath("/contrats");
    revalidatePath(`/contrats/${contractId}`);
    revalidatePath("/pipeline");
    console.info(
      `[validateContract] ${user.name} valide ${contract.numero} → ACTIF (${invoicesCreated} facture(s) générée(s))`,
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

/**
 * Reconstruit les montants (en cents) et les lignes de facturation d'un
 * contrat. Depuis `lignesMeta` si présent (prix/offert/remise d'origine),
 * sinon repli sur les montants AUTORITAIRES du contrat (contrats anciens /
 * importés sans meta). Partagé par l'activation et le cron mensuel.
 */
function reconstructContractBilling(c: {
  montantOneShot: Prisma.Decimal | number;
  montantMensuel: Prisma.Decimal | number;
  lignesMeta: Prisma.JsonValue | null;
  products: Array<{
    id: string;
    nom: string;
    prixOneShot: Prisma.Decimal | null;
    prixMensuel: Prisma.Decimal | null;
  }>;
}): {
  oneShotCents: number;
  mensuelCents: number;
  lines: Parameters<typeof buildClientInvoicesForContract>[0]["lines"];
} {
  const meta = Array.isArray(c.lignesMeta)
    ? (c.lignesMeta as Array<Record<string, unknown>>)
    : [];
  const prodById = new Map(c.products.map((p) => [p.id, p]));
  let oneShotCents = 0;
  let mensuelCents = 0;
  const lines: Parameters<typeof buildClientInvoicesForContract>[0]["lines"] =
    [];

  if (meta.length > 0) {
    // Chemin normal : reconstruction ligne par ligne depuis lignesMeta.
    for (const m of meta) {
      const prod = prodById.get(String(m.productId));
      if (!prod) continue;
      const baseOneShot = Number(
        m.prixOneShotOriginal ??
          (prod.prixOneShot ? Number(prod.prixOneShot) : 0),
      );
      const baseMensuel = Number(
        m.prixMensuelOriginal ??
          (prod.prixMensuel ? Number(prod.prixMensuel) : 0),
      );
      const eff = effectiveUnitPrices(baseOneShot, baseMensuel, {
        offert: Boolean(m.offert),
        offertCible: (m.offertCible as never) ?? null,
        remiseType: (m.remiseType as never) ?? null,
        remiseValeur: Number(m.remiseValeur ?? 0),
        remiseCible: (m.remiseCible as never) ?? null,
      });
      const qte = Number(m.quantite ?? 1);
      const lineOneShot = chfToCents(eff.oneShot * qte);
      const lineMensuel = chfToCents(eff.mensuel * qte);
      oneShotCents += lineOneShot;
      mensuelCents += lineMensuel;
      lines.push({
        productId: String(m.productId),
        nom: prod.nom,
        quantite: qte,
        oneShotUnit: eff.oneShot,
        mensuelUnit: eff.mensuel,
        lineOneShot,
        lineMensuel,
      });
    }
  } else {
    // Repli — contrats SANS lignesMeta (anciens / importés). On facture les
    // montants AUTORITAIRES du contrat via une ligne synthétique (désignation =
    // produits liés). Sans ce repli, ces contrats ne seraient jamais facturés.
    oneShotCents = chfToCents(Number(c.montantOneShot));
    mensuelCents = chfToCents(Number(c.montantMensuel));
    const designation = c.products.length
      ? c.products.map((prod) => prod.nom).join(" + ")
      : "Prestation mensuelle";
    lines.push({
      productId: c.products[0]?.id ?? "",
      nom: designation,
      quantite: 1,
      oneShotUnit: centsToChf(oneShotCents),
      mensuelUnit: centsToChf(mensuelCents),
      lineOneShot: oneShotCents,
      lineMensuel: mensuelCents,
    });
  }
  return { oneShotCents, mensuelCents, lines };
}

/**
 * Crée en BROUILLON les factures ÉCHUES d'UN contrat qui n'existent pas encore.
 * Partagé par l'activation (validateContract → includeOneShot=true) et le cron
 * mensuel (generateDueClientInvoices → includeOneShot=false + plancher mois).
 *
 * Dédup stricte (jamais de doublon) : MENSUALITE par période (YYYY-MM),
 * one-shot par (type + date d'émission). Ne crée jamais au-delà de `cutoff`
 * (fin du mois courant) → jamais de factures d'avance.
 */
async function createDueInvoicesForContract(
  client: Prisma.TransactionClient,
  c: {
    id: string;
    modalitePaiement: string;
    dateSignature: Date;
    dateDebut: Date;
    dureeMois: number;
    devise: string;
    facturationReprendLe: Date | null;
    clientInvoices: Array<{
      periodeMoisDebut: Date | null;
      type: string;
      dateEmission: Date;
    }>;
  },
  billing: {
    oneShotCents: number;
    mensuelCents: number;
    lines: Parameters<typeof buildClientInvoicesForContract>[0]["lines"];
  },
  opts: { includeOneShot: boolean; floorMonth: Date | null; cutoff: Date },
): Promise<number> {
  const schedule = buildClientInvoicesForContract({
    modalite: c.modalitePaiement as never,
    dateSignature: c.dateSignature,
    dateDebut: c.dateDebut,
    dureeMois: c.dureeMois,
    oneShotCents: billing.oneShotCents,
    mensuelCents: billing.mensuelCents,
    lines: billing.lines,
  });

  const existingPeriods = new Set(
    c.clientInvoices
      .filter((i) => i.periodeMoisDebut)
      .map((i) => moisKeyLocal(i.periodeMoisDebut!)),
  );
  const existingOneShot = new Set(
    c.clientInvoices
      .filter((i) => i.type !== "MENSUALITE")
      .map((i) => `${i.type}|${i.dateEmission.toISOString().slice(0, 10)}`),
  );

  // Pause de facturation : si le mois courant (floorMonth) est AVANT le mois de
  // reprise, on ne crée AUCUNE mensualité pour ce contrat (ni via le planning,
  // ni via le filet renouvellement). Comparaison par clé de mois locale pour
  // éviter le piège fuseau/DST au mois de reprise. N'affecte que le cron
  // (floorMonth défini) ; les one-shots ne sont pas concernés.
  const facturationEnPause = !!(
    opts.floorMonth &&
    c.facturationReprendLe &&
    moisKeyLocal(opts.floorMonth) < moisKeyLocal(c.facturationReprendLe)
  );

  let created = 0;
  for (const inv of schedule) {
    if (inv.dateEmission > opts.cutoff) continue; // jamais d'avance
    if (inv.type === "MENSUALITE") {
      if (facturationEnPause) continue; // forfait en pause ce mois-ci
      if (opts.floorMonth && inv.dateEmission < opts.floorMonth) continue;
      const key = moisKeyLocal(inv.periodeMoisDebut ?? inv.dateEmission);
      if (existingPeriods.has(key)) continue; // déjà générée ce mois
      existingPeriods.add(key);
    } else {
      if (!opts.includeOneShot) continue; // one-shot créé à l'activation
      const key = `${inv.type}|${inv.dateEmission.toISOString().slice(0, 10)}`;
      if (existingOneShot.has(key)) continue; // acompte/solde déjà émis
      existingOneShot.add(key);
    }

    const annee = inv.dateEmission.getFullYear();
    const counter = await client.counter.upsert({
      where: { scope_year: { scope: "client_invoice", year: annee } },
      create: { scope: "client_invoice", year: annee, value: 1 },
      update: { value: { increment: 1 } },
    });
    const facNumero = `${PREFIX_FACTURE_CLIENT}-${annee}-${String(counter.value).padStart(4, "0")}`;

    await client.clientInvoice.create({
      data: {
        contractId: c.id,
        numero: facNumero,
        dateEmission: inv.dateEmission,
        dateEcheance: inv.dateEcheance,
        type: inv.type,
        // Normalise la période au 1er du mois LOCAL, stocké en UTC-minuit
        // (évite les dates décalées type 2026-06-30T23:00Z pour "juillet").
        periodeMoisDebut: inv.periodeMoisDebut
          ? firstOfMonthUTC(inv.periodeMoisDebut)
          : null,
        periodeMoisFin: inv.periodeMoisFin ?? null,
        devise: c.devise ?? "CHF",
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
            productId: l.productId || null,
          })),
        },
      },
    });
    created++;
  }

  // ── Filet RENOUVELLEMENT ──────────────────────────────────────────────────
  // Les contrats auto-renouvelés dépassent leur planning initial de 12 mois :
  // le `schedule` (ancré sur dateDebut, 12 mois) ne couvre alors PAS le mois
  // courant. Si le contrat est actif ce mois-ci et qu'AUCUNE mensualité du mois
  // courant n'existe (ni générée ci-dessus, ni déjà en base), on crée la
  // mensualité RÉCURRENTE seule (sans setup — amorti en année 1). Ne s'exécute
  // qu'en mode cron mensuel (floorMonth défini), pas à l'activation.
  if (
    opts.floorMonth &&
    billing.mensuelCents > 0 &&
    !facturationEnPause && // forfait en pause → pas de mensualité de renouvellement
    // Exclut UNIQUEMENT le 100%-à-la-signature (mensuel facturé d'avance dans la
    // ponctuelle). MENSUEL et 50/50 ont un récurrent facturé mois par mois, qui
    // doit continuer au renouvellement (ex. forfait site 29.90 après un site
    // payé en 50/50).
    c.modalitePaiement !== "CENT_AU_SIGNING"
  ) {
    const curKey = moisKeyLocal(opts.floorMonth);
    if (!existingPeriods.has(curKey)) {
      const emission = firstOfMonthUTC(opts.floorMonth);
      const echeance = new Date(emission);
      echeance.setDate(echeance.getDate() + FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT);
      const periodeFin = new Date(
        Date.UTC(emission.getUTCFullYear(), emission.getUTCMonth() + 1, 0),
      );
      const lignes = billing.lines
        .filter((l) => l.lineMensuel > 0)
        .map((l, idx) => ({
          designation: `${l.nom} — mensualité (renouvellement)`,
          quantite: l.quantite,
          prixUnitaire: l.mensuelUnit,
          montantHT: centsToChf(l.lineMensuel),
          tauxTVA: 0,
          ordre: idx,
          productId: l.productId || null,
        }));
      const annee = emission.getUTCFullYear();
      const counter = await client.counter.upsert({
        where: { scope_year: { scope: "client_invoice", year: annee } },
        create: { scope: "client_invoice", year: annee, value: 1 },
        update: { value: { increment: 1 } },
      });
      const facNumero = `${PREFIX_FACTURE_CLIENT}-${annee}-${String(counter.value).padStart(4, "0")}`;
      await client.clientInvoice.create({
        data: {
          contractId: c.id,
          numero: facNumero,
          dateEmission: emission,
          dateEcheance: echeance,
          type: "MENSUALITE",
          periodeMoisDebut: emission,
          periodeMoisFin: periodeFin,
          devise: c.devise ?? "CHF",
          sousTotal: centsToChf(billing.mensuelCents),
          totalTVA: 0,
          total: centsToChf(billing.mensuelCents),
          statut: "BROUILLON",
          lignes: { create: lignes },
        },
      });
      existingPeriods.add(curKey);
      created++;
    }
  }

  return created;
}

/**
 * Générateur MENSUEL des factures clients (appelé par le cron nocturne).
 *
 * Pour chaque contrat ACTIF, rejoue EXACTEMENT le même calcul que la création
 * (buildClientInvoicesForContract, params reconstruits depuis lignesMeta), et
 * crée en BROUILLON les mensualités ÉCHUES qui manquent (dateEmission ≤ fin du
 * mois courant), sans jamais dépasser le mois courant ni créer de doublon
 * (dédup par période mois). Idempotent : peut tourner chaque nuit sans risque.
 *
 * Résultat : une facture par mois par contrat, générée au fil de l'eau — plus
 * jamais 12 mois d'avance.
 */
export async function generateDueClientInvoices(): Promise<{
  ok: boolean;
  created: number;
  error?: string;
}> {
  try {
    const now = new Date();
    const cutoff = endOfMonth(now);
    // Plancher = 1er du mois courant : on ne génère QUE le mois courant (pas de
    // backfill des mois passés — évite de recréer d'anciennes factures).
    const floorMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const contracts = await prisma.contract.findMany({
      where: { statut: "ACTIF" },
      select: {
        id: true,
        modalitePaiement: true,
        dateSignature: true,
        dateDebut: true,
        dureeMois: true,
        devise: true,
        facturationReprendLe: true,
        montantOneShot: true,
        montantMensuel: true,
        lignesMeta: true,
        products: {
          select: { id: true, nom: true, prixOneShot: true, prixMensuel: true },
        },
        clientInvoices: {
          select: { periodeMoisDebut: true, type: true, dateEmission: true },
        },
      },
    });

    let created = 0;
    for (const c of contracts) {
      const billing = reconstructContractBilling(c);
      if (billing.mensuelCents === 0) continue; // pas de récurrent → rien
      created += await prisma.$transaction((tx) =>
        createDueInvoicesForContract(tx, c, billing, {
          includeOneShot: false, // one-shot créé à l'activation, pas ici
          floorMonth, // mois courant uniquement (pas de backfill)
          cutoff,
        }),
      );
    }
    return { ok: true, created };
  } catch (e) {
    console.error("[generateDueClientInvoices]", e);
    return {
      ok: false,
      created: 0,
      error: e instanceof Error ? e.message : "Erreur",
    };
  }
}
