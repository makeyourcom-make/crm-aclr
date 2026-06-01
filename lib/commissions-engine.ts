/**
 * Moteur de commissions — couche serveur qui orchestre les déclencheurs.
 *
 * Ne pas confondre avec lib/commissions.ts qui contient les fonctions de
 * calcul pures (sans Prisma, testables unitairement avec 43 tests).
 *
 * Sémantique des statuts CommissionPayment :
 *   - PREVU   : pas encore acquis (date prévue dans le futur)
 *   - PAYE    : ACQUIS par la commerciale — sera intégré à sa prochaine
 *               facture mensuelle (étape 14 — le versement effectif d'Arthur
 *               vers Sophie n'a lieu qu'une fois par mois, sur cette base)
 *   - ANNULE  : annulé suite à résiliation anticipée (règle métier spec)
 *
 * Renouvellements (cf user request) :
 *   Tous les contrats se renouvellent automatiquement. À l'anniversaire :
 *     - 12 nouvelles ClientInvoices pour la prochaine année
 *     - 12 CommissionPayment RENOUVELLEMENT en PREVU
 *     - 1 Renewal record pour tracer
 *   Quand chaque mensualité est encaissée → le CommissionPayment
 *   RENOUVELLEMENT correspondant passe à PAYE.
 */
import { addMonthsKeepEndOfMonth, chfToCents } from "@/lib/commissions";
import {
  FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT,
  PREFIX_FACTURE_CLIENT,
} from "@/lib/constants";
import { prisma } from "@/lib/db";

