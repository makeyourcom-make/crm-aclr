/**
 * Objectifs du jour : appels, RDV pris, propositions, avec jauges
 * (Objective QUOTIDIEN actif, sinon objectifs par défaut). Pas de
 * récompense en points : l'objectif d'appels atteint prolonge la série.
 * Server-safe.
 */
import { ArrowRight, Check, Target } from "lucide-react";
import Link from "next/link";

import { plural } from "@/components/arena/format";
import { DailyGoalCard } from "@/components/arena/mission-card";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { DAILY_GOALS_TITLE, type DailyGoal } from "@/lib/gamification/rules";

const ACTIONS: Record<DailyGoal["key"], { href: string; label: (g: DailyGoal) => string }> = {
  appels: {
    href: "/phoning",
    label: (g) => (g.current > 0 ? "Reprendre le phoning" : "Lancer le phoning"),
  },
  rdvPris: { href: "/phoning", label: () => "Décrocher un RDV" },
  rdvEffectues: { href: "/agenda", label: () => "Voir l'agenda" },
  signatures: { href: "/contrats/nouveau", label: () => "Préparer un contrat" },
  propositions: { href: "/pipeline", label: () => "Ouvrir le pipeline" },
};

export function DailyGoalsSection({ goals }: { goals: DailyGoal[] }) {
  const done = goals.filter((g) => g.done).length;
  const left = goals.length - done;

  return (
    <SectionCard
      title={DAILY_GOALS_TITLE}
      icon={Target}
      tone="coral"
      description={`${done} / ${goals.length} atteints aujourd’hui`}
      action={
        left === 0 ? (
          <StatusPill tone="green" icon={Check} size="md">
            Tous atteints
          </StatusPill>
        ) : (
          <StatusPill tone="coral" size="md">
            {`${plural(left, "objectif")} à atteindre`}
          </StatusPill>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {goals.map((g) => {
          const a = ACTIONS[g.key];
          return (
            <DailyGoalCard
              key={g.key}
              goal={g}
              action={
                !g.done && a ? (
                  <Link
                    href={a.href}
                    className="inline-flex min-h-6 items-center gap-1 text-info-700 hover:underline"
                  >
                    {a.label(g)}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </SectionCard>
  );
}
