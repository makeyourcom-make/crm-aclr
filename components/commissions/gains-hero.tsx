/**
 * Héros « Objectifs & gains » de la commerciale : ce qu'elle a gagné ce mois
 * (commissions réelles), ce qui manque pour l'objectif, ses acquis de l'année
 * et ce qui est déjà planifié, CTA phoning / agenda, et la jauge du mois
 * (CA signé, contrats ou record à battre) avec le repère du temps écoulé.
 * Server-safe.
 */
import { CalendarDays, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { HeroPanel } from "@/components/arena/hero-panel";
import { StatusPill } from "@/components/arena/pills";
import { buttonVariants } from "@/components/ui/button";
import { formatCHF } from "@/lib/format";
import {
  formatAmountShort,
  formatDayMonthCH,
  formatMetricValue,
  PACE_META,
  type MonthWindow,
  type PaceStatus,
} from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

export interface HeroGaugeData {
  title: string;
  value: number;
  target: number;
  unit: "count" | "chf";
  /** Libellé d'unité pour les compteurs (« contrats »). */
  unitLabel?: string;
  projection: number | null;
  status: PaceStatus | null;
  /** Remplace la pastille de rythme (ex. « Record à battre »). */
  pillText?: string;
}

export interface GainsHeroProps {
  window: MonthWindow;
  monthTotal: number;
  monthGenere: number;
  monthAcquis: number;
  /** Troisième ligne du titre (« · encore 2 contrats pour l'objectif »). */
  headline: ReactNode;
  coach: ReactNode;
  pills: { text: string; accent?: boolean }[];
  tiles: { label: string; value: string; sub: string; positive?: boolean }[];
  rdvCount: number;
  gauge: HeroGaugeData | null;
}

export function GainsHero({
  window: w,
  monthTotal,
  monthGenere,
  monthAcquis,
  headline,
  coach,
  pills,
  tiles,
  rdvCount,
  gauge,
}: GainsHeroProps) {
  return (
    <HeroPanel aria-labelledby="gains-hero-titre">
      <div className="flex flex-wrap items-stretch gap-7">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {pills.map((p) => (
              <span
                key={p.text}
                className={cn(
                  "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                  p.accent ? "bg-coral-400 font-extrabold text-navy-700" : "bg-white/12 text-white",
                )}
              >
                {p.text}
              </span>
            ))}
          </div>

          <h2 id="gains-hero-titre" className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.08em] text-navy-200 uppercase">
              Commission sur tes signatures de {w.monthName}
            </span>
            <span className="score-number text-[48px] text-white sm:text-[64px]">
              {formatAmountShort(monthGenere)}{" "}
              <span className="text-[26px] text-navy-200 sm:text-[32px]">CHF</span>
            </span>
            <span className="font-display text-xl leading-snug font-bold tracking-[-0.02em] text-white sm:text-2xl">
              {headline}
            </span>
          </h2>
          <p className="max-w-[560px] text-[15px] leading-normal text-navy-200">
            {monthAcquis > 0 && (
              <>
                Dont <strong className="text-white">{formatCHF(monthAcquis)}</strong> déjà acquis.{" "}
              </>
            )}
            {coach}
          </p>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="rounded-[14px] border border-white/12 bg-white/[0.08] px-3.5 py-3"
              >
                <div className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
                  {t.label}
                </div>
                <div
                  className={cn(
                    "mt-1 font-display text-2xl font-extrabold break-words tabular-nums",
                    t.positive ? "text-win-50" : "text-white",
                  )}
                >
                  {t.value}
                </div>
                <div className="text-xs text-navy-200">{t.sub}</div>
              </div>
            ))}
          </div>

          <div className="mt-1 flex flex-wrap gap-3">
            <Link href="/phoning" className={buttonVariants({ variant: "hero", size: "xl" })}>
              <Phone aria-hidden="true" strokeWidth={2.4} />
              Lancer le phoning
            </Link>
            <Link
              href="/agenda"
              className="inline-flex h-[52px] items-center gap-2.5 rounded-[12px] border border-white/35 px-5 text-[15px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <CalendarDays aria-hidden="true" className="size-[18px]" />
              {rdvCount > 0
                ? `Préparer mes ${rdvCount} RDV`
                : "Ouvrir mon agenda"}
            </Link>
          </div>
        </div>

        {gauge && <HeroGauge gauge={gauge} window={w} />}
      </div>
    </HeroPanel>
  );
}

