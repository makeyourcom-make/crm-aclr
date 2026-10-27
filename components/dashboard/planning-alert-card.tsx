/**
 * Alerte « Planning de production » (tâches du jour + retards) : carte
 * cliquable vers le planning du jour. Rouge au-delà d'un mois de retard
 * (règle validée avec Arthur), or s'il y a du retard, bleu sinon.
 * Server-safe.
 */
import { ArrowRight, CalendarRange } from "lucide-react";
import Link from "next/link";

import { plural } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { cn } from "@/lib/utils";

export interface PlanningAlertes {
  aujourdhui: number;
  enRetard: number;
  critiques: number;
}

export function PlanningAlertCard({
  planning,
  className,
}: {
  planning: PlanningAlertes;
  className?: string;
}) {
  const { aujourdhui, enRetard, critiques } = planning;
  const accent =
    critiques > 0
      ? "border-l-alert-500"
      : enRetard > 0
        ? "border-l-gold-500"
        : "border-l-info-500";
  const resumeTone =
    critiques > 0 ? "text-alert-700" : enRetard > 0 ? "text-gold-700" : "text-info-700";
  const resume =
    critiques > 0
      ? `${plural(critiques, "tâche")} avec plus d'un mois de retard`
      : enRetard > 0
        ? `${plural(enRetard, "tâche")} en retard à rattraper`
        : `${plural(aujourdhui, "tâche")} prévue${aujourdhui > 1 ? "s" : ""} aujourd'hui`;

  return (
    <Link
      href="/dossiers/planning?vue=jour"
      className={cn(
        "group flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-l-[6px] border-border bg-card p-4 text-card-foreground shadow-arena transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-arena-lg sm:p-5",
        accent,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-lvl-50 text-lvl-700"
          >
            <CalendarRange className="size-[18px]" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-base font-extrabold text-foreground">
              Planning de production
            </h3>
            <span className={cn("text-[13px] font-semibold", resumeTone)}>{resume}</span>
          </div>
        </div>
        <span className="shrink-0 text-right">
          <span className="score-number block text-[28px] text-foreground">{aujourdhui}</span>
          <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            aujourd&apos;hui
          </span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusPill tone="blue">
          {plural(aujourdhui, "tâche")} aujourd&apos;hui
        </StatusPill>
        {enRetard > 0 && <StatusPill tone="gold">{enRetard} en retard</StatusPill>}
        {critiques > 0 && (
          <StatusPill tone="red">
            {critiques} avec plus d&apos;un mois de retard
          </StatusPill>
        )}
      </div>

      <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-info-700 group-hover:underline">
        Voir mes tâches du jour
        <ArrowRight aria-hidden="true" className="size-4" />
      </span>
    </Link>
  );
}
