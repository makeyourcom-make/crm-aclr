"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface WeekNavProps {
  weekStart: Date;
  hideDone: boolean;
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WeekNav({ weekStart, hideDone }: WeekNavProps) {
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const baseSP = hideDone ? "&hideDone=1" : "";

  const label = `${weekStart.getDate()} ${weekStart.toLocaleString("fr-CH", { month: "short" })} → ${weekEnd.getDate()} ${weekEnd.toLocaleString("fr-CH", { month: "short" })} ${weekEnd.getFullYear()}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/agenda?week=${toIso(prevWeek)}${baseSP}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        ← Semaine précédente
      </Link>
      <Link
        href={`/agenda${hideDone ? "?hideDone=1" : ""}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Aujourd&apos;hui
      </Link>
      <Link
        href={`/agenda?week=${toIso(nextWeek)}${baseSP}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Semaine suivante →
      </Link>
      <span className="ml-2 text-sm font-medium capitalize">{label}</span>

      <Link
        href={
          hideDone
            ? `/agenda?week=${toIso(weekStart)}`
            : `/agenda?week=${toIso(weekStart)}&hideDone=1`
        }
        className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {hideDone ? "Afficher tout" : "Cacher les « fait »"}
      </Link>
    </div>
  );
}
