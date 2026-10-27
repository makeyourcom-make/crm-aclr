/**
 * Héros finance MYC Arena (Contrats · Factures clients · Signatures).
 *
 * Bandeau navy : « où en est la caisse et quoi faire maintenant ».
 *   - à gauche : sur-titre, titre coach, sous-titre et CTA ;
 *   - à droite : anneau MRR vers le prochain palier (données réelles) ;
 *   - dessous : tuiles chiffrées (signés du mois, brouillons, retards…).
 *
 * Server-safe : les CTA sont passés en `actions` (liens ou boutons client).
 */
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatInt } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { Meter } from "@/components/arena/meter";
import { ProgressRing } from "@/components/arena/progress-ring";
import { cn } from "@/lib/utils";

export interface HeroTile {
  label: string;
  value: ReactNode;
  /** Complément à côté du chiffre (« / 8 objectif », « CHF »). */
  unit?: ReactNode;
  /** Couleur du chiffre (lisible sur navy, grande taille). */
  tone?: "white" | "gold" | "coral" | "green";
  meter?: { value: number; max: number; label: string };
  hint?: ReactNode;
  href?: string;
}

const VALUE_TONE: Record<NonNullable<HeroTile["tone"]>, string> = {
  white: "text-white",
  gold: "text-gold-500",
  coral: "text-coral-400",
  green: "text-win-50",
};

/** Palier suivant du MRR : par 1 000 sous 5 000 CHF, puis par 5 000. */
export function mrrPaliers(mrr: number): { next: number; done: number[] } {
  const step = mrr < 5000 ? 1000 : 5000;
  const next = Math.max(step, Math.floor(mrr / step) * step + step);
  const done: number[] = [];
  for (let v = next - step; v >= step && done.length < 3; v -= step) done.unshift(v);
  return { next, done };
}

function paliers(v: number): string {
  return v >= 1000 && v % 1000 === 0 ? `${v / 1000}k` : formatInt(v);
}

export function FinanceHero({
  eyebrow,
  title,
  subtitle,
  actions,
  mrr,
  mrrAdded,
  monthLabel,
  mrrCaption = "MRR",
  tiles,
  ariaLabel = "Situation financière",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  mrr: number;
  /** Mensuel ajouté par les signatures du mois. */
  mrrAdded: number;
  monthLabel: string;
  mrrCaption?: string;
  tiles: HeroTile[];
  ariaLabel?: string;
}) {
  const { next, done } = mrrPaliers(mrr);
  const reste = Math.max(0, next - mrr);
  const pct = next > 0 ? Math.round((Math.min(mrr, next) / next) * 100) : 0;

  return (
    <HeroPanel aria-label={ariaLabel} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 sm:gap-7">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <p className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
            {eyebrow}
          </p>
          <h2 className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] break-words sm:text-[34px]">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-[560px] text-[15px] leading-relaxed text-navy-200">
              {subtitle}
            </p>
          )}
          {actions && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">{actions}</div>
          )}
        </div>

        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center gap-5 rounded-[20px] border border-white/12 bg-white/[0.06] p-4 sm:px-[22px] sm:py-[18px]">
          <ProgressRing
            value={mrr}
            max={next}
            size={148}
            stroke={12}
            tone="coral"
            trackColor="#2F4470"
            label={`${mrrCaption} ${formatInt(mrr)} CHF par mois, ${pct} % du palier ${formatInt(next)} CHF`}
          >
            <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200">
              {mrrCaption}
            </span>
            <span className="score-number mt-1 text-[28px] text-white">
              {formatInt(mrr)}
            </span>
            <span className="mt-1 text-xs font-semibold text-navy-200">CHF / mois</span>
          </ProgressRing>

          <div className="flex min-w-0 flex-col gap-2.5 sm:min-w-[200px]">
            <p className="flex items-center gap-2 text-[13px] font-bold text-win-50">
              <TrendingUp aria-hidden="true" className="size-4 shrink-0" />
              +{formatInt(mrrAdded)} CHF / mois ajoutés en {monthLabel}
            </p>
            <p className="text-sm font-semibold text-white">
              Prochain palier{" "}
              <strong className="font-extrabold">{formatInt(next)} CHF</strong>
            </p>
            <p className="text-[13px] text-navy-200">
              Encore{" "}
              <strong className="font-extrabold text-gold-50">
                {formatInt(reste)} CHF
              </strong>{" "}
              de mensuel à signer
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Paliers de MRR">
              {done.map((v) => (
                <li
                  key={v}
                  className="rounded-full bg-win-500/30 px-2.5 py-1 text-xs font-bold text-win-50"
                >
                  <span className="sr-only">Palier atteint : </span>
                  {paliers(v)}
                </li>
              ))}
              <li className="rounded-full border border-dashed border-gold-500 px-2.5 py-1 text-xs font-bold text-gold-50">
                {paliers(next)} en vue
              </li>
            </ul>
          </div>
        </div>
      </div>

      {tiles.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.label} className="min-w-0">
              <HeroTileView tile={t} />
            </li>
          ))}
        </ul>
      )}
    </HeroPanel>
  );
}

function HeroTileView({ tile }: { tile: HeroTile }) {
  const body = (
    <>
      <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
        {tile.label}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            "score-number text-[32px] sm:text-[36px]",
            VALUE_TONE[tile.tone ?? "white"],
          )}
        >
          {tile.value}
        </span>
        {tile.unit && (
          <span className="text-sm font-semibold text-navy-200">{tile.unit}</span>
        )}
      </span>
      {tile.meter && (
        <Meter
          value={tile.meter.value}
          max={tile.meter.max}
          label={tile.meter.label}
          valueLabel={null}
          size="sm"
          onDark
          className="[&>div:first-child]:sr-only"
        />
      )}
      {tile.hint && <span className="text-xs text-navy-200">{tile.hint}</span>}
    </>
  );
  const base =
    "flex h-full min-w-0 flex-col gap-2 rounded-[14px] border border-white/12 bg-white/[0.07] p-4";
  if (tile.href) {
    return (
      <Link
        href={tile.href}
        className={cn(base, "transition-colors hover:border-white/25 hover:bg-white/[0.11]")}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