import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Type pour permettre l'injection d'un tx Prisma (réutilisable dans une
// transaction plus large) ou par défaut, l'instance globale.
// ---------------------------------------------------------------------------

type PrismaLike = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ===========================================================================
// PROCESS OVERDUE ETALEMENTS
// ===========================================================================
//
// Parcourt tous les CommissionPayment en statut PREVU dont :
//   - typePart = ETALEMENT (les étalements mensuels après signature)
//   - dateVersementPrevue <= now
//
// Les passe à PAYE avec dateVersement = now.
//
// Utilisable :
//   - En batch nocturne (étape 27 : job CRON quotidien à 02:00)
//   - Manuellement par un admin pour rattraper / tester
//   - Au démarrage du serveur après une période d'inactivité
//
// Retourne le nombre d'enregistrements mis à jour + le détail par commerciale
// (utile pour le toast après action manuelle).

export interface ProcessOverdueResult {
  total: number;
  parCommerciale: Array<{
    userId: string;
    userName: string;
    nbVersements: number;
    montantTotal: number;
  }>;
}

export async function processOverdueEtalements(
  tx?: PrismaLike,
): Promise<ProcessOverdueResult> {
  const db = tx ?? prisma;
  const now = new Date();

  // 1. On récupère les paiements à passer en PAYE (avec leur commission
  //    pour connaître la commerciale qui touche)
  const aPayer = await db.commissionPayment.findMany({
    where: {
      statut: "PREVU",
      typePart: "ETALEMENT",
      dateVersementPrevue: { lte: now },
    },
    include: {
      commission: {
        select: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (aPayer.length === 0) {
    return { total: 0, parCommerciale: [] };
  }

  // 2. Update en bloc — plus rapide qu'un loop si la liste est longue
  await db.commissionPayment.updateMany({
    where: {
      id: { in: aPayer.map((p) => p.id) },
    },
    data: {
      statut: "PAYE",
      dateVersement: now,
    },
  });

  // 3. Agrégation par commerciale (pour le retour)
  const agg = new Map<string, { userName: string; nb: number; montant: number }>();
  for (const p of aPayer) {
    const u = p.commission.user;
    const cur = agg.get(u.id) ?? { userName: u.name, nb: 0, montant: 0 };
    cur.nb += 1;
    cur.montant += Number(p.montant);
    agg.set(u.id, cur);
  }

  return {
    total: aPayer.length,
    parCommerciale: Array.from(agg.entries()).map(([userId, v]) => ({
      userId,
      userName: v.userName,
      nbVersements: v.nb,
      montantTotal: v.montant,
    })),
  };
}

// ===========================================================================
// MATCH RENEWAL COMMISSION (mensualité encaissée an 2+)
// ===========================================================================
//
// Quand une mensualité client est encaissée et que le contrat est en an 2+ :
//   - On cherche le CommissionPayment RENOUVELLEMENT PREVU le plus ancien
//     non encore acquis (créé proactivement par processContractAnniversaries
//     à chaque anniversaire de contrat).
//   - On le passe à PAYE.
//
// Si aucun PREVU n'existe (anniversaire pas encore traité par le CRON),
// on en crée un à la volée (fallback safety net).

export interface TriggerRenewalParams {
  contractId: string;
  paymentDate: Date;
  tx?: PrismaLike;
}

export interface TriggerRenewalResult {
  created: boolean;
  amount: number;
  reason?: string;
}

export async function triggerRenewalCommissionIfApplicable(
  params: TriggerRenewalParams,
): Promise<TriggerRenewalResult> {
  const db = params.tx ?? prisma;

  const contract = await db.contract.findUnique({
    where: { id: params.contractId },
    select: {
      id: true,
      dateSignature: true,
      montantMensuel: true,
      statut: true,
      assigneA: { select: { tauxCommissionRenouvellement: true } },
      commissions: { select: { id: true } },
    },
  });
  if (!contract) {
    return { created: false, amount: 0, reason: "Contrat introuvable." };
  }
  if (contract.statut !== "ACTIF") {
    return { created: false, amount: 0, reason: "Contrat non actif." };
  }

  // Vérifie an 2+
  const an2 = new Date(contract.dateSignature);
  an2.setFullYear(an2.getFullYear() + 1);
  if (params.paymentDate < an2) {
    return {
      created: false,
      amount: 0,
      reason: "Encore en an 1 (pas de commission renouvellement).",
    };
  }

  if (contract.commissions.length === 0) {
    return { created: false, amount: 0, reason: "Pas de commission existante." };
  }

  // 1. Cherche d'abord un PREVU RENOUVELLEMENT existant (créé par
  //    processContractAnniversaries) le plus ancien
  const existing = await db.commissionPayment.findFirst({
    where: {
      commissionId: contract.commissions[0].id,
      typePart: "RENOUVELLEMENT",
      statut: "PREVU",
    },
    orderBy: { dateVersementPrevue: "asc" },
  });

  if (existing) {
    await db.commissionPayment.update({
      where: { id: existing.id },
      data: { statut: "PAYE", dateVersement: params.paymentDate },
    });
    return { created: true, amount: Number(existing.montant) };
  }

  // 2. Fallback : pas de PREVU → on crée et marque PAYE direct
  //    (cas où l'anniversaire n'a pas encore été traité par le CRON)
  const taux = Number(contract.assigneA.tauxCommissionRenouvellement);
  const montantCommission = Number(contract.montantMensuel) * taux;
  await db.commissionPayment.create({
    data: {
      commissionId: contract.commissions[0].id,
      typePart: "RENOUVELLEMENT",
      montant: montantCommission,
      dateVersementPrevue: params.paymentDate,
      dateVersement: params.paymentDate,
      statut: "PAYE",
      numeroMois: null,
    },
  });
  return { created: true, amount: montantCommission };
}

// ===========================================================================
// PROCESS CONTRACT ANNIVERSARIES → tous les contrats renouvellent auto
// ===========================================================================
//
// Pour chaque contrat ACTIF qui a passé son anniversaire (signature + N ans
// où N >= 1) et pour lequel aucun Renewal n'existe encore pour cette année :
//   1. Crée un Renewal record (traçabilité)
//   2. Crée 12 nouvelles ClientInvoices mensualité pour la prochaine année
//      (numérotation ACLR-CLI-{YYYY}-{NNNN} séquentielle)
//   3. Crée 12 CommissionPayment RENOUVELLEMENT en PREVU
//      (passeront à PAYE quand chaque mensualité sera encaissée)
//
// Idempotent : skip les anniversaires déjà traités.

export interface ContractRenewalResult {
  contractId: string;
  numero: string;
  yearIndex: number;
  invoicesCreated: number;
  commissionsCreated: number;
}

/**
 * Génère les factures annuelles récurrentes pour les contrats facturés
 * en 1× par an (montantMensuel = 0, valeurAn1 > 0).
 *
 * Mécanisme :
 *   - Cherche tous les contrats ACTIF avec montantMensuel = 0 ET au moins
 *     une facture client existante (le contrat n'est pas vide).
 *   - Pour chaque contrat, prend la facture la plus récente émise.
 *   - Si dateEmission + 1 an ≤ aujourd'hui → crée une nouvelle facture
 *     BROUILLON à la date d'anniversaire (l'admin l'émettra manuellement
 *     ou via Resend une fois activé).
 *   - Idempotent : vérifie qu'aucune facture n'existe déjà pour cette
 *     anniversaire (±2 jours de tolérance).
 *
 * Le numéro suit le format standard ACLR-CLI-{YYYY}-{NNNN}.
 */
export interface AnnualInvoiceResult {
  contractNumero: string;
  prospectName: string;
  newInvoiceNumero: string;
  amount: number;
  dateEmission: Date;
}

export async function processAnnualContractAnniversaries(): Promise<
  AnnualInvoiceResult[]
> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const results: AnnualInvoiceResult[] = [];

  const contracts = await prisma.contract.findMany({
    where: {
      statut: "ACTIF",
      montantMensuel: { equals: 0 },
    },
    include: {
      prospect: { select: { raisonSociale: true } },
      clientInvoices: {
        where: { total: { gt: 0 } }, // exclut les avoirs
        orderBy: { dateEmission: "desc" },
        take: 1,
      },
    },
  });

  for (const c of contracts) {
    if (c.clientInvoices.length === 0) continue;
    const lastFact = c.clientInvoices[0];

    // Date attendue de la prochaine facture annuelle
    const nextDue = new Date(lastFact.dateEmission);
    nextDue.setFullYear(nextDue.getFullYear() + 1);
    nextDue.setHours(0, 0, 0, 0);

    if (nextDue > now) continue; // pas encore l'heure

    // Idempotence : vérifie qu'aucune facture n'existe déjà autour de cette date
    const dayMs = 86400_000;
    const existing = await prisma.clientInvoice.findFirst({
      where: {
        contractId: c.id,
        dateEmission: {
          gte: new Date(nextDue.getTime() - 2 * dayMs),
          lt: new Date(nextDue.getTime() + 2 * dayMs),
        },
        total: { gt: 0 },
      },
    });
    if (existing) continue;

    // Crée la nouvelle facture BROUILLON
    const annee = nextDue.getFullYear();
    const dateEcheance = new Date(nextDue);
    dateEcheance.setDate(dateEcheance.getDate() + 30);

    const created = await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: { scope_year: { scope: "client_invoice", year: annee } },
        create: { scope: "client_invoice", year: annee, value: 1 },
        update: { value: { increment: 1 } },
      });
      const numero = `${PREFIX_FACTURE_CLIENT}-${annee}-${String(counter.value).padStart(4, "0")}`;

      return tx.clientInvoice.create({
        data: {
          contractId: c.id,
          numero,
          dateEmission: nextDue,
          dateEcheance,
          type: "ANNUELLE",
          sousTotal: lastFact.sousTotal,
          totalTVA: lastFact.totalTVA,
          total: lastFact.total,
          statut: "BROUILLON",
          notesClient:
            "Facture annuelle générée automatiquement par le cron nocturne (anniversaire +1 an de la précédente).",
        },
      });
    });

    results.push({
      contractNumero: c.numero,
      prospectName: c.prospect.raisonSociale,
      newInvoiceNumero: created.numero,
      amount: Number(created.total),
      dateEmission: nextDue,
    });
  }

  return results;
}