function HeroGauge({ gauge, window: w }: { gauge: HeroGaugeData; window: MonthWindow }) {
  const pct = gauge.target > 0 ? Math.round((gauge.value / gauge.target) * 100) : 0;
  const fill = Math.min(100, Math.max(0, pct));
  const reached = gauge.target > 0 && gauge.value >= gauge.target;
  const t = Math.min(1, Math.max(0, w.timeRatio));
  const theta = Math.PI * (1 - t);
  const mx1 = 150 + 104 * Math.cos(theta);
  const my1 = 150 - 104 * Math.sin(theta);
  const mx2 = 150 + 136 * Math.cos(theta);
  const my2 = 150 - 136 * Math.sin(theta);
  const fmt = formatAmountShort;
  const unitTxt = gauge.unit === "chf" ? "CHF" : (gauge.unitLabel ?? "");
  const gap = Math.max(0, gauge.target - gauge.value);
  const pace = gauge.status ? PACE_META[gauge.status] : null;
  const pill = gauge.pillText ?? pace?.label ?? null;
  const pillTone = gauge.pillText ? "gold" : (pace?.tone ?? "blue");
  const aria = `${gauge.title} : ${fmt(gauge.value)} sur ${fmt(gauge.target)} ${unitTxt}, soit ${pct} %. Repère du temps écoulé à ${Math.round(t * 100)} %.`;

  return (
    <div className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-3 rounded-[20px] border border-white/12 bg-white/[0.06] p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
          {gauge.title}
        </div>
        {pill && <StatusPill tone={pillTone}>{reached ? "Objectif atteint" : pill}</StatusPill>}
      </div>
      <svg viewBox="0 0 300 178" width="100%" role="img" aria-label={aria}>
        <defs>
          <linearGradient id="gains-gauge-coral" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F47174" />
            <stop offset="1" stopColor="#E95256" />
          </linearGradient>
        </defs>
        <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="#2F4470" strokeWidth={24} strokeLinecap="round" />
        {fill > 0 && (
          <path
            d="M 30 150 A 120 120 0 0 1 270 150"
            fill="none"
            stroke={reached ? "#12A150" : "url(#gains-gauge-coral)"}
            strokeWidth={24}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${fill} 100`}
          />
        )}
        <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="#F5A524" strokeWidth={4} strokeLinecap="round" />
        <text x="150" y="122" textAnchor="middle" fill="#FFFFFF" className="font-display" style={{ fontSize: 50, fontWeight: 800 }}>
          {pct} %
        </text>
        <text x="150" y="148" textAnchor="middle" fill="#D1D6E3" style={{ fontSize: 15, fontWeight: 700 }}>
          {fmt(gauge.value)} / {fmt(gauge.target)} {unitTxt}
        </text>
        <text x="30" y="176" textAnchor="middle" fill="#D1D6E3" style={{ fontSize: 12, fontWeight: 600 }}>
          0
        </text>
        <text x="270" y="176" textAnchor="middle" fill="#D1D6E3" style={{ fontSize: 12, fontWeight: 600 }}>
          {fmt(gauge.target)}
        </text>
      </svg>
      <div className="flex items-center gap-2 text-xs text-navy-200">
        <span aria-hidden="true" className="h-1 w-3.5 rounded-full bg-gold-500" />
        Repère or : où il faudrait être ({Math.round(t * 100)} % du mois)
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[12px] bg-white/[0.08] px-3 py-2.5">
          <div className="text-xs font-semibold text-navy-200">{reached ? "Dépassé de" : "Il manque"}</div>
          <div className="text-lg font-extrabold break-words text-white tabular-nums">
            {reached
              ? formatMetricValue(gauge.value - gauge.target, gauge.unit)
              : formatMetricValue(gap, gauge.unit)}
          </div>
        </div>
        <div className="rounded-[12px] bg-white/[0.08] px-3 py-2.5">
          <div className="text-xs font-semibold text-navy-200">
            {gauge.projection != null
              ? `À ce rythme le ${formatDayMonthCH(w.lastWorkingDay)}`
              : "Mois en cours"}
          </div>
          <div className="text-lg font-extrabold break-words text-white tabular-nums">
            {gauge.projection != null
              ? formatMetricValue(gauge.projection, gauge.unit)
              : formatMetricValue(gauge.value, gauge.unit)}
          </div>
        </div>
      </div>
    </div>
  );
}
