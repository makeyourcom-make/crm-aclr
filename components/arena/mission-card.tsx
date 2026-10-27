/**
 * Carte d'un objectif du jour : anneau de progression + libellé + phrase
 * coach orientée résultat (« Encore 13 appels pour ton objectif »).
 * Passe au vert, avec coche, quand l'objectif est atteint. Aucun point.
 *
 *   <DailyGoalCard goal={goal} action={<Link href="/phoning">Lancer</Link>} />
 *
 * Server-safe.
 */
import { CalendarPlus, Check, Phone, Send, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { DailyGoal } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { formatInt, plural } from "./format";
import { StatusPill } from "./pills";
import { ProgressRing } from "./progress-ring";
import { TONE_CLASSES, type Tone } from "./tones";

/** Champs utiles d'un objectif du jour (accepte aussi l'ancien type Mission). */
export type GoalLike = Pick<DailyGoal, "key" | "label" | "current" | "target" | "pct" | "done">;

export const GOAL_META: Record<DailyGoal["key"], { tone: Tone; icon: LucideIcon }> = {
  appels: { tone: "coral", icon: Phone },
  rdvPris: { tone: "gold", icon: CalendarPlus },
  propositions: { tone: "violet", icon: Send },
};

/** Phrase coach selon l'avancement (tutoiement, orientée résultat). */
export function goalCoach(m: GoalLike): string {
  if (m.done) return "Objectif atteint, bravo.";
  const left = Math.max(0, Math.ceil(m.target - m.current));
  switch (m.key) {
    case "appels":
      return left <= 3
        ? `Plus que ${plural(left, "appel")}, tu y es presque`
        : `Encore ${plural(left, "appel")} pour ton objectif`;
    case "rdvPris":
      return left === 1
        ? "Plus qu'un RDV pour ton objectif"
        : `Encore ${formatInt(left)} RDV à décrocher`;
    case "propositions":
      return `Encore ${plural(left, "proposition")} à envoyer`;
    default:
      return `Encore ${formatInt(left)} pour ton objectif`;
  }
}

export interface DailyGoalCardProps {
  goal: GoalLike;
  /** Lien / bouton sous la phrase coach (optionnel). */
  action?: ReactNode;
  className?: string;
}

export function DailyGoalCard({ goal, action, className }: DailyGoalCardProps) {
  const meta = GOAL_META[goal.key] ?? GOAL_META.appels;
  const done = goal.done;
  const tone: Tone = done ? "green" : meta.tone;
  const pct = Number.isFinite(goal.pct) ? Math.min(Math.max(Math.round(goal.pct), 0), 100) : 0;

  return (
    <article
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-[16px] border p-4 transition-colors",
        done ? "border-win-500/35 bg-win-50/60" : "border-border bg-card",
        className,
      )}
    >
      <ProgressRing
        value={goal.current}
        max={goal.target}
        size={88}
        stroke={9}
        tone={tone}
        label={`${goal.label} : ${formatInt(goal.current)} sur ${formatInt(goal.target)}${done ? ", atteint" : ""}`}
      >
        {done ? (
          <Check className="size-8 text-win-700" strokeWidth={3} />
        ) : (
          <>
            <span className="score-number text-2xl text-foreground">{formatInt(goal.current)}</span>
            <span className="mt-0.5 text-xs font-bold text-muted-foreground">
              / {formatInt(goal.target)}
            </span>
          </>
        )}
      </ProgressRing>

      <div className="flex min-w-0 flex-[1_1_150px] flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h3 className="text-[15px] leading-tight font-extrabold text-foreground">{goal.label}</h3>
          {done ? (
            <StatusPill tone="green" icon={Check}>
              Atteint
            </StatusPill>
          ) : (
            <span className={cn("text-[13px] font-extrabold tabular-nums", TONE_CLASSES[tone].text)}>
              {pct} %
            </span>
          )}
        </div>
        <p className="text-[13px] leading-snug font-medium text-muted-foreground">
          {goalCoach(goal)}
        </p>
        {action && <div className="mt-0.5 text-[13px] font-bold">{action}</div>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Déprécié : anciens noms « mission »
// ---------------------------------------------------------------------------

/** @deprecated Utiliser `GOAL_META`. */
export const MISSION_META = GOAL_META;

/** @deprecated Utiliser `goalCoach`. */
export const missionCoach = goalCoach;

/** @deprecated Utiliser `DailyGoalCardProps`. */
export interface MissionCardProps {
  mission: GoalLike;
  action?: ReactNode;
  className?: string;
}

/** @deprecated Utiliser `<DailyGoalCard goal={...} />` (n'affiche plus d'XP). */
export function MissionCard({ mission, action, className }: MissionCardProps) {
  return <DailyGoalCard goal={mission} action={action} className={className} />;
}
