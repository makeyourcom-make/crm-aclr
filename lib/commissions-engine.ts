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
 * Cf user request : "le paiement de Sophie n'a lieu qu'une fois par mois".
 */
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
// TRIGGER RENEWAL COMMISSION (an 2+)
// ===========================================================================
//
// Quand une mensualité client (Payment) est encaissée pour un contrat qui a
// déjà passé son 1er anniversaire (= dans son 2e an), un versement de
// commission RENOUVELLEMENT au taux de 10% du montantMensuel doit être
// versé à la commerciale.
//
// Cette fonction est appelable depuis l'action `createPayment` OU
// `markPaymentEncaisse` — au moment où un Payment passe à ENCAISSE.

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

  // Charge contract + commission + user
  const contract = await db.contract.findUnique({
    where: { id: params.contractId },
    select: {
      id: true,
      dateSignature: true,
      montantMensuel: true,
      assigneAId: true,
      statut: true,
      assigneA: {
        select: { tauxCommissionRenouvellement: true },
      },
      commissions: {
        select: { id: true },
      },
    },
  });
  if (!contract) {
    return { created: false, amount: 0, reason: "Contrat introuvable." };
  }
  if (contract.statut !== "ACTIF") {
    return { created: false, amount: 0, reason: "Contrat non actif." };
  }

  // Vérifie qu'on est bien en an 2+ (12 mois après dateSignature)
  const an2Date = new Date(contract.dateSignature);
  an2Date.setMonth(an2Date.getMonth() + 12);
  if (params.paymentDate < an2Date) {
    return {
      created: false,
      amount: 0,
      reason: "Encore en an 1 (pas de commission renouvellement).",
    };
  }

  if (contract.commissions.length === 0) {
    return { created: false, amount: 0, reason: "Pas de commission existante." };
  }

  const taux = Number(contract.assigneA.tauxCommissionRenouvellement);
  const montantMensuel = Number(contract.montantMensuel);
  const montantCommission = montantMensuel * taux;

  await db.commissionPayment.create({
    data: {
      commissionId: contract.commissions[0].id,
      typePart: "RENOUVELLEMENT",
      montant: montantCommission,
      dateVersementPrevue: params.paymentDate,
      dateVersement: params.paymentDate,
      statut: "PAYE", // acquis immédiatement à l'encaissement client
      numeroMois: null,
    },
  });

  return { created: true, amount: montantCommission };
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
