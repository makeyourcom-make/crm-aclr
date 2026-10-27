"use client";

/**
 * Agenda : vue Mois (grille calendaire 6 × 7).
 *
 * Chaque case = un jour : numéro, carte de chaleur des RDV clients (rose =
 * jour ouvré à remplir, or = 1 RDV, vert = 2 RDV et plus) et pastilles
 * d'événements (heure + titre, sur grand écran). Clic sur un jour ou un
 * événement → vue Jour correspondante (filtres conservés).
 */
import Link from "next/link";

import { Meter } from "@/components/arena/meter";
import {
  capitalize,
  formatKeyLong,
  formatMonth,
  monthOfKey,
  zDayKey,
  zTime,
} from "@/lib/queries/agenda-dates";
import { cn } from "@/lib/utils";

import {
  AGENDA_HEX,
  TYPE_META,
} from "./agenda-style";

import type { AgendaActivity, DayRdvCount } from "@/lib/queries/agenda";

const WEEKDAY_SHORT = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];
const MAX_CHIPS = 3;

interface MonthViewProps {
  /** 42 jours (6 semaines) couvrant le mois, clés « AAAA-MM-JJ ». */
  dayKeys: string[];
  /** Mois ciblé « AAAA-MM » : les jours hors mois sont grisés. */
  targetMonth: string;
  activities: AgendaActivity[];
  /** RDV clients par jour (carte de chaleur). */
  dayCounts: Record<string, DayRdvCount>;
  nowKey: string;
  /** Lien vers la vue Jour d'une date (préserve les filtres actifs). */
  dayHref: (key: string) => string;
  /** Libellé de la personne (« tu » ou nom), pour la phrase de projection. */
  you: boolean;
}

