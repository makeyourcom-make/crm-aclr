"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  buildSignaturePaymentPlan,
  centsToChf,
  chfToCents,
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
  MarkPaymentEncaisseSchema,
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

  // RLS prospect
  if (user.role !== "ADMIN") {
    const p = await prisma.prospect.findUnique({
      where: { id: parsed.data.prospectId },
      select: { assigneAId: true },
    });
    if (!p || p.assigneAId !== user.id) {
      return { ok: false, error: "Tu n'as pas accès à ce prospect." };
    }
  }

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
    const oneShotUnit =
      line.prixOneShot ?? (prod.prixOneShot ? Number(prod.prixOneShot) : 0);
    const mensuelUnit =
      line.prixMensuel ?? (prod.prixMensuel ? Number(prod.prixMensuel) : 0);
    const lineOneShot = chfToCents(oneShotUnit * line.quantite);
    const lineMensuel = chfToCents(mensuelUnit * line.quantite);
    oneShotCents += lineOneShot;
    mensuelCents += lineMensuel;
    return {
      productId: line.productId,
      nom: prod.nom,
      quantite: line.quantite,
      oneShotUnit,
      mensuelUnit,
      lineOneShot,
      lineMensuel,
    };
  });

  const valeurAn1Cents = computeValeurAn1({
    oneShotCents,
    mensuelCents,
  });
  const commission = computeCommissionSignature({
    valeurAn1Cents,
    taux: tauxCommission,
  });
  const plan = buildSignaturePaymentPlan({
    valeurAn1Cents,
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

      // ---- 2. Création du Contract ----
      const contract = await tx.contract.create({
        data: {
          numero,
          prospectId: parsed.data.prospectId,
          dealId: parsed.data.dealId ?? null,
          assigneAId: user.id,
          dateSignature: parsed.data.dateSignature,
          dateDebut: parsed.data.dateDebut,
          dureeMois: parsed.data.dureeMois,
          modalitePaiement: parsed.data.modalitePaiement,
          montantOneShot: centsToChf(oneShotCents),
          montantMensuel: centsToChf(mensuelCents),
          valeurAn1: centsToChf(valeurAn1Cents),
          statut: "ACTIF",
          products: {
            connect: linesEnriched.map((l) => ({ id: l.productId })),
          },
        },
      });

      // ---- 3. Update Deal si fourni ----
      if (parsed.data.dealId) {
        await tx.deal.update({
          where: { id: parsed.data.dealId },
          data: {
            stage: "SIGNE",
            probabilite: 100,
            closeReelLe: parsed.data.dateSignature,
          },
        });
      }

      // ---- 4. Update Prospect → SIGNE ----
      await tx.prospect.update({
        where: { id: parsed.data.prospectId },
        data: { statut: "SIGNE" },
      });

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

// ===========================================================================
// MARQUER UN PAIEMENT CLIENT ENCAISSÉ → déclenche commission signature
// ===========================================================================

export async function markPaymentEncaisse(
  input: unknown,
): Promise<ContractActionResult> {
  const user = await requireUser();
  const parsed = MarkPaymentEncaisseSchema.safeParse(input);
  if (!parsed.success) return zodErrorToResult(parsed.error);

  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    include: {
      contract: { select: { id: true, assigneAId: true } },
    },
  });
  if (!payment) return { ok: false, error: "Paiement introuvable." };
  if (user.role !== "ADMIN" && payment.contract.assigneAId !== user.id) {
    return { ok: false, error: "Pas d'accès à ce paiement." };
  }
  if (payment.statut === "ENCAISSE") {
    return { ok: false, error: "Déjà encaissé." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          statut: "ENCAISSE",
          date: parsed.data.dateEncaissement ?? new Date(),
        },
      });

      // 2. Si c'est le premier paiement encaissé du contrat,
      //    on déclenche le versement de commission "SIGNATURE"
      const dejaEncaisses = await tx.payment.count({
        where: {
          contractId: payment.contract.id,
          statut: "ENCAISSE",
          id: { not: payment.id },
        },
      });
      if (dejaEncaisses === 0) {
        const com = await tx.commission.findUnique({
          where: { contractId: payment.contract.id },
        });
        if (com) {
          await tx.commissionPayment.updateMany({
            where: {
              commissionId: com.id,
              typePart: "SIGNATURE",
              statut: "PREVU",
            },
            data: { statut: "PAYE", dateVersement: new Date() },
          });
        }
      }
    });

    revalidatePath(`/contrats/${payment.contract.id}`);
    revalidatePath("/paiements");
    return { ok: true };
  } catch (err) {
    return prismaErrorToResult(err);
  }
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
    // Tout en mensuel : on lisse oneShot sur 12 mois OU on le facture mois 1
    // Choix : on l'ajoute dans la mensualité du mois 1 ("setup")
    for (let i = 0; i < 12; i++) {
      const dateEmission = addMonthsKeepEndOfMonth(params.dateDebut, i);
      const periodeFin = new Date(dateEmission);
      periodeFin.setMonth(periodeFin.getMonth() + 1);
      periodeFin.setDate(periodeFin.getDate() - 1);

      const lineMonth = params.lines
        .filter((l) => l.lineMensuel > 0)
        .map((l) => ({
          designation: `${l.nom} — mensualité ${i + 1}/12`,
          quantite: l.quantite,
          prixUnitaire: l.mensuelUnit,
          montantHT: centsToChf(l.lineMensuel),
          productId: l.productId,
        }));

      let monthCents = params.mensuelCents;
      if (i === 0 && params.oneShotCents > 0) {
        monthCents += params.oneShotCents;
        for (const l of params.lines) {
          if (l.lineOneShot > 0) {
            lineMonth.unshift({
              designation: `${l.nom} — setup`,
              quantite: l.quantite,
              prixUnitaire: l.oneShotUnit,
              montantHT: centsToChf(l.lineOneShot),
              productId: l.productId,
            });
          }
        }
      }

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
