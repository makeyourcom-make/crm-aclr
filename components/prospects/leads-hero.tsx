/**
 * Héros de la liste Entreprises : « où j'en suis et quoi faire maintenant ».
 * Taille du portefeuille, leads chauds, jamais appelés, CTA Phoning, objectif
 * d'appels du jour (compteurs réels du jour) et deux tuiles :
 * entreprises appelées (fenêtre 7 / 15 / 30 j au choix) et RDV réels à venir
 * (sous 7 j / 30 j, agenda des commerciaux). Server-safe.
 */
import { Flame, Phone, Plus } from "lucide-react";
import Link from "next/link";

import { HeroPanel, ProgressRing, formatInt } from "@/components/arena";
import type { DailyGoal } from "@/lib/gamification/rules";

import type { LeadsOverview } from "@/lib/queries/prospects";

import { CalledTile } from "./called-tile";
import { fmtDayMonth, fmtTime } from "./zurich-format";

export interface LeadsHeroProps {
  /** Sur-titre (« Ton territoire », « Toute la base »…). */
  eyebrow: string;
  total: number;
  /** « dans ton secteur », « dans la base », « attribuées à Lucille Bouin ». */
  totalSuffix: string;
  overview: LeadsOverview;
  /** Objectif d'appels du jour de l'utilisateur connecté (null si indisponible). */
  goalAppels: DailyGoal | null;
  /** Objectif de RDV pris du jour (null si indisponible). */
  goalRdv: DailyGoal | null;
  /** Liens vers les vues rapides. */
  hrefChaudes: string;
  hrefJamais: string;
}

export function LeadsHero({
  eyebrow,
  total,
  totalSuffix,
  overview,
  goalAppels: goal,
  goalRdv,
  hrefChaudes,
  hrefJamais,
}: LeadsHeroProps) {
  const { vues, rdv, called } = overview;
  const restants = goal ? Math.max(0, goal.target - goal.current) : 0;

  return (
    <HeroPanel aria-labelledby="leads-hero-titre" className="mb-6">
      <div className="flex flex-wrap items-stretch gap-6">
        {/* Colonne gauche : portefeuille + CTA */}
        <div className="flex min-w-0 flex-[3_1_380px] flex-col gap-3.5">
          <p className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
            {eyebrow}
          </p>
          <h2
            id="leads-hero-titre"
            className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 font-display tracking-[-0.02em]"
          >
            <span className="score-number text-[44px] sm:text-[56px]">{formatInt(total)}</span>
            <span className="text-xl font-bold sm:text-2xl">{totalSuffix}</span>
          </h2>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href={hrefChaudes}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-coral-400/45 bg-coral-400/20 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-coral-400/30"
            >
              <Flame aria-hidden="true" className="size-[18px] fill-coral-400/40 text-coral-400" />
              <span className="font-display text-xl font-extrabold tabular-nums">
                {formatInt(vues.chaudes)}
              </span>
              {vues.chaudes > 1 ? "chaudes" : "chaude"}
            </Link>
            <Link
              href={hrefJamais}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-white/40 bg-white/8 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-white/15"
            >
              <Phone aria-hidden="true" className="size-[18px] text-info-50" />
              <span className="font-display text-xl font-extrabold tabular-nums">
                {formatInt(vues.jamais)}
              </span>
              jamais appelée{vues.jamais > 1 ? "s" : ""}
            </Link>
          </div>

          <p className="max-w-[560px] text-sm leading-relaxed text-navy-200">
            {vues.chaudes > 0
              ? `${formatInt(vues.chaudes)} lead${vues.chaudes > 1 ? "s" : ""} chaud${vues.chaudes > 1 ? "s" : ""} t'attend${vues.chaudes > 1 ? "ent" : ""}. `
              : "Pas encore de lead chaud : chaque appel réchauffe ta base. "}
            {goal && !goal.done && (
              <>
                Commence par le haut : encore{" "}
                <strong className="text-white">
                  {formatInt(restants)} appel{restants > 1 ? "s" : ""}
                </strong>{" "}
                pour ton objectif du jour.
              </>
            )}
            {goal?.done && (
              <>
                Objectif « {goal.label} » atteint : chaque appel en plus peut devenir un RDV.
              </>
            )}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Link
              href="/phoning"
              className="inline-flex min-h-12 max-w-full flex-wrap items-center gap-2.5 rounded-[12px] bg-gradient-coral px-5 py-2.5 text-lg font-extrabold text-white shadow-cta text-shadow-[0_1px_1px_rgba(120,20,26,0.35)] transition-[filter,box-shadow] hover:brightness-[1.04] hover:shadow-[0_10px_26px_rgba(233,82,86,0.42)]"
            >
              <Phone aria-hidden="true" className="size-5" />
              Lancer le phoning
            </Link>
            <Link
              href="/prospects/nouveau"
              className="inline-flex min-h-12 items-center gap-2 rounded-[12px] border border-white/40 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              <Plus aria-hidden="true" className="size-[18px]" />
              Nouvelle entreprise
            </Link>
          </div>
        </div>

        {/* Colonne droite : objectif du jour + tuiles */}
        <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-3">
          {goal && (
            <div className="flex items-center gap-4 rounded-[14px] bg-white/8 px-4 py-3.5">
              <ProgressRing
                value={goal.current}
                max={goal.target}
                size={84}
                stroke={9}
                tone="coral"
                trackColor="#2F4470"
                label={`Objectif d'appels du jour : ${formatInt(goal.current)} sur ${formatInt(goal.target)}`}
              >
                <span className="score-number text-xl text-white">{formatInt(goal.current)}</span>
                <span className="mt-1 text-[11px] font-bold text-navy-200">
                  sur {formatInt(goal.target)}
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
                  Objectif du jour · {goal.label}
                </p>
                <p className="mt-0.5 font-display text-xl font-extrabold">
                  {goal.done
                    ? "Objectif atteint"
                    : `${goal.pct} % · encore ${formatInt(restants)} appel${restants > 1 ? "s" : ""}`}
                </p>
                <p className="mt-1 text-xs text-navy-200">
                  {goalRdv
                    ? `RDV pris aujourd'hui : ${formatInt(goalRdv.current)} / ${formatInt(goalRdv.target)}`
                    : "Chaque appel compte. Chaque RDV est une chance."}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
            <CalledTile d7={called.d7} d15={called.d15} d30={called.d30} prev7={called.prev7} />
            <HeroTile label="RDV à venir" value={formatInt(rdv.d7)}>
              <span className="text-xs font-bold text-navy-200">sous 7 j</span>
              <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs font-bold text-gold-700">
                {formatInt(rdv.d30)} sous 30 j
              </span>
              {rdv.next && (
                <span className="w-full text-xs text-navy-200">
                  prochain {fmtDayMonth(rdv.next)} · {fmtTime(rdv.next)}
                </span>
              )}
            </HeroTile>
          </div>
        </div>
      </div>
    </HeroPanel>
  );
}

function HeroTile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[14px] bg-white/8 px-3.5 py-3">
      <p className="text-xs font-semibold text-navy-200">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="score-number text-2xl">{value}</span>
        {children}
      </div>
    </div>
  );
}
