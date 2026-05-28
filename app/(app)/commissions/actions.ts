"use server";

import { revalidatePath } from "next/cache";

import {
  auditCommissions,
  processOverdueEtalements,
} from "@/lib/commissions-engine";
import { requireAdmin, requireUser } from "@/lib/session";

export interface RecomputeResult {
  ok: boolean;
  total: number;
  message?: string;
  parCommerciale?: Array<{
    userId: string;
    userName: string;
    nbVersements: number;
    montantTotal: number;
  }>;
}

/**
 * Force le passage de tous les CommissionPayment ETALEMENT dont la date
 * prévue est passée à statut PAYE (acquis).
 *
 * Sera appelé automatiquement chaque nuit à 02:00 par le CRON (étape 27).
 * Utilisable manuellement par un admin entre temps.
 */
export async function recomputeOverdueEtalements(): Promise<RecomputeResult> {
  await requireUser(); // disponible à tous (mais sans danger : idempotent)

  try {
    const result = await processOverdueEtalements();
    revalidatePath("/contrats");
    revalidatePath("/commissions");
    revalidatePath("/aujourd-hui");
    if (result.total === 0) {
      return {
        ok: true,
        total: 0,
        message: "Aucun versement à mettre à jour.",
      };
    }
    return {
      ok: true,
      total: result.total,
      parCommerciale: result.parCommerciale,
      message: `${result.total} versement(s) marqué(s) acquis.`,
    };
  } catch (err) {
    console.error("[recomputeOverdueEtalements]", err);
    return { ok: false, total: 0, message: "Erreur serveur." };
  }
}

/**
 * Vérifie l'intégrité des commissions (somme versements ≈ montant total).
 * Admin only — sert d'audit comptable.
 */
export async function runCommissionAudit() {
  await requireAdmin();
  return auditCommissions();
}