export async function processContractAnniversaries(): Promise<
  ContractRenewalResult[]
> {
  const now = new Date();
  const results: ContractRenewalResult[] = [];

  const contracts = await prisma.contract.findMany({
    where: {
      statut: "ACTIF",
      montantMensuel: { gt: 0 },
    },
    include: {
      renewals: { select: { dateRenouvellement: true } },
      assigneA: { select: { tauxCommissionRenouvellement: true } },
      commissions: { select: { id: true } },
      products: {
        select: { id: true, nom: true, prixMensuel: true },
      },
    },
  });

  for (const c of contracts) {
    if (c.commissions.length === 0) continue;

    // Nombre d'années écoulées depuis la signature
    const msPerYear = 365.25 * 24 * 3600 * 1000;
    const yearsSince = Math.floor(
      (now.getTime() - c.dateSignature.getTime()) / msPerYear,
    );
    if (yearsSince < 1) continue;

    // Pour chaque anniversaire écoulé (an 1 → an N), check si traité
    for (let year = 1; year <= yearsSince; year++) {
      const anniv = new Date(c.dateSignature);
      anniv.setFullYear(anniv.getFullYear() + year);

      const alreadyDone = c.renewals.some(
        (r) =>
          Math.abs(r.dateRenouvellement.getTime() - anniv.getTime()) <
          86400_000 * 2,
      );
      if (alreadyDone) continue;

      const res = await renewContractForYear(c.id, anniv, year);
      if (res) results.push(res);
    }
  }

  return results;
}

