"use client";

/**
 * Agenda — vue Mois (grille calendaire 6×7) type Google Agenda.
 * Chaque case = un jour : numéro + pastilles d'événements (heure + titre).
 * Clic sur un jour ou un événement → vue Jour correspondante.
 */
import Link from "next/link";

import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { AgendaActivity } from "@/lib/queries/agenda";

const WEEKDAY_SHORT = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];
const MAX_CHIPS = 3;

const STATUT_DOT: Record<string, string> = {
  PLANIFIE: "bg-blue-500",
  EN_COURS: "bg-amber-500",
  FAIT: "bg-emerald-500",
  MANQUE: "bg-red-500",
  REPLANIFIE: "bg-slate-400",
  ANNULE: "bg-slate-300",
};

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface MonthViewProps {
  /** 42 dates (6 semaines) couvrant le mois. */
  dates: Date[];
  /** Mois ciblé (0–11) — les jours hors mois sont grisés. */
  targetMonth: number;
  activities: AgendaActivity[];
  /** Construit le lien vers la vue Jour d'une date (préserve les filtres). */
  hrefForDay: (iso: string) => string;
}

export function MonthView({
  dates,
  targetMonth,
  activities,
  hrefForDay,
}: MonthViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Groupe les activités par jour (triées par heure)
  const byDay: Record<string, AgendaActivity[]> = {};
  for (const a of activities) {
    const k = toIso(new Date(a.date));
    (byDay[k] ??= []).push(a);
  }
  for (const k of Object.keys(byDay)) {
    byDay[k].sort(
      (x, y) => new Date(x.date).getTime() - new Date(y.date).getTime(),
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* En-tête jours de semaine */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_SHORT.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grille 6×7 */}
      <div className="grid grid-cols-7">
        {dates.map((d, idx) => {
          const iso = toIso(d);
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const isToday = dayStart.getTime() === today.getTime();
          const inMonth = d.getMonth() === targetMonth;
          const items = byDay[iso] ?? [];
          const extra = items.length - MAX_CHIPS;
          return (
            <div
              key={idx}
              className={cn(
                "min-h-[104px] border-b border-l border-border p-1",
                idx % 7 === 0 && "border-l-0",
                !inMonth && "bg-muted/20",
              )}
            >
              <div className="mb-1 flex justify-end">
                <Link
                  href={hrefForDay(iso)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums hover:bg-muted",
                    isToday && "bg-primary text-primary-foreground hover:bg-primary/90",
                    !inMonth && !isToday && "text-muted-foreground/60",
                  )}
                >
                  {d.getDate()}
                </Link>
              </div>

              <div className="space-y-0.5">
                {items.slice(0, MAX_CHIPS).map((a) => (
                  <Link
                    key={a.id}
                    href={hrefForDay(iso)}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight hover:bg-muted"
                    title={`${formatTime(a.date)} · ${a.sujet}`}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        !a.couleur && (STATUT_DOT[a.statut] ?? STATUT_DOT.PLANIFIE),
                      )}
                      style={a.couleur ? { backgroundColor: a.couleur } : undefined}
                    />
                    <span className="font-medium tabular-nums">
                      {formatTime(a.date)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {a.prospect?.raisonSociale ?? a.sujet}
                    </span>
                  </Link>
                ))}
                {extra > 0 && (
                  <Link
                    href={hrefForDay(iso)}
                    className="block px-1 text-[10px] font-medium text-primary hover:underline"
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
