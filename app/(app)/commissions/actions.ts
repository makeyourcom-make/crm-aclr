"use server";

import { revalidatePath } from "next/cache";

import {
  auditCommissions,
  processContractAnniversaries,
  processOverdueEtalements,
} from "@/lib/commissions-engine";
import { requireAdmin, requireUser } from "@/lib/session";

export interface RecomputeResult {
  ok: boolean;
  total: number;
  message?: string;
  renewalsProcessed?: number;
  parCommerciale?: Array<{
    userId: string;
    userName: string;
    nbVersements: number;
    montantTotal: number;
  }>;
}

/**
 * Tâche périodique appelée par le CRON nocturne (étape 27) ou manuellement
 * par un admin :
 *   1. Traite tous les anniversaires de contrats (auto-renouvellement)
 *      → crée Renewal + 12 ClientInvoices + 12 CommissionPayment RENOUVELLEMENT
 *   2. Passe à PAYE les CommissionPayment ETALEMENT dont la date est échue
 *
 * Idempotent : peut être appelé plusieurs fois sans effet de bord.
 */
export async function recomputeOverdueEtalements(): Promise<RecomputeResult> {
  await requireUser(); // sans danger : idempotent

  try {
    // 1. Auto-renouvellements en premier (générera les CommissionPayment
    //    qu'on traitera potentiellement ensuite si leur date est aussi échue)
    const renewals = await processContractAnniversaries();

    // 2. Étalements et renouvellements échus → acquis
    const result = await processOverdueEtalements();

    revalidatePath("/contrats");
    revalidatePath("/commissions");
    revalidatePath("/aujourd-hui");
    revalidatePath("/renouvellements");
    revalidatePath("/factures-clients");

    const pieces: string[] = [];
    if (renewals.length > 0) {
      pieces.push(`${renewals.length} contrat(s) renouvelé(s)`);
    }
    if (result.total > 0) {
      pieces.push(`${result.total} versement(s) acquis`);
    }
    return {
      ok: true,
      total: result.total,
      renewalsProcessed: renewals.length,
      parCommerciale: result.parCommerciale,
      message: pieces.length > 0
        ? pieces.join(" + ")
        : "Aucune mise à jour nécessaire.",
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