async function renewContractForYear(
  contractId: string,
  anniversaryDate: Date,
  yearIndex: number,
): Promise<ContractRenewalResult | null> {
  return prisma.$transaction(
    async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id: contractId },
        include: {
          products: true,
          assigneA: { select: { tauxCommissionRenouvellement: true } },
          commissions: { select: { id: true } },
        },
      });
      if (!contract || contract.commissions.length === 0) return null;

      const commissionId = contract.commissions[0].id;
      const taux = Number(contract.assigneA.tauxCommissionRenouvellement);
      const commissionMensuelle = Number(contract.montantMensuel) * taux;
      const mensuelCents = chfToCents(Number(contract.montantMensuel));

      // 1. Renewal record
      await tx.renewal.create({
        data: {
          contractId,
          dateRenouvellement: anniversaryDate,
          statut: "RENOUVELE",
          commissionAn2Mensuelle: commissionMensuelle,
        },
      });

      // 2. 12 ClientInvoices mensualité pour la nouvelle année
      let invoicesCreated = 0;
      for (let m = 0; m < 12; m++) {
        const dateEmission = addMonthsKeepEndOfMonth(anniversaryDate, m);
        const periodeFin = new Date(dateEmission);
        periodeFin.setMonth(periodeFin.getMonth() + 1);
        periodeFin.setDate(periodeFin.getDate() - 1);
        const dateEcheance = new Date(dateEmission);
        dateEcheance.setDate(
          dateEcheance.getDate() + FACTURE_CLIENT_ECHEANCE_JOURS_DEFAULT,
        );

        const annee = dateEmission.getFullYear();
        const counter = await tx.counter.upsert({
          where: { scope_year: { scope: "client_invoice", year: annee } },
          create: { scope: "client_invoice", year: annee, value: 1 },
          update: { value: { increment: 1 } },
        });
        const facNumero = `${PREFIX_FACTURE_CLIENT}-${annee}-${String(counter.value).padStart(4, "0")}`;

        await tx.clientInvoice.create({
          data: {
            contractId,
            numero: facNumero,
            dateEmission,
            dateEcheance,
            type: "MENSUALITE",
            periodeMoisDebut: dateEmission,
            periodeMoisFin: periodeFin,
            sousTotal: contract.montantMensuel,
            totalTVA: 0,
            total: contract.montantMensuel,
            statut: "BROUILLON",
            lignes: {
              create: contract.products
                .filter((p) => p.prixMensuel)
                .map((p, idx) => ({
                  designation: `${p.nom} — renouvellement an ${yearIndex + 1}, mens. ${m + 1}/12`,
                  quantite: 1,
                  prixUnitaire: p.prixMensuel ?? 0,
                  montantHT: p.prixMensuel ?? 0,
                  tauxTVA: 0,
                  ordre: idx,
                  productId: p.id,
                })),
            },
          },
        });
        invoicesCreated++;
      }

      // 3. 12 CommissionPayment RENOUVELLEMENT en PREVU
      let commissionsCreated = 0;
      for (let m = 0; m < 12; m++) {
        const dateVersementPrevue = addMonthsKeepEndOfMonth(anniversaryDate, m);
        await tx.commissionPayment.create({
          data: {
            commissionId,
            typePart: "RENOUVELLEMENT",
            numeroMois: m + 1,
            montant: commissionMensuelle,
            dateVersementPrevue,
            statut: "PREVU",
          },
        });
        commissionsCreated++;
      }

      return {
        contractId,
        numero: contract.numero,
        yearIndex,
        invoicesCreated,
        commissionsCreated,
      };
    },
    { timeout: 30_000 },
  );
}

// ===========================================================================
// AUDIT — vérifie l'invariant total des commissions d'un contrat
// ===========================================================================
//
// Pour le rapport admin : pour chaque contrat actif, somme(montant des
// CommissionPayment SIGNATURE + ETALEMENT) doit être ≈ commission.montantTotal
// (à 1 centime près à cause des arrondis).
//
// Renvoie la liste des contrats avec un écart anormal.

export interface AuditMismatch {
  contractId: string;
  contractNumero: string;
  montantAttendu: number;
  montantEffectif: number;
  ecart: number;
}

export async function auditCommissions(): Promise<AuditMismatch[]> {
  const commissions = await prisma.commission.findMany({
    include: {
      contract: { select: { id: true, numero: true } },
      payments: {
        where: {
          typePart: { in: ["SIGNATURE", "ETALEMENT"] },
          statut: { in: ["PREVU", "PAYE"] },
        },
      },
    },
  });

  const mismatches: AuditMismatch[] = [];
  for (const c of commissions) {
    const attendu = Number(c.montantTotal);
    const effectif = c.payments.reduce((s, p) => s + Number(p.montant), 0);
    const ecart = Math.abs(attendu - effectif);
    if (ecart > 0.01) {
      mismatches.push({
        contractId: c.contract.id,
        contractNumero: c.contract.numero,
        montantAttendu: attendu,
        montantEffectif: effectif,
        ecart,
      });
    }
  }
  return mismatches;
}
