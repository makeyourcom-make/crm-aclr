/**
 * « Cette semaine » : compteurs hebdo (moteur de jeu) face aux objectifs
 * hebdo (objectif quotidien × jours ouvrés), avec le repère du rythme
 * attendu à la fin de la journée, puis la charge de la semaine (actions par
 * jour ouvré, lien vers l'agenda).
 *
 * Server-safe.
 */
import Link from "next/link";

import { formatInt, pctOf } from "@/components/arena/format";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import type { DayCounters } from "@/lib/gamification/rules";
import type { TodayCockpit } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

export interface WeeklyGoals {
  appels: number;
  emails: number;
  rdv: number;
  signatures: number;
}

interface WeekSidebarProps {
  semaine: TodayCockpit["semaine"];
  goals: WeeklyGoals;
  /** « mardi » */
  jour: string;
  isWorkingDay: boolean;
}

function paceTone(pct: number, expected: number): Tone {
  if (pct >= expected) return "green";
  if (pct >= expected * 0.75) return "gold";
  return "red";
}

export function WeekSidebar({ semaine, goals, jour, isWorkingDay }: WeekSidebarProps) {
  const expected = pctOf(semaine.joursOuvresEcoules, Math.max(1, semaine.joursOuvres));
  const c: DayCounters | null = semaine.compteurs;
  const rows = c
    ? [
        { label: "Appels", value: c.appels, goal: goals.appels },
        { label: "Emails", value: c.emails, goal: goals.emails },
        { label: "RDV pris", value: c.rdvPris, goal: goals.rdv },
        { label: "Signatures", value: c.signatures, goal: goals.signatures },
      ]
    : [];
  const maxLoad = Math.max(1, ...semaine.jours.map((d) => d.n));

  return (
    <section
      aria-labelledby="semaine-titre"
      className="flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-border bg-card p-5 shadow-arena"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="semaine-titre"
          className="font-display text-lg font-extrabold tracking-[-0.02em] text-foreground"
        >
          Cette semaine
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">{semaine.label}</span>
      </div>

      {c ? (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const pct = pctOf(r.value, r.goal);
              const raw = r.goal > 0 ? Math.round((r.value / r.goal) * 100) : 0;
              const tone = r.value >= r.goal && r.goal > 0 ? "green" : paceTone(pct, expected);
              return (
                <li key={r.label}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-bold">{r.label}</span>
                    <span className="tabular-nums">
                      <strong className="font-extrabold">{formatInt(r.value)}</strong>{" "}
                      <span className="text-muted-foreground">/ {formatInt(r.goal)}</span>{" "}
                      <span className={cn("font-extrabold", TONE_CLASSES[tone].text)}>
                        · {formatInt(raw)} %
                      </span>
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${r.label} cette semaine : ${formatInt(r.value)} sur ${formatInt(r.goal)}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="relative mt-1.5 h-2.5 rounded-full bg-navy-50"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700 ease-out",
                        TONE_CLASSES[tone].solid,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                    {expected > 0 && expected < 100 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-[3px] h-4 w-0.5 rounded-sm bg-navy-700"
                        style={{ left: `${expected}%` }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className="h-3 w-0.5 rounded-sm bg-navy-700" />
            {/* Week-end : 100 % attendus ; jour férié en semaine : le rythme
                attendu est celui d'aujourd'hui (jours ouvrés déjà écoulés). */}
            Rythme attendu{" "}
            {isWorkingDay ? `${jour} soir` : expected >= 100 ? "en fin de semaine" : "aujourd'hui"}{" "}
            :{" "}
            {formatInt(expected)} % de l&apos;objectif hebdo
          </div>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Compteurs de la semaine momentanément indisponibles.
        </p>
      )}

      <div className="border-t border-border pt-3.5">
        <h3 className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Charge de la semaine
        </h3>
        <ul className="mt-2.5 grid grid-cols-5 items-end gap-2">
          {semaine.jours.map((d) => (
            <li key={d.key}>
              <Link
                href="/agenda"
                aria-label={`${d.label}${d.isToday ? ", aujourd'hui" : ""}${d.isWorking ? "" : ", férié"} : ${formatInt(d.n)} ${d.n > 1 ? "actions" : "action"}`}
                className="flex flex-col items-center gap-1 rounded-[10px] py-1 text-foreground transition-colors hover:bg-navy-50"
              >
                <span className="text-xs font-extrabold tabular-nums">{formatInt(d.n)}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-full rounded-[8px]",
                    d.isToday ? "bg-coral-400" : d.isPast ? "bg-border-strong" : "bg-navy-100",
                  )}
                  style={{ height: 8 + Math.round((d.n / maxLoad) * 56) }}
                />
                <span
                  className={cn(
                    "text-xs font-bold",
                    d.isToday ? "text-coral-600" : "text-muted-foreground",
                    !d.isWorking && "line-through",
                  )}
                >
                  {d.abbr}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
