"use client";

/**
 * Cartes latérales de l'agenda : prochains RDV clients et mini-calendrier
 * du mois (points = RDV clients par jour).
 */
import { CalendarDays, Flame } from "lucide-react";
import Link from "next/link";

import { SectionCard } from "@/components/arena/section-card";
import {
  addDaysKey,
  capitalize,
  countdownLabel,
  dowOfKey,
  formatKeyLong,
  formatMonth,
  JOURS_ABBR,
  mondayOfKey,
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

// ---------------------------------------------------------------------------
// Prochains RDV
// ---------------------------------------------------------------------------

export function UpcomingCard({
  upcoming,
  aVenirSemaine,
  joursSansRdv,
  nowMs,
  selectedId,
  showOwner,
  you,
  onOpen,
}: {
  upcoming: AgendaActivity[];
  aVenirSemaine: number;
  joursSansRdv: number;
  nowMs: number;
  selectedId: string | null;
  showOwner: boolean;
  you: boolean;
  onOpen: (a: AgendaActivity) => void;
}) {
  const nudge =
    joursSansRdv > 0
      ? `${joursSansRdv === 1 ? "Il reste 1 jour ouvré" : `Il reste ${joursSansRdv} jours ouvrés`} sans RDV cette semaine : ${you ? "lance une session d'appels pour" : "une session d'appels pour"} ${joursSansRdv === 1 ? "le" : "les"} remplir.`
      : "Semaine bien remplie. Garde le rythme au phoning.";
  return (
    <SectionCard
      title="Prochains RDV"
      icon={CalendarDays}
      tone="gold"
      description={`${aVenirSemaine} à venir d'ici dimanche`}
      contentClassName="flex flex-col gap-3"
    >
      {upcoming.length === 0 ? (
        <p className="text-[13px] font-semibold text-muted-foreground">
          Aucun RDV client à venir. Une session d&apos;appels et ça repart.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((a) => {
            const key = zDayKey(a.date);
            const meta = TYPE_META[a.type];
            const hex = AGENDA_HEX[meta.tone];
            const TIcon = meta.icon;
            const sel = selectedId === a.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => onOpen(a)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] border-[1.5px] p-2.5 text-left transition-colors",
                    sel ? "border-navy-700 bg-ground" : "border-border bg-card hover:bg-ground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="flex w-12 shrink-0 flex-col items-center rounded-[12px] py-1.5"
                    style={{ background: hex.soft, color: hex.text }}
                  >
                    <span className="text-[10px] font-extrabold tracking-[0.06em]">{JOURS_ABBR[dowOfKey(key)]}</span>
                    <span className="font-display text-lg leading-tight font-extrabold">
                      {Number(key.slice(8, 10))}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold text-foreground">
                      {a.prospect?.raisonSociale ?? a.sujet}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <TIcon aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.4} />
                      <span className="truncate">
                        {zTime(a.date)} · {meta.short}
                        {a.prospect?.ville ? ` · ${a.prospect.ville}` : ""}
                        {showOwner && a.user ? ` · ${a.user.name.split(" ")[0]}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-foreground">
                    {countdownLabel(new Date(a.date).getTime(), nowMs)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/phoning"
        className="flex items-center gap-2.5 rounded-[14px] bg-coral-50 px-3.5 py-3 text-[13px] leading-snug font-bold text-coral-600 transition-colors hover:bg-coral-100"
      >
        <Flame aria-hidden="true" className="size-[18px] shrink-0" />
        <span>{nudge}</span>
      </Link>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Mini-calendrier du mois
// ---------------------------------------------------------------------------

export function MiniMonthCard({
  refKey,
  nowKey,
  dayCounts,
  dayHref,
  highlightWeek,
}: {
  refKey: string;
  nowKey: string;
  dayCounts: Record<string, DayRdvCount>;
  dayHref: (key: string) => string;
  /** Souligne la semaine affichée (vue semaine / jour). */
  highlightWeek: boolean;
}) {
  const month = monthOfKey(refKey);
  const first = `${month}-01`;
  const gridStart = mondayOfKey(first);
  let keys = Array.from({ length: 42 }, (_, i) => addDaysKey(gridStart, i));
  if (monthOfKey(keys[35]) !== month) keys = keys.slice(0, 35);
  const weekStart = mondayOfKey(refKey);
  const weekEnd = addDaysKey(weekStart, 6);

  let fait = 0;
  for (const [k, c] of Object.entries(dayCounts)) if (monthOfKey(k) === month) fait += c.fait;

  return (
    <SectionCard
      title={capitalize(formatMonth(first))}
      action={
        <span className="rounded-full bg-win-50 px-2.5 py-1 text-xs font-bold text-win-700">
          {fait} effectué{fait > 1 ? "s" : ""}
        </span>
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((d) => (
          <span key={d} aria-hidden="true" className="text-[11px] font-bold text-muted-foreground">
            {d}
          </span>
        ))}
        {keys.map((key) => {
          const inMonth = monthOfKey(key) === month;
          const dow = dowOfKey(key);
          const weekend = dow === 0 || dow === 6;
          const isToday = key === nowKey;
          const n = dayCounts[key]?.total ?? 0;
          const inWeek = highlightWeek && key >= weekStart && key <= weekEnd;
          return (
            <Link
              key={key}
              href={dayHref(key)}
              scroll={false}
              aria-label={`${formatKeyLong(key)} : ${n} RDV`}
              className={cn(
                "flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] border-[1.5px] text-[13px] tabular-nums transition-colors",
                isToday
                  ? "border-transparent bg-coral-600 font-extrabold text-white"
                  : cn(
                      inWeek ? "border-navy-700" : "border-transparent",
                      !inMonth
                        ? "bg-ground font-medium text-muted-foreground"
                        : weekend
                          ? "bg-card font-bold text-muted-foreground hover:bg-navy-50"
                          : n === 0
                            ? "bg-coral-50 font-bold text-foreground hover:bg-coral-100"
                            : n === 1
                              ? "bg-gold-50 font-bold text-foreground hover:brightness-95"
                              : "bg-win-50 font-bold text-foreground hover:brightness-95",
                    ),
              )}
            >
              <span>{Number(key.slice(8, 10))}</span>
              <span aria-hidden="true" className="flex h-1 gap-0.5">
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1 rounded-full",
                      isToday ? "bg-white" : n >= 2 ? "bg-win-700" : "bg-gold-700",
                    )}
                  />
                ))}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="text-xs leading-snug font-semibold text-muted-foreground">
        Rose = jour ouvré sans RDV à remplir · or = 1 RDV · vert = 2 RDV et plus. Touche un jour pour l&apos;ouvrir.
      </p>
    </SectionCard>
  );
}
