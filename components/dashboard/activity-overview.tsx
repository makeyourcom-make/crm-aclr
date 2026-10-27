"use client";

/**
 * « Ton activité » : appels, conversations, RDV pris, RDV effectués,
 * propositions, emails sur le jour / la semaine / le mois, avec tendance vs la
 * période précédente (à date équivalente) et entonnoir de conversion
 * (appel, conversation, RDV, signature).
 *
 * Les 3 périodes sont calculées côté serveur (getActivityPeriods) : la bascule
 * Jour / Semaine / Mois est instantanée, sans aller-retour serveur.
 */
import {
  BarChart3,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { formatInt } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { TrendChip } from "@/components/arena/stat-tile";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { formatPercent } from "@/lib/format";
import type { DayCounters } from "@/lib/gamification/rules";
import type { ActivityPeriod, ActivityPeriodKey } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

export interface PeriodObjectives {
  appels?: number | null;
  rdvPris?: number | null;
  rdvEffectues?: number | null;
  propositions?: number | null;
}

interface TileDef {
  key: keyof DayCounters;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  objKey?: keyof PeriodObjectives;
  sub?: (c: DayCounters) => string;
}

function ratioTxt(num: number, den: number): string {
  return den > 0 ? formatPercent(num / den, 1) : "-";
}

const TILES: TileDef[] = [
  {
    key: "appels",
    label: "Appels",
    icon: Phone,
    tone: "coral",
    objKey: "appels",
  },
  {
    key: "conversations",
    label: "Conversations",
    icon: MessageCircle,
    tone: "blue",
    sub: (c) => `${ratioTxt(c.conversations, c.appels)} de décroché`,
  },
  {
    key: "rdvPris",
    label: "RDV pris",
    icon: CalendarPlus,
    tone: "gold",
    objKey: "rdvPris",
    sub: (c) => `${ratioTxt(c.rdvPris, c.appels)} des appels`,
  },
  {
    key: "rdvEffectues",
    label: "RDV effectués",
    icon: CalendarCheck,
    tone: "green",
    objKey: "rdvEffectues",
  },
  {
    key: "propositions",
    label: "Propositions",
    icon: Send,
    tone: "violet",
    objKey: "propositions",
  },
  {
    key: "emails",
    label: "Emails envoyés",
    icon: Mail,
    tone: "teal",
  },
];

export function ActivityOverview({
  periods,
  objectifs,
}: {
  periods: ActivityPeriod[];
  objectifs: Partial<Record<ActivityPeriodKey, PeriodObjectives>>;
}) {
  const [periode, setPeriode] = useState<ActivityPeriodKey>("jour");
  const p = periods.find((x) => x.key === periode) ?? periods[0];
  if (!p) return null;
  const obj = objectifs[p.key] ?? {};
  const c = p.current;

  return (
    <SectionCard
      title="Ton activité"
      icon={BarChart3}
      tone="green"
      description={p.sousTitre}
      action={
        <div
          role="group"
          aria-label="Période d'activité"
          className="flex gap-1 rounded-[12px] bg-navy-50 p-1"
        >
          {periods.map((x) => {
            const on = x.key === p.key;
            return (
              <button
                key={x.key}
                type="button"
                aria-pressed={on}
                onClick={() => setPeriode(x.key)}
                className={cn(
                  "h-9 min-w-[72px] rounded-[10px] px-3 text-[13px] font-extrabold transition-colors sm:min-w-[84px] sm:px-4",
                  on
                    ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(14,25,54,0.14)]"
                    : "text-foreground hover:bg-card",
                )}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      }
      contentClassName="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {TILES.map((t) => {
          const value = c[t.key];
          const target = t.objKey ? (obj[t.objKey] ?? null) : null;
          const hasTarget = target !== null && target > 0;
          const pct = hasTarget ? Math.min(100, Math.round((value / target) * 100)) : 0;
          const reached = hasTarget && value >= target;
          const tone = TONE_CLASSES[t.tone];
          const Icon = t.icon;
          return (
            <div
              key={t.key}
              className="flex min-w-0 flex-col gap-2.5 rounded-[16px] border border-border p-3 sm:p-4"
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
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 text-[13px] leading-tight font-bold text-muted-foreground">
                  {t.label}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="score-number text-[30px] text-foreground sm:text-[40px]">
                  {formatInt(value)}
                </span>
                {hasTarget && (
                  <span className="text-sm font-bold text-muted-foreground tabular-nums">
                    / {formatInt(target)}
                  </span>
                )}
              </div>
              {hasTarget && (
                <div
                  role="progressbar"
                  aria-label={`${t.label} : progression vers l'objectif`}
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-valuenow={Math.min(value, target)}
                  aria-valuetext={`${formatInt(value)} sur ${formatInt(target)}, ${pct} %`}
                  className="h-2 overflow-hidden rounded-full bg-navy-50"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700",
                      reached ? "bg-win-500" : tone.solid,
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <TrendChip value={value - p.previous[t.key]} label={p.compareLabel} />
                {t.sub && (
                  <span className="text-xs font-semibold text-muted-foreground">{t.sub(c)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-ground px-4 py-3.5">
        <span className="mr-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Conversion
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-bold">
          Taux de décroché{" "}
          <strong className="text-info-700">{ratioTxt(c.conversations, c.appels)}</strong>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-subtle" />
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-bold">
          Conversation vers RDV{" "}
          <strong className="text-gold-700">{ratioTxt(c.rdvPris, c.conversations)}</strong>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-subtle" />
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-bold">
          Appel vers RDV{" "}
          <strong className="text-gold-700">{ratioTxt(c.rdvPris, c.appels)}</strong>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-subtle" />
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-bold">
          RDV effectué vers signature{" "}
          <strong className="text-win-700">{ratioTxt(c.signatures, c.rdvEffectues)}</strong>
        </span>
      </div>
    </SectionCard>
  );
}