export function MonthView({
  dayKeys,
  targetMonth,
  activities,
  dayCounts,
  nowKey,
  dayHref,
  you,
}: MonthViewProps) {
  // Groupe les activités par jour (triées par heure)
  const byDay: Record<string, AgendaActivity[]> = {};
  for (const a of activities) {
    const k = zDayKey(a.date);
    (byDay[k] ??= []).push(a);
  }
  for (const k of Object.keys(byDay)) {
    byDay[k].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
  }

  // Synthèse du mois (RDV clients)
  let total = 0;
  let fait = 0;
  let manque = 0;
  let aJouer = 0;
  for (const [k, c] of Object.entries(dayCounts)) {
    if (monthOfKey(k) !== targetMonth) continue;
    total += c.total;
    fait += c.fait;
    manque += c.manque;
    if (k >= nowKey) aJouer += Math.max(0, c.total - c.fait - c.manque);
  }
  const presence = fait + manque > 0 ? Math.round((fait / (fait + manque)) * 100) : null;
  const monthName = formatMonth(`${targetMonth}-01`);
  const isPastMonth = targetMonth < monthOfKey(nowKey);
  const isFutureMonth = targetMonth > monthOfKey(nowKey);
  const projection = isFutureMonth
    ? total > 0
      ? `${total} RDV déjà calés : la suite s'écrit au phoning.`
      : `Rien de calé pour l'instant en ${monthName}.`
    : isPastMonth
      ? `${capitalize(monthName)} bouclé à ${fait} RDV effectués.`
      : aJouer > 0
        ? `Encore ${aJouer} RDV à jouer d'ici la fin du mois : s'ils sont tous honorés, ${you ? `tu boucles ${monthName}` : `${monthName} se boucle`} à ${fait + aJouer} RDV effectués.`
        : `${fait} RDV effectués ce mois-ci. Une session d'appels et la suite se remplit.`;

  // On n'affiche pas la 6e semaine si elle est entièrement hors du mois.
  const shown =
    dayKeys.length === 42 && monthOfKey(dayKeys[35]) !== targetMonth
      ? dayKeys.slice(0, 35)
      : dayKeys;

  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <Meter
            value={fait}
            max={Math.max(total, 1)}
            tone="green"
            label={`${total} RDV calés en ${monthName} · ${fait} effectués${presence !== null ? ` · présence ${presence} %` : ""}`}
            valueLabel={`${fait} / ${total}`}
            size="lg"
          />
          <p className="text-xs font-semibold text-muted-foreground">{projection}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
          <LegendSwatch bg="#FFF1F1" border="#F47174" label="Jour à remplir" />
          <LegendSwatch bg="#FFF4DC" border="#F5A524" label="1 RDV" />
          <LegendSwatch bg="#E3F7EB" border="#12A150" label="2 RDV et plus" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_SHORT.map((label) => (
          <span
            key={label}
            className="px-0.5 text-[10px] font-bold tracking-[0.06em] text-muted-foreground sm:px-1 sm:text-[11px]"
          >
            {label}
          </span>
        ))}
        {shown.map((key, idx) => {
          const inMonth = monthOfKey(key) === targetMonth;
          const weekend = idx % 7 >= 5;
          const isToday = key === nowKey;
          const isPast = key < nowKey;
          const n = dayCounts[key]?.total ?? 0;
          const items = byDay[key] ?? [];
          const extra = items.length - MAX_CHIPS;
          const heat = !inMonth
            ? "bg-ground"
            : weekend
              ? "bg-card"
              : n === 0
                ? "bg-coral-50"
                : n === 1
                  ? "bg-gold-50"
                  : "bg-win-50";
          const pillTx = n >= 2 ? "text-win-700" : n === 1 ? "text-gold-700" : "text-alert-700";
          // Pastille = RDV clients. Un jour qui n'a que des activités hors
          // client (formation, point interne) n'est pas étiqueté « vide ».
          const pill =
            n > 0
              ? `${n} RDV`
              : !inMonth || weekend || items.length > 0
                ? null
                : isPast
                  ? "Vide"
                  : "À remplir";
          return (
            <div
              key={key}
              className={cn(
                "relative flex min-h-[64px] min-w-0 flex-col gap-1 rounded-[12px] border p-1.5 sm:min-h-[104px] sm:p-2",
                heat,
                isToday ? "border-2 border-coral-600" : "border-border",
              )}
            >
              <Link
                href={dayHref(key)}
                scroll={false}
                aria-label={`${formatKeyLong(key)} : ${n} RDV, ouvrir la journée`}
                className="absolute inset-0 z-0 rounded-[11px] transition-colors hover:bg-navy-700/5"
              />
              <div className="pointer-events-none relative flex items-start justify-between gap-1">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full font-display text-sm font-extrabold tabular-nums sm:size-7 sm:text-base",
                    isToday
                      ? "bg-coral-600 text-white"
                      : !inMonth || weekend
                        ? "text-muted-foreground"
                        : "text-foreground",
                  )}
                >
                  {Number(key.slice(8, 10))}
                </span>
                {pill && (
                  <span
                    className={cn(
                      "hidden max-w-full truncate rounded-full bg-card px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap sm:inline-block",
                      pillTx,
                    )}
                  >
                    {pill}
                  </span>
                )}
              </div>
              {/* Téléphone : points (1 par RDV, 3 max) */}
              {n > 0 && (
                <span aria-hidden="true" className="pointer-events-none relative flex gap-0.5 sm:hidden">
                  {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                    <span
                      key={i}
                      className={cn("size-1.5 rounded-full", n >= 2 ? "bg-win-700" : "bg-gold-700")}
                    />
                  ))}
                </span>
              )}
              {/* Grand écran : pastilles d'événements */}
              <div className="relative z-10 hidden min-w-0 flex-col gap-0.5 sm:flex">
                {items.slice(0, MAX_CHIPS).map((a) => (
                  <Link
                    key={a.id}
                    href={dayHref(key)}
                    scroll={false}
                    className={cn(
                      "flex min-w-0 items-center gap-1 rounded-[6px] bg-card/80 px-1 py-0.5 text-[11px] leading-tight hover:bg-card",
                      a.statut === "ANNULE" && "line-through opacity-70",
                    )}
                    title={`${zTime(a.date)} · ${a.sujet}`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: a.couleur ?? AGENDA_HEX[TYPE_META[a.type].tone].solid }}
                    />
                    <span className="font-bold text-foreground tabular-nums">{zTime(a.date)}</span>
                    <span className="truncate font-semibold text-muted-foreground">
                      {a.prospect?.raisonSociale ?? a.sujet}
                    </span>
                  </Link>
                ))}
                {extra > 0 && (
                  <Link
                    href={dayHref(key)}
                    scroll={false}
                    className="px-1 text-[11px] font-bold text-info-700 hover:underline"
                  >
                    +{extra} autre{extra > 1 ? "s" : ""}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendSwatch({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-3.5 rounded-[4px] border"
        style={{ background: bg, borderColor: border }}
      />
      {label}
    </span>
  );
}
