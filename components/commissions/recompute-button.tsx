"use client";

/**
 * Bouton admin "Recalculer les commissions échues".
 *
 * Force le passage de tous les CommissionPayment ETALEMENT dont la date
 * prévue est passée à statut PAYE (acquis). Sera automatique chaque nuit
 * via CRON (étape 27) : bouton manuel pour tester / rattraper.
 *
 * Utilisé aussi sur la fiche contrat (/contrats/[id]) : même API, sans props.
 */
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { recomputeOverdueEtalements } from "@/app/(app)/commissions/actions";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      title="Force la mise à jour des CommissionPayment dont la date est échue. Tâche automatique chaque nuit via CRON."
    >
      <RefreshCw aria-hidden="true" className={pending ? "animate-spin" : undefined} />
      {pending ? "Recalcul…" : "Recalculer"}
    </Button>
  );
}
