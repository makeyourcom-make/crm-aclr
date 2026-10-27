/**
 * Une action de la frise « Ta journée heure par heure ».
 *
 * Heure à gauche, point de frise, carte avec type, retard, XP en jeu,
 * entreprise (lien vers la fiche), sujet ; actions à droite :
 *   - appel avec numéro → Appeler (click-to-call existant, suivi d'appel)
 *   - RDV client → Voir RDV (fiche entreprise)
 *   - toujours → Marquer fait (markActivityDone + toast XP + refresh)
 *
 * Server-safe : seuls ClickToCall et DoneButton sont des îlots client.
 */
import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/arena/pills";
import type { TodayTask } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

import { CallButton } from "./call-button";
import { DoneButton } from "./done-button";
import { TASK_TYPE_META, TONE_BORDER_L, TONE_DOT } from "./task-meta";

interface TodayItemProps {
  task: TodayTask;
  /** L'action est dans le bloc « En retard » (fond rouge clair). */
  overdue?: boolean;
}

export function TodayItem({ task: t, overdue = false }: TodayItemProps) {
  const meta = TASK_TYPE_META[t.type];
  const late = overdue && !!t.retard;
  const name = t.prospect?.raisonSociale ?? t.sujet;
  const canCall = t.kind === "call" && !!t.prospect && !!t.prospect.telephone;

  return (
    <li className="flex items-stretch gap-2.5">
      {/* Heure */}
      <div
        className={cn(
          "w-11 shrink-0 pt-[18px] text-right tabular-nums sm:w-12",
          late ? "text-alert-700" : "text-foreground",
        )}
      >
        <div className="text-[13px] font-extrabold">{t.heure}</div>
        {late && t.retard?.veille && (
          <div className="text-[11px] font-bold opacity-90">{t.jour}</div>
        )}
      </div>

      {/* Frise */}
      <div aria-hidden="true" className="relative hidden w-3.5 shrink-0 sm:block">
        <span className="absolute inset-y-0 left-1.5 w-0.5 bg-border" />
        <span
          className={cn(
            "absolute top-[19px] left-0.5 size-2.5 rounded-full ring-2 ring-offset-2 ring-offset-card",
            late ? TONE_DOT.red : TONE_DOT[meta.tone],
          )}
        />
      </div>

      {/* Carte */}
      <div
        className={cn(
          "my-1 flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-[14px] border border-l-4 px-3.5 py-3",
          late
            ? "border-coral-100 border-l-alert-500 bg-coral-50"
            : cn("border-border bg-card", TONE_BORDER_L[meta.tone]),
        )}
      >
        <div className="min-w-0 flex-[1_1_240px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={meta.tone} dot={false}>
              {meta.label}
            </StatusPill>
            {t.rdvPasse ? (
              <StatusPill tone="red">Heure passée · à valider</StatusPill>
            ) : (
              late && <StatusPill tone="red">En retard · {t.retard!.label}</StatusPill>
            )}
            {t.xp > 0 && (
              <span className="ml-auto text-xs font-bold text-gold-700">+{t.xp} XP</span>
            )}
          </div>
          <div className="mt-1.5 text-[15px] leading-snug font-bold break-words">
            {t.prospect ? (
              <Link
                href={`/prospects/${t.prospect.id}`}
                className="text-foreground hover:underline"
              >
                {t.prospect.raisonSociale}
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Note interne</span>
            )}
            {t.prospect?.ville && (
              <span className="text-[13px] font-medium text-muted-foreground">
                {" "}
                · {t.prospect.ville}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] break-words text-muted-foreground">{t.sujet}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCall ? (
            <CallButton
              prospectId={t.prospect!.id}
              raisonSociale={t.prospect!.raisonSociale}
              telephone={t.prospect!.telephone!}
            />
          ) : t.kind === "rdv" && t.prospect ? (
            <Link
              href={`/prospects/${t.prospect.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-navy-700 px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-navy-600"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              Voir RDV
            </Link>
          ) : null}
          <DoneButton
            activityId={t.id}
            context={`${meta.label} ${name}`}
            xp={t.xp}
            xpLabel={meta.xpLabel}
            xpSub={t.prospect?.raisonSociale}
            future={t.rdvFutur}
          />
        </div>
      </div>
    </li>
  );
}
