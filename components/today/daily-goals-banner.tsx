/**
 * Bandeau sticky des objectifs du jour (4 KPI avec progress bars).
 *
 * Couleurs :
 *   - Rouge   si < 50 % de l'objectif
 *   - Orange  si 50-80 %
 *   - Vert    si ≥ 80 %
 */
import { DEFAULT_DAILY_GOALS } from "@/lib/constants";
import type { TodayCounters } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

interface DailyGoalsBannerProps {
  counters: TodayCounters;
}

export function DailyGoalsBanner({ counters }: DailyGoalsBannerProps) {
  const items = [
    {
      label: "Appels",
      value: counters.appels,
      goal: DEFAULT_DAILY_GOALS.appels,
    },
    {
      label: "Emails",
      value: counters.emails,
      goal: DEFAULT_DAILY_GOALS.emails,
    },
    {
      label: "RDV honorés",
      value: counters.rdvHonores,
      goal: DEFAULT_DAILY_GOALS.rdv,
    },
    {
      label: "Propositions",
      value: counters.propositionsEnvoyees,
      goal: DEFAULT_DAILY_GOALS.propositions,
    },
  ];

  // Encouragement contextuel : le KPI le plus en retard
  const worst = items
    .filter((i) => i.goal > 0)
    .reduce<typeof items[number] | null>((min, cur) => {
      const pct = cur.value / cur.goal;
      if (!min) return cur;
      return pct < min.value / min.goal ? cur : min;
    }, null);

  const encouragement = worst
    ? worst.value >= worst.goal
      ? `🎯 Tous les objectifs atteints, bravo !`
      : `Plus que ${worst.goal - worst.value} ${worst.label.toLowerCase()} pour atteindre l'objectif !`
    : null;

  return (
    <div className="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="px-6 py-3 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <GoalBar key={item.label} {...item} />
          ))}
        </div>
        {encouragement && (
          <p className="mt-2 text-xs text-muted-foreground">{encouragement}</p>
        )}
      </div>
    </div>
  );
}

function GoalBar({
  label,
  value,
  goal,
}: {
  label: string;
  value: number;
  goal: number;
}) {
  const pct = goal === 0 ? 0 : Math.min(100, Math.round((value / goal) * 100));
  const tone =
    pct >= 80 ? "emerald" : pct >= 50 ? "amber" : "red";

  const TONE_BAR: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  const TONE_TEXT: Record<string, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", TONE_TEXT[tone])}>
          {value} / {goal}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
