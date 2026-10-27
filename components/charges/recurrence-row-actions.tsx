"use client";

import { Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteRecurrence,
  toggleRecurrenceActive,
} from "@/app/(app)/charges/recurrences/actions";

const ICON_BTN =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border-strong bg-card transition-colors disabled:opacity-50";

export function RecurrenceRowActions({
  id,
  actif,
  label,
}: {
  id: string;
  actif: boolean;
  /** Libellé du modèle (pour les noms accessibles des boutons). */
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () => {
    start(async () => {
      const res = await toggleRecurrenceActive(id);
      if (!res.ok) {
        toast.error(("error" in res ? res.error : null) ?? "Erreur");
        return;
      }
      toast.success(actif ? "Récurrence suspendue." : "Récurrence réactivée.");
      router.refresh();
    });
  };

  const del = () => {
    if (
      !confirm(
        "Supprimer cette récurrence ? Les charges déjà générées ne seront pas supprimées.",
      )
    )
      return;
    start(async () => {
      await deleteRecurrence(id);
      toast.success("Récurrence supprimée.");
      router.refresh();
    });
  };

  const suffix = label ? ` : ${label}` : "";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={actif ? "Suspendre" : "Réactiver"}
        aria-label={`${actif ? "Suspendre" : "Réactiver"} la récurrence${suffix}`}
        className={`${ICON_BTN} text-foreground hover:bg-navy-50`}
      >
        {actif ? (
          <Pause aria-hidden="true" className="size-4" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
      </button>
      <button
        type="button"
        onClick={del}
        disabled={pending}
        title="Supprimer"
        aria-label={`Supprimer la récurrence${suffix}`}
        className={`${ICON_BTN} text-muted-foreground hover:border-alert-500/40 hover:bg-alert-50 hover:text-alert-700`}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
