"use client";

/**
 * Bouton « Reconduction automatique » sur la fiche contrat.
 *
 * OFF → CTA « Activer la reconduction automatique » : le contrat continue tout
 *   seul mois par mois, sort de « renouvellements à sécuriser » et son mensuel
 *   est compté comme revenu récurrent chaque mois.
 * ON  → état confirmé + bouton « Désactiver » (repasse en échéance à sécuriser).
 *
 * Résiliable à tout moment par ailleurs (bouton Résilier).
 */
import { Repeat, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setReconductionAuto } from "@/app/(app)/contrats/actions";

interface Props {
  contractId: string;
  actif: boolean;
}

export function ReconductionAutoToggle({ contractId, actif }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    if (pending) return;
    startTransition(async () => {
      const res = await setReconductionAuto({ contractId, actif: next });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur lors de la mise à jour.");
        return;
      }
      toast.success(
        next
          ? "Reconduction automatique activée : revenu mensuel récurrent, plus d'échéance à sécuriser."
          : "Reconduction automatique désactivée : le contrat repasse en échéance à sécuriser.",
      );
      router.refresh();
    });
  };

  if (actif) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-win-50 px-3 py-1 text-xs font-bold text-win-700">
          <Repeat aria-hidden="true" className="size-3.5" />
          Reconduction automatique active
        </span>
        <button
          type="button"
          onClick={() => toggle(false)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          {pending ? "..." : "Désactiver"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(true)}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-[12px] bg-win-500 px-4 py-2 text-sm font-extrabold text-white shadow-arena transition-[filter] hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Repeat aria-hidden="true" className="size-[18px]" />
      {pending ? "..." : "Activer la reconduction automatique"}
    </button>
  );
}
