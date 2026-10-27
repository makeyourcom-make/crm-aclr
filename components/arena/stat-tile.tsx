/**
 * Tuile de statistique : tuile d'icône + libellé, GROS chiffre (Bricolage),
 * tendance (+46 / = / -3) et sous-texte. Cliquable si `href`.
 *
 *   <StatTile label="Appels" value={27} sub="+5 XP chacun" tone="coral"
 *             icon={Phone} trend={46} trendLabel="vs hier" href="/activites" />
 *
 * Server-safe.
 */
import { ArrowUpRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { formatInt } from "./format";
import { TONE_CLASSES, type Tone } from "./tones";

export interface StatTileProps {
  label: string;
  /** Les nombres sont formatés au format CRM ; une chaîne est affichée telle quelle. */
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  /** Écart absolu vs la période de comparaison (+46, 0, -3). */
  trend?: number;
  /** Complément de la tendance (« vs hier », « vs septembre »). */
  trendLabel?: string;
  href?: string;
  className?: string;
}

export function StatTile({
  label,
  value,
  sub,
  tone = "navy",
  icon: Icon,
  trend,
  trendLabel,
  href,
  className,
}: StatTileProps) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.navy;
  const shown = typeof value === "number" ? formatInt(value) : value;

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
              t.bg,
              t.text,
            )}
          >
            <Icon className="size-[18px]" strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0 flex-1 text-[13px] leading-tight font-bold text-muted-foreground">
          {label}
        </span>
        {href && (
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
          />
        )}
      </div>
      <div className="score-number text-[32px] break-words text-foreground sm:text-[38px]">
        {shown}
      </div>
      {(trend !== undefined || sub) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {trend !== undefined && <TrendChip value={trend} label={trendLabel} />}
          {sub && (
            <span className="text-xs font-semibold text-muted-foreground">
              {sub}
            </span>
          )}
        </div>
      )}
    </>
  );

  const base =
    "group flex min-w-0 flex-col gap-2.5 rounded-[16px] border border-border bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(14,25,54,0.04)]";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-arena",
          className,
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{body}</div>;
}

/** Pastille de tendance : vert si hausse, rouge si baisse, neutre sinon. */
export function TrendChip({ value, label }: { value: number; label?: string }) {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  const up = n > 0;
  const down = n < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : null;
  const text = up ? `+${formatInt(n)}` : down ? `-${formatInt(Math.abs(n))}` : "=";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums",
        up && "bg-win-50 text-win-700",
        down && "bg-alert-50 text-alert-700",
        !up && !down && "bg-navy-50 text-muted-foreground",
      )}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      <span className="sr-only">
        {up ? "En hausse de " : down ? "En baisse de " : "Stable "}
      </span>
      {text}
      {label && <span className="font-semibold"> {label}</span>}
    </span>
  );
}
