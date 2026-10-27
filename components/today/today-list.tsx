/**
 * « Ta journée heure par heure » : la feuille de route triée par urgence.
 *
 * Ordre : En retard (jours précédents + créneaux du jour passés) → Maintenant
 * → Ce matin → Cet après-midi → Ce soir. Seuls les blocs non vides sont
 * affichés. État vide contextuel selon les objectifs du jour : la journée
 * n'est « terminée » que si les 3 objectifs (appels, RDV, propositions) sont
 * atteints.
 *
 * Server-safe.
 */
import { Check, Clock, PhoneCall, Trophy } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { formatInt, plural } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { buttonVariants } from "@/components/ui/button";
import type { DailyGoal, DayCounters } from "@/lib/gamification/rules";
import type { TodaySections, TodayTask } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

import type { DayProgress } from "./task-meta";
import { TodayItem } from "./today-item";

interface TodayListProps {
  sections: TodaySections;
  /** Objectifs du jour ; null si les compteurs sont indisponibles. */
  goals: DailyGoal[] | null;
  /** Compteurs du jour pour le bilan « déjà au compteur ». */
  today: DayCounters | null;
  /** Compteurs + objectifs du jour (détail des toasts), null si indisponibles. */
  progress: DayProgress | null;
}

type GroupKey = "enRetard" | "maintenant" | "ceMatin" | "cetApresMidi" | "ceSoir";

const GROUPS: { key: GroupKey; title: string; sub: string; titleClass: string }[] = [
  { key: "enRetard", title: "En retard", sub: "À traiter en premier", titleClass: "text-alert-700" },
  { key: "maintenant", title: "Maintenant", sub: "Prévu dans cette heure", titleClass: "text-coral-600" },
  { key: "ceMatin", title: "Ce matin", sub: "Avant midi", titleClass: "text-foreground" },
  { key: "cetApresMidi", title: "Cet après-midi", sub: "12 h - 18 h", titleClass: "text-foreground" },
  { key: "ceSoir", title: "Ce soir", sub: "Après 18 h", titleClass: "text-foreground" },
];

function missingLabel(m: DailyGoal): string {
  const left = m.remaining;
  if (m.key === "appels") return plural(left, "appel");
  if (m.key === "rdvPris") return `${formatInt(left)} RDV`;
  return plural(left, "proposition");
}

export function TodayList({ sections, goals, today, progress }: TodayListProps) {
  const retards = sections.enRetard.length;
  const aFaire =
    retards +
    sections.maintenant.length +
    sections.ceMatin.length +
    sections.cetApresMidi.length +
    sections.ceSoir.length;
  const hasAnyToday = aFaire - retards > 0;

  const allGoalsDone = goals ? goals.every((m) => m.done) : false;
  const manques = goals ? goals.filter((m) => !m.done).map(missingLabel) : [];

  return (
    <SectionCard
      id="feuille-de-route"
      className="scroll-mt-20"
      title="Ta journée heure par heure"
      icon={Clock}
      tone="gold"
      description={
        aFaire === 0
          ? "Rien d'autre de planifié aujourd'hui"
          : `${plural(aFaire, "action")} à faire · ${formatInt(retards)} en retard`
      }
    >
      <div className="flex flex-col gap-4">
        {/* Compteur de retards : à ramener à zéro avant le phoning */}
        {retards > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[14px] bg-alert-50 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.08em] text-alert-700 uppercase">
                Retards à traiter
              </div>
              <div className="text-xs font-semibold text-alert-700">
                Ramène le compteur à zéro avant d&apos;attaquer le phoning
              </div>
            </div>
            <span className="font-display text-2xl font-extrabold text-alert-700 tabular-nums">
              {formatInt(retards)}
            </span>
          </div>
        ) : (
          aFaire > 0 && (
            <div className="flex items-center gap-2.5 rounded-[14px] bg-win-50 px-3.5 py-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-win-700 text-white"
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div>
                <div className="text-sm font-extrabold text-win-700">Zéro retard</div>
                <div className="text-xs text-win-700">Ardoise propre. Place au phoning.</div>
              </div>
            </div>
          )
        )}

        {GROUPS.map((g) => {
          const items: TodayTask[] = sections[g.key];
          if (items.length === 0) return null;
          const headingId = `groupe-${g.key}`;
          return (
            <section key={g.key} aria-labelledby={headingId}>
              <div className="flex items-center gap-2.5 pt-1 pb-1.5">
                <h3
                  id={headingId}
                  className={cn("text-[11px] font-extrabold tracking-[0.08em] uppercase", g.titleClass)}
                >
                  {g.title}
                </h3>
                <span className="hidden text-xs text-muted-foreground sm:inline">{g.sub}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
                <StatusPill tone={g.key === "enRetard" ? "red" : "navy"} dot={false}>
                  {g.key === "enRetard"
                    ? `${formatInt(items.length)} à traiter`
                    : `${formatInt(items.length)} à faire`}
                </StatusPill>
              </div>
              <ol className="flex flex-col">
                {items.map((t) => (
                  <TodayItem
                    key={t.id}
                    task={t}
                    overdue={g.key === "enRetard"}
                    progress={progress}
                  />
                ))}
              </ol>
            </section>
          );
        })}

        {/* État vide de la journée : contextuel selon les objectifs du jour */}
        {!hasAnyToday &&
          retards === 0 &&
          (allGoalsDone ? (
            <EmptyState
              icon={Trophy}
              tone="green"
              title="Journée terminée"
              description="Tes 3 objectifs du jour sont atteints. Prends de l'avance sur demain : chaque appel de plus peut devenir un RDV."
            />
          ) : (
            <EmptyState
              icon={PhoneCall}
              tone="gold"
              title={
                goals
                  ? "Plus rien de planifié, mais des objectifs à atteindre"
                  : "Plus rien de planifié aujourd'hui"
              }
              description={
                <>
                  {manques.length > 0 && (
                    <>
                      Il te reste {manques.join(" · ")} pour tes objectifs du jour.
                      <br />
                    </>
                  )}
                  Logge un appel ou un email depuis une fiche entreprise, ou planifie un RDV
                  depuis l&apos;agenda.
                </>
              }
              action={
                <Link href="/phoning" className={buttonVariants({ variant: "default", size: "lg" })}>
                  Lancer le phoning
                </Link>
              }
            />
          ))}

        {/* Bilan : ce qui est déjà au compteur aujourd'hui */}
        {today &&
          today.appels + today.emails + today.rdvPris + today.rdvEffectues + today.propositions >
            0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[14px] bg-ground px-3.5 py-3">
            <span
              aria-hidden="true"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-win-50 text-win-700"
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span className="text-[13px] font-bold">Déjà au compteur</span>
            <span className="text-[13px] text-muted-foreground">
              {[
                plural(today.appels, "appel"),
                plural(today.conversations, "conversation"),
                `${formatInt(today.rdvPris)} RDV pris`,
                today.rdvEffectues > 0
                  ? `${formatInt(today.rdvEffectues)} RDV ${today.rdvEffectues > 1 ? "effectués" : "effectué"}`
                  : null,
                today.propositions > 0
                  ? plural(today.propositions, "proposition envoyée", "propositions envoyées")
                  : null,
                plural(today.emails, "email"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
