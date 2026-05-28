"use client";

/**
 * Bouton admin "Recalculer les commissions échues".
 *
 * Force le passage de tous les CommissionPayment ETALEMENT dont la date
 * prévue est passée à statut PAYE (acquis). Sera automatique chaque nuit
 * via CRON (étape 27) — bouton manuel pour tester / rattraper.
 */
import { useTransition } from "react";
import { toast } from "sonner";

import { recomputeOverdueEtalements } from "@/app/(app)/commissions/actions";

export function RecomputeButton() {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const res = await recomputeOverdueEtalements();
      if (!res.ok) {
        toast.error(res.message ?? "Échec.");
        return;
      }
      if (res.total === 0) {
        toast.info(res.message ?? "Rien à mettre à jour.");
        return;
      }
      toast.success(res.message ?? "Recalcul effectué.", {
        description: res.parCommerciale
          ?.map((c) => `${c.userName} : ${c.nbVersements} versement(s)`)
          .join(" · "),
      });
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted transition-colors disabled:opacity-50"
      title="Force la mise à jour des CommissionPayment dont la date est échue. Tâche automatique chaque nuit via CRON."
    >
      {pending ? "Recalcul…" : "🔄 Recalculer"}
    </button>
  );
}
