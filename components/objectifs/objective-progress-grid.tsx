/**
 * Grille « Objectifs du mois » : une carte par cible fixée (appels, contacts,
 * RDV, propositions, contrats, CA, commissions) avec valeur / objectif, jauge,
 * repère or « où tu devrais être aujourd'hui », projection fin de mois au
 * rythme actuel, statut de rythme et phrase coach.
 *
 * Partagée par la vue commerciale (/commissions, tutoiement) et le tableau
 * d'équipe de l'admin (/objectifs, phrasé neutre). Server-safe.
 */
import {
  CalendarCheck,
  Coins,
  FileCheck,
  Mail,
  Phone,
  Send,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { StatusPill } from "@/components/arena/pills";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import {
  formatMetricValue,
  metricCoach,
  PACE_META,
  type MetricKey,
  type MonthWindow,
  type ObjectiveMetric,
} from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

export const METRIC_META: Record<MetricKey, { icon: LucideIcon; tone: Tone }> = {
  appels: { icon: Phone, tone: "coral" },
  contacts: { icon: Mail, tone: "teal" },
  rdv: { icon: CalendarCheck, tone: "gold" },
  propositions: { icon: Send, tone: "violet" },
  signatures: { icon: FileCheck, tone: "navy" },
  ca: { icon: Trophy, tone: "green" },
  commission: { icon: Coins, tone: "gold" },
};

export interface ObjectiveProgressGridProps {
  metrics: ObjectiveMetric[];
  window: MonthWindow;
  audience: "me" | "admin";
  panierMoyen?: number | null;
  /** Cartes plus compactes (tableau d'équipe). */
  compact?: boolean;
  className?: string;
}

export function ObjectiveProgressGrid({
  metrics,
  window: w,
  audience,
  panierMoyen,
  compact = false,
  className,
}: ObjectiveProgressGridProps) {
  const markerPct = Math.round(w.timeRatio * 100);
  return (
    <div
      className={cn(
        "grid gap-3.5",
        compact
          ? "grid-cols-[repeat(auto-fit,minmax(180px,1fr))]"
          : "grid-cols-[repeat(auto-fit,minmax(200px,1fr))]",
        className,
      )}
    >
      {metrics.map((m) => {
        const meta = METRIC_META[m.key];
        const tone = TONE_CLASSES[meta.tone];
        const pace = PACE_META[m.status];
        const Icon = meta.icon;
        const barPct = Math.min(100, Math.max(0, m.pct));
        const valueTxt = formatMetricValue(m.value, m.unit);
        const targetTxt = formatMetricValue(m.target, m.unit);
        const projTxt = formatMetricValue(m.projection, m.unit);
        return (
          <article
            key={m.key}
            className={cn(
              "flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-border bg-card",
              compact ? "p-3.5" : "p-4",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
                  tone.bg,
                  tone.text,
                )}
              >
                <Icon className="size-[18px]" strokeWidth={2} />
              </span>
              <h3 className="min-w-0 flex-1 text-sm leading-tight font-bold text-foreground">
                {m.label}
              </h3>
            </div>
            <StatusPill tone={pace.tone} className="self-start">
              {pace.label}
            </StatusPill>
            <div
              className={cn(
                "score-number break-words text-foreground",
                compact ? "text-[26px]" : "text-[32px]",
              )}
            >
              {valueTxt}{" "}
              <span className="font-sans text-[15px] font-bold tracking-normal text-muted-foreground">
                / {targetTxt}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${m.label} : ${valueTxt} sur ${targetTxt}, ${m.pct} %. Repère du mois écoulé à ${markerPct} %.`}
              className="relative mt-1 h-2.5 rounded-full bg-navy-50"
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out motion-safe:animate-meter-fill",
                  pace.bar,
                )}
                style={{ width: `${barPct}%` }}
              />
              <div
                aria-hidden="true"
                className="absolute -top-1 h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-gold-500"
                style={{ left: `${markerPct}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs font-bold">
              <span className={cn("tabular-nums", m.status === "accelerer" ? "text-coral-600" : "text-foreground")}>
                {m.pct} %
              </span>
              <span className="text-muted-foreground">À ce rythme : {projTxt}</span>
            </div>
            <p className="text-[13px] leading-snug font-medium text-muted-foreground">
              {metricCoach(m, w, audience, panierMoyen)}
            </p>
          </article>
        );
      })}
    </div>
  );
}

/** Légende du repère or et de la projection (sous la grille). */
export function ObjectiveGridLegend({ window: w }: { window: MonthWindow }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-[3px] rounded-full bg-gold-500" />
        Repère or : où il faudrait être aujourd&apos;hui
      </span>
      <span>
        Projection = rythme actuel prolongé jusqu&apos;à la fin du mois (
        {w.workingDaysLeft} {w.workingDaysLeft >= 2 ? "jours ouvrés restants" : "jour ouvré restant"})
      </span>
    </div>
  );
}

/** Barre « Jour 19 / 22 ouvrés · 86 % du mois écoulé ». */
export function MonthTimeBar({
  window: w,
  onDark = false,
  className,
}: {
  window: MonthWindow;
  onDark?: boolean;
  className?: string;
}) {
  const pct = Math.round(w.timeRatio * 100);
  return (
    <div className={cn("flex min-w-[200px] flex-col gap-1.5", className)}>
      <div className="flex justify-between gap-3 text-xs font-bold">
        <span className={onDark ? "text-white" : "text-foreground"}>
          Jour {w.workingDaysElapsed} / {w.workingDaysTotal} ouvrés
        </span>
        <span className={onDark ? "text-navy-200" : "text-muted-foreground"}>
          {pct} % du mois écoulé
        </span>
      </div>
      <div
        role="img"
        aria-label={`${pct} % du mois écoulé`}
        className={cn("h-2 overflow-hidden rounded-full", onDark ? "bg-white/15" : "bg-navy-50")}
      >
        <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
