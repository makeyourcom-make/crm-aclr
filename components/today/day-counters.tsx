/**
 * « Compteurs du jour » : les 6 compteurs du moteur de jeu (mêmes chiffres
 * que la topbar et le dashboard) face à leurs objectifs du jour, avec la
 * comparaison au jour ouvré précédent à la même heure.
 *
 * Couleur des jauges (règle historique de la page) : rouge < 50 % ≤ or < 80 %
 * ≤ vert. Server-safe.
 */
import {
  CalendarCheck,
  CalendarPlus,
  Mail,
  MessageCircle,
  Phone,
  Send,
  type LucideIcon,
} from "lucide-react";

import { formatInt, pctOf } from "@/components/arena/format";
import { TrendChip } from "@/components/arena/stat-tile";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import type { DayCounters } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { toneForPct } from "./task-meta";

export interface DayTargets {
  appels: number;
  rdvPris: number;
  rdvEffectues: number;
  propositions: number;
  emails: number;
}

interface DayCountersProps {
  today: DayCounters;
  targets: DayTargets;
  /** Compteurs du jour ouvré précédent à la même heure. */
  veille: { label: string; compteurs: DayCounters } | null;
  /** RDV passés encore à valider (tuile RDV effectués). */
  rdvAValider: number;
}

interface Tile {
  key: keyof DayCounters;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  value: number;
  /** null = pas d'objectif (conversations : taux de décroché). */
  target: number | null;
  /** Pourcentage affiché (objectif ou taux). */
  pct: number;
  barLabel: string;
  note?: { text: string; tone: Tone };
}

export function DayCountersCard({ today, targets, veille, rdvAValider }: DayCountersProps) {
  const taux = pctOf(today.conversations, today.appels);
  const tiles: Tile[] = [
    {
      key: "appels",
      label: "Appels",
      icon: Phone,
      tone: "coral",
      value: today.appels,
      target: targets.appels,
      pct: pctOf(today.appels, targets.appels),
      barLabel: `Appels : ${formatInt(today.appels)} sur ${formatInt(targets.appels)}`,
    },
    {
      key: "conversations",
      label: "Conversations",
      icon: MessageCircle,
      tone: "blue",
      value: today.conversations,
      target: null,
      pct: taux,
      barLabel: `Taux de décroché : ${taux} %`,
      note: { text: `${taux} % de décroché`, tone: "navy" },
    },
    {
      key: "rdvPris",
      label: "RDV pris",
      icon: CalendarPlus,
      tone: "gold",
      value: today.rdvPris,
      target: targets.rdvPris,
      pct: pctOf(today.rdvPris, targets.rdvPris),
      barLabel: `RDV pris : ${formatInt(today.rdvPris)} sur ${formatInt(targets.rdvPris)}`,
    },
    {
      key: "rdvEffectues",
      label: "RDV effectués",
      icon: CalendarCheck,
      tone: "gold",
      value: today.rdvEffectues,
      target: targets.rdvEffectues,
      pct: pctOf(today.rdvEffectues, targets.rdvEffectues),
      barLabel: `RDV effectués : ${formatInt(today.rdvEffectues)} sur ${formatInt(targets.rdvEffectues)}`,
      note:
        rdvAValider > 0
          ? { text: `${formatInt(rdvAValider)} à valider · heure passée`, tone: "red" }
          : undefined,
    },
    {
      key: "propositions",
      label: "Propositions",
      icon: Send,
      tone: "violet",
      value: today.propositions,
      target: targets.propositions,
      pct: pctOf(today.propositions, targets.propositions),
      barLabel: `Propositions : ${formatInt(today.propositions)} sur ${formatInt(targets.propositions)}`,
    },
    {
      key: "emails",
      label: "Emails",
      icon: Mail,
      tone: "teal",
      value: today.emails,
      target: targets.emails,
      pct: pctOf(today.emails, targets.emails),
      barLabel: `Emails : ${formatInt(today.emails)} sur ${formatInt(targets.emails)}`,
    },
  ];

  return (
    <section
      aria-labelledby="compteurs-titre"
      className="flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-border bg-card p-5 shadow-arena"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="compteurs-titre"
          className="font-display text-lg font-extrabold tracking-[-0.02em] text-foreground"
        >
          Compteurs du jour
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          objectif{veille ? ` · vs ${veille.label}` : ""}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          const tc = TONE_CLASSES[t.tone];
          const pctTone = t.target === null ? t.tone : toneForPct(t.pct);
          const prev = veille ? veille.compteurs[t.key] : null;
          return (
            <li
              key={t.key}
              className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-border p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-[26px] shrink-0 items-center justify-center rounded-[8px]",
                    tc.bg,
                    tc.text,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 truncate text-xs font-bold text-muted-foreground">
                  {t.label}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1">
                <span className="score-number text-[28px] text-foreground">
                  {formatInt(t.value)}
                </span>
                {t.target !== null && (
                  <span className="text-[13px] font-bold text-muted-foreground">
                    / {formatInt(t.target)}
                  </span>
                )}
                <span
                  className={cn(
                    "ml-auto text-xs font-extrabold tabular-nums",
                    TONE_CLASSES[pctTone].text,
                  )}
                >
                  {t.pct} %
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t.barLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(t.pct, 100)}
                className="h-1.5 overflow-hidden rounded-full bg-navy-50"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out",
                    TONE_CLASSES[pctTone].solid,
                  )}
                  style={{ width: `${Math.min(t.pct, 100)}%` }}
                />
              </div>
              <div className="flex min-h-5 flex-wrap items-center gap-1">
                {t.note ? (
                  <span className={cn("text-xs font-semibold", TONE_CLASSES[t.note.tone].text)}>
                    {t.note.text}
                  </span>
                ) : prev !== null ? (
                  <TrendChip value={t.value - prev} label={`vs ${veille!.label}`} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
