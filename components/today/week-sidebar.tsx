import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_WEEKLY_GOALS } from "@/lib/constants";
import type { WeeklyCounters } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

interface WeekSidebarProps {
  counters: WeeklyCounters;
}

export function WeekSidebar({ counters }: WeekSidebarProps) {
  const items = [
    {
      label: "Appels semaine",
      value: counters.appels,
      goal: DEFAULT_WEEKLY_GOALS.appels,
    },
    {
      label: "Emails semaine",
      value: counters.emails,
      goal: DEFAULT_WEEKLY_GOALS.emails,
    },
    {
      label: "RDV semaine",
      value: counters.rdv,
      goal: DEFAULT_WEEKLY_GOALS.rdv,
    },
    {
      label: "Signatures",
      value: counters.signatures,
      goal: DEFAULT_WEEKLY_GOALS.signatures,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cette semaine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <WeekRow key={item.label} {...item} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function WeekRow({
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
    pct >= 80 ? "emerald" : pct >= 50 ? "amber" : "slate";

  const TONE: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {value} / {goal}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
