"use client";

/**
 * Collection de badges : grille de médaillons (filtre Tous / Obtenus /
 * À débloquer) + panneau de détail du badge choisi (condition, progression
 * réelle, conseil, action). Les états viennent de getPlayerStats().badges ;
 * les progressions et conseils sont calculés côté serveur par la page.
 */
import { Check, Lock, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BadgeMedal } from "@/components/arena/badge-medal";
import { formatInt } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { buttonVariants } from "@/components/ui/button";
import type { BadgeState } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

export interface BadgeItem {
  badge: BadgeState;
  tip: string;
  progress: { value: number; max: number; text: string } | null;
  cta: { href: string; label: string };
}

type Filter = "tous" | "obtenus" | "adebloquer";

const inFilter = (b: BadgeItem, f: Filter) =>
  f === "obtenus" ? b.badge.earned : f === "adebloquer" ? !b.badge.earned : true;

export function BadgeCollection({ items }: { items: BadgeItem[] }) {
  const earnedCount = items.filter((b) => b.badge.earned).length;
  const initial = items.find((b) => !b.badge.earned) ?? items[0];
  const [filter, setFilter] = useState<Filter>("tous");
  const [selected, setSelected] = useState<string | undefined>(initial?.badge.key);

  const visible = items.filter((b) => inFilter(b, filter));
  const current = items.find((b) => b.badge.key === selected) ?? visible[0] ?? items[0];

  const pickFilter = (f: Filter) => {
    setFilter(f);
    if (!current || !inFilter(current, f)) {
      setSelected(items.find((b) => inFilter(b, f))?.badge.key);
    }
  };

  const ratio = (b: BadgeItem) =>
    b.progress && b.progress.max > 0 ? b.progress.value / b.progress.max : -1;
  const nearest = items
    .filter((b) => !b.badge.earned && ratio(b) >= 0)
    .sort((a, b) => ratio(b) - ratio(a))[0];

  const filters: { id: Filter; label: string }[] = [
    { id: "tous", label: `Tous (${items.length})` },
    { id: "obtenus", label: `Obtenus (${earnedCount})` },
    { id: "adebloquer", label: `À débloquer (${items.length - earnedCount})` },
  ];

  if (!current) return null;
  const pct =
    current.progress && current.progress.max > 0
      ? Math.min(100, Math.round((current.progress.value / current.progress.max) * 100))
      : 0;

  return (
    <SectionCard
      title="Collection de badges"
      icon={Trophy}
      tone="gold"
      description={
        <>
          {earnedCount} sur {items.length} débloqués
          {nearest ? ` · ${nearest.badge.label} est le plus proche` : ""}
        </>
      }
      contentClassName="flex flex-col gap-4"
    >
      <div
        role="group"
        aria-label="Filtrer les badges"
        className="flex flex-wrap gap-1 self-start rounded-[12px] border border-border bg-ground p-1"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => pickFilter(f.id)}
            className={cn(
              "h-9 rounded-[9px] px-3 text-[13px] font-bold transition-colors",
              filter === f.id
                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(14,25,54,0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="grid min-w-0 flex-[1.6_1_420px] grid-cols-[repeat(auto-fill,minmax(128px,1fr))] content-start gap-3">
          {visible.map((b) => {
            const sel = b.badge.key === current.badge.key;
            const sub = b.badge.earned
              ? "Obtenu"
              : b.progress
                ? b.progress.text
                : "À débloquer";
            return (
              <button
                key={b.badge.key}
                type="button"
                aria-pressed={sel}
                aria-label={`${b.badge.label}, ${b.badge.earned ? "obtenu" : "à débloquer"}`}
                onClick={() => setSelected(b.badge.key)}
                className={cn(
                  "flex min-h-[148px] flex-col items-center gap-2 rounded-[14px] border-2 px-2.5 py-3.5 text-center transition-colors",
                  sel
                    ? "border-coral-500 bg-coral-50"
                    : b.badge.earned
                      ? "border-border bg-card hover:border-border-strong"
                      : "border-border bg-ground hover:border-border-strong",
                )}
              >
                <BadgeMedal badge={b.badge} size="md" showLabel={false} interactive={false} />
                <span className="text-[13px] leading-tight font-extrabold text-foreground">
                  {b.badge.label}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    b.badge.earned ? "text-win-700" : "text-muted-foreground",
                  )}
                >
                  {sub}
                </span>
              </button>
            );
          })}
        </div>

        <div
          aria-live="polite"
          className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-[14px] bg-ground p-4 sm:p-[18px]"
        >
          <div className="flex items-center gap-3.5">
            <BadgeMedal badge={current.badge} size={64} showLabel={false} interactive={false} />
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <h3 className="font-display text-xl leading-tight font-extrabold text-foreground">
                {current.badge.label}
              </h3>
              <span
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold",
                  current.badge.earned ? "bg-win-50 text-win-700" : "bg-navy-50 text-navy-500",
                )}
              >
                {current.badge.earned ? (
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                ) : (
                  <Lock aria-hidden="true" className="size-3.5" />
                )}
                {current.badge.earned ? "Obtenu" : "À débloquer"}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Condition
            </div>
            <div className="mt-0.5 text-sm font-bold text-foreground">
              {current.badge.description}
            </div>
          </div>
          {current.progress && !current.badge.earned && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2 text-xs font-bold text-foreground">
                <span>{current.progress.text}</span>
                <span className="tabular-nums">{formatInt(pct)} %</span>
              </div>
              <div
                role="img"
                aria-label={`${current.badge.label} : ${current.progress.text}, ${pct} %`}
                className="h-2 overflow-hidden rounded-full bg-navy-100"
              >
                <div
                  className="h-full rounded-full bg-gradient-coral"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
          <p className="text-[13px] leading-normal font-medium text-foreground">{current.tip}</p>
          <Link
            href={current.cta.href}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-auto self-start")}
          >
            {current.cta.label}
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
