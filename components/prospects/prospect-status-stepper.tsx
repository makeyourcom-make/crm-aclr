"use client";

/**
 * « Fais avancer la fiche · un clic » : étapes Contacté → Signé + issues
 * d'appel (Numéro invalide, Ne pas rappeler, Perdu) + sélecteur complet
 * (pour revenir à Nouveau / Vierge). Même action serveur que le sélecteur
 * historique : updateProspectStatut (droits vérifiés côté serveur).
 *
 * Changer un statut ne rapporte pas d'XP en soi : les XP viennent des
 * actions réelles (appel, RDV, proposition, signature). Pas de faux gain.
 */
import type { ProspectStatut } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateProspectStatut } from "@/app/(app)/prospects/actions";
import { cn } from "@/lib/utils";

import { ProspectStatutSelect } from "./prospect-statut-select";
import { STATUT_META, STEPPER_STEPS } from "./statut-meta";

const ISSUES: { statut: ProspectStatut; className: string }[] = [
  {
    statut: "NUMERO_INVALIDE",
    className: "border-dashed border-gold-500 bg-gold-50 text-gold-700",
  },
  {
    statut: "NE_PAS_RAPPELER",
    className: "border-alert-500 bg-alert-50 text-alert-700",
  },
  {
    statut: "PERDU",
    className: "border-border-strong bg-navy-50 text-muted-foreground",
  },
];

export function ProspectStatusStepper({
  prospectId,
  statut,
}: {
  prospectId: string;
  statut: ProspectStatut;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = STEPPER_STEPS.indexOf(statut);

  const setStatut = (next: ProspectStatut) => {
    if (next === statut || pending) return;
    startTransition(async () => {
      const res = await updateProspectStatut(prospectId, next);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`Fiche passée en « ${STATUT_META[next].label} ».`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2.5" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Fais avancer la fiche · un clic
        </span>
        <ProspectStatutSelect prospectId={prospectId} statut={statut} />
      </div>

      <ol className="grid grid-cols-5 gap-1" aria-label="Étapes de la fiche">
        {STEPPER_STEPS.map((s, i) => {
          const done = current >= 0 && i < current;
          const now = i === current;
          const signe = now && s === "SIGNE";
          return (
            <li key={s} className="min-w-0">
              <button
                type="button"
                onClick={() => setStatut(s)}
                disabled={pending}
                aria-pressed={now}
                title={now ? `Statut actuel : ${STATUT_META[s].label}` : `Passer en « ${STATUT_META[s].label} »`}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1.5 rounded-[10px] px-0.5 py-2 text-center text-[11px] leading-tight font-extrabold transition-colors disabled:opacity-60 sm:text-xs",
                  signe
                    ? "bg-win-700 text-white"
                    : now
                      ? "bg-navy-700 text-white"
                      : done
                        ? "bg-info-50 text-info-700 hover:bg-navy-100"
                        : "bg-ground text-muted-foreground hover:bg-navy-100 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-[5px] w-full rounded-full",
                    now ? "bg-coral-400" : done ? "bg-info-500" : "bg-border-strong",
                  )}
                />
                <span className="w-full break-words hyphens-auto">{STATUT_META[s].short}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Issue d&apos;appel :</span>
        {ISSUES.map((it) => {
          const active = statut === it.statut;
          return (
            <button
              key={it.statut}
              type="button"
              onClick={() => setStatut(it.statut)}
              disabled={pending}
              aria-pressed={active}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-bold transition-opacity hover:opacity-85 disabled:opacity-60",
                it.className,
                active && "ring-2 ring-navy-700 ring-offset-1",
              )}
            >
              {STATUT_META[it.statut].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
