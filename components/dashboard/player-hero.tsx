/**
 * Héros du Dashboard (QG du joueur) : « où j'en suis et quoi faire
 * maintenant » en 2 secondes. Bonjour, niveau + barre XP, phrase coach,
 * gros CTA « Lancer le phoning », puis tuiles Score du jour / Série /
 * Classement (+ Commissions pour la commerciale).
 *
 * Toutes les valeurs viennent du moteur de jeu (getPlayerStats,
 * getWeeklyLeaderboard) ou des requêtes du dashboard : rien d'inventé.
 * Server-safe.
 */
import { ArrowRight, BarChart3, Flame, Phone, Target, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatInt, plural } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { XpBar } from "@/components/arena/xp-bar";
import { formatCHFCompact, formatNumber } from "@/lib/format";
import type { LeaderboardEntry, PlayerStats } from "@/lib/gamification/rules";
import { firstNameOf } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

export interface HeroMoney {
  /** Commissions acquises (versées) ce mois. */
  commissions: number;
  salairePrevu: number;
  garantieActive: boolean;
  mois: string;
}

export interface PlayerHeroProps {
  stats: PlayerStats;
  leaderboard: LeaderboardEntry[] | null;
  role: Role;
  /** « Mardi 27.10.2026 · 15:40 » */
  dateLabel: string;
  isWorkingDay: boolean;
  /** Commerciale : commissions + salaire prévu du mois (tuile 4). */
  money?: HeroMoney | null;
  /** Admin : nombre d'actions en attente (contrats, RDV, planning). */
  pendingCount?: number;
}

function rankLabel(rank: number): ReactNode {
  return (
    <>
      {rank}
      <span className="text-xl">{rank === 1 ? "er" : "e"}</span>
    </>
  );
}

/** Tuile translucide sur le navy du héros. */
function HeroTile({
  label,
  children,
  sub,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[16px] border border-white/12 bg-white/7 p-3.5 sm:p-4">
      <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
        {label}
      </span>
      {children}
      {sub && <span className="text-xs font-semibold text-navy-200">{sub}</span>}
    </div>
  );
}

export function PlayerHero({
  stats,
  leaderboard,
  role,
  dateLabel,
  isWorkingDay,
  money,
  pendingCount = 0,
}: PlayerHeroProps) {
  const isAdmin = role === "ADMIN";
  const level = stats.level;
  const appelsMission = stats.missions.find((m) => m.key === "appels");
  const appelsTarget = appelsMission?.target ?? stats.dailyCallTarget;
  const appelsLeft = Math.max(0, appelsTarget - stats.today.appels);
  const missionsLeft = stats.missions.filter((m) => !m.done).length;
  const record = stats.xpRecordDay;
  const xpToday = Math.max(0, stats.xpToday);
  const isRecordDay = record > 0 && xpToday >= record;

  // Classement de la semaine
  const me = leaderboard?.find((e) => e.isMe) ?? null;
  const others = (leaderboard ?? []).filter((e) => !e.isMe);
  const leader = leaderboard?.[0] ?? null;
  const second = others[0] ?? null;

  // ---- Phrase coach (données réelles uniquement) ----
  const coach: ReactNode[] = [];
  if (isAdmin) {
    coach.push(
      pendingCount > 0 ? (
        <>
          Tu as <strong className="text-white">{plural(pendingCount, "action")}</strong> en
          attente : contrats, RDV ou planning.
        </>
      ) : (
        <>Tout est à jour. Place au pilotage de l&apos;équipe.</>
      ),
    );
  }
  if (stats.streak >= 2) {
    coach.push(
      <>
        Tu es en feu : <strong className="text-white">{stats.streak} jours de série</strong>.
      </>,
    );
  } else if (stats.streak === 1) {
    coach.push(
      <>
        Ta série est lancée : <strong className="text-white">1 jour</strong>.
      </>,
    );
  }
  if (!isAdmin) {
    if (!isWorkingDay && stats.today.appels === 0) {
      coach.push(<>Jour de repos : la série reprend au prochain jour ouvré.</>);
    } else if (missionsLeft === 0) {
      coach.push(<>Les 3 missions du jour sont pliées, bravo.</>);
    } else if (appelsLeft > 0) {
      coach.push(
        <>
          Encore <strong className="text-white">{plural(appelsLeft, "appel")}</strong> et ta
          mission appels est pliée.
        </>,
      );
    } else {
      coach.push(
        <>
          Mission appels pliée ! Plus que {plural(missionsLeft, "mission")} à remplir.
        </>,
      );
    }
  }
  if (isRecordDay) {
    coach.push(<>Tu tiens ton meilleur score du jour : {formatInt(xpToday)} XP.</>);
  } else if (record > 0 && xpToday > 0 && xpToday >= record * 0.6) {
    coach.push(<>Le record de {formatInt(record)} XP est à portée.</>);
  }

  // ---- Tuile classement ----
  let rankSub: string;
  if (!me) {
    rankSub = "";
  } else if (me.xp <= 0 && (leader?.xp ?? 0) <= 0) {
    rankSub = "Personne n'a encore marqué cette semaine";
  } else if (me.rank === 1 && second) {
    const avance = me.xp - second.xp;
    rankSub =
      avance > 0
        ? `${formatInt(me.xp)} XP · ${formatInt(avance)} XP d'avance sur ${firstNameOf(second.name)}`
        : `${formatInt(me.xp)} XP · à égalité avec ${firstNameOf(second.name)}`;
  } else if (me.rank > 1 && leader) {
    rankSub = `${formatInt(me.xp)} XP · ${formatInt(leader.xp - me.xp)} XP derrière ${firstNameOf(leader.name)}`;
  } else {
    rankSub = `${formatInt(me.xp)} XP cette semaine`;
  }

  const scorePct = record > 0 ? Math.min(100, Math.round((xpToday / record) * 100)) : 0;
  const scoreSub =
    record <= 0
      ? "Premier record à poser aujourd'hui"
      : isRecordDay
        ? "Ton meilleur score à ce jour, continue !"
        : `Record ${formatInt(record)} XP · encore ${formatInt(record - xpToday)} XP`;

  const streakSub = [
    stats.streakRecord > 0 ? `Record ${plural(stats.streakRecord, "jour")}` : null,
    isWorkingDay
      ? appelsLeft > 0
        ? `${plural(appelsLeft, "appel")} pour la ${stats.streak > 0 ? "prolonger" : "lancer"}`
        : "objectif d'appels du jour atteint"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <HeroPanel aria-labelledby="hero-titre" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-navy-100">
              {dateLabel}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-navy-100">
              {isAdmin ? "Admin · Pilotage" : "Commerciale"}
            </span>
          </div>
          <h2
            id="hero-titre"
            className="font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] break-words text-white sm:text-[44px]"
          >
            Bonjour {stats.firstName || "toi"}
          </h2>
          {coach.length > 0 && (
            <p className="max-w-[560px] text-[15px] leading-normal font-medium text-navy-200 sm:text-base">
              {coach.map((c, i) => (
                <span key={i}>
                  {i > 0 ? " " : ""}
                  {c}
                </span>
              ))}
            </p>
          )}

          {/* Niveau */}
          <div className="flex max-w-[560px] items-center gap-3.5 rounded-[16px] border border-white/14 bg-white/6 px-4 py-3.5">
            <span
              aria-hidden="true"
              className="flex size-[52px] shrink-0 items-center justify-center rounded-[16px] bg-lvl-500 font-display text-[26px] font-extrabold text-white shadow-[inset_0_-3px_0_rgba(14,25,54,0.25)]"
            >
              {level.level}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-base font-extrabold text-white">
                  Niveau {level.level} · {level.name}
                </span>
                {level.nextName && (
                  <span className="text-xs font-bold text-lvl-200">
                    Prochain niveau : {level.level + 1} · {level.nextName}
                  </span>
                )}
              </div>
              <XpBar
                pct={level.pct}
                shine
                className="h-2.5 bg-navy-500"
                label={`Progression vers le niveau suivant : ${level.pct} %`}
              />
              <span className="text-xs font-semibold text-navy-200 tabular-nums">
                {level.nextXp !== null && level.nextName ? (
                  <>
                    {formatInt(level.xp)} / {formatInt(level.nextXp)} XP ·{" "}
                    {formatInt(level.xpToNext)} XP avant {level.nextName}
                  </>
                ) : (
                  <>{formatInt(level.xp)} XP · niveau maximum atteint</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-[0_1_300px]">
          <Link
            href="/phoning"
            className="group flex min-h-[72px] items-center gap-3.5 rounded-[18px] bg-gradient-coral py-3.5 pr-5 pl-3.5 text-white shadow-[0_12px_28px_rgba(233,82,86,0.45)] transition-[transform,filter] hover:brightness-[1.04] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-px"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-coral-600"
            >
              <Phone className="size-[22px]" strokeWidth={2.2} />
            </span>
            <span className="flex-1 font-display text-[22px] font-extrabold tracking-[-0.01em] [text-shadow:0_1px_2px_rgba(14,25,54,0.35)]">
              Lancer le phoning
            </span>
            <ArrowRight
              aria-hidden="true"
              className="size-[22px] transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.4}
            />
          </Link>
          <p className="text-center text-[13px] font-semibold text-navy-200">
            <span className="tabular-nums">
              {formatInt(stats.today.appels)} / {formatInt(appelsTarget)}
            </span>{" "}
            appels aujourd&apos;hui
            {appelsMission?.done ? " · mission pliée" : ""}
          </p>
          {isAdmin ? (
            <Link
              href="/stats"
              className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-white/28 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              <BarChart3 aria-hidden="true" className="size-4" />
              Voir les statistiques
            </Link>
          ) : (
            <Link
              href="/aujourd-hui"
              className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-white/28 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              <Target aria-hidden="true" className="size-4" />
              Voir ma journée
            </Link>
          )}
        </div>
      </div>

      {/* Tuiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <HeroTile label="Score du jour" sub={scoreSub}>
          <div className="flex items-baseline gap-1.5">
            <span className="score-number text-[30px] text-white min-[400px]:text-[34px] sm:text-[44px]">
              {formatInt(xpToday)}
            </span>
            <span className="text-base font-extrabold text-gold-500">XP</span>
          </div>
          {record > 0 && (
            <div
              role="progressbar"
              aria-label="Score du jour par rapport à ton record"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={scorePct}
              aria-valuetext={`${scorePct} % du record`}
              className="h-1.5 overflow-hidden rounded-full bg-navy-500"
            >
              <div
                className="h-full rounded-full bg-gold-500 transition-[width] duration-700 motion-safe:animate-meter-fill"
                style={{ width: `${scorePct}%` }}
              />
            </div>
          )}
        </HeroTile>

        <HeroTile label="Série en cours" sub={streakSub || undefined}>
          <div className="flex items-center gap-2">
            <Flame
              aria-hidden="true"
              className={cn(
                "size-7 sm:size-[34px]",
                stats.streak > 0 ? "fill-coral-400 text-coral-100" : "text-navy-300",
              )}
              strokeWidth={1.6}
            />
            <span className="score-number text-[30px] text-white min-[400px]:text-[34px] sm:text-[44px]">
              {formatInt(stats.streak)}
            </span>
            <span className="text-base font-bold text-white">
              {stats.streak >= 2 ? "jours" : "jour"}
            </span>
          </div>
        </HeroTile>

        {me && (
          <HeroTile label="Classement semaine" sub={rankSub || undefined}>
            <div className="flex items-center gap-2">
              <Trophy aria-hidden="true" className="size-6 text-gold-500 sm:size-[30px]" />
              <span className="score-number text-[30px] text-white min-[400px]:text-[34px] sm:text-[44px]">
                <span className="sr-only">Rang </span>
                {rankLabel(me.rank)}
              </span>
              {leaderboard && leaderboard.length > 1 && (
                <span className="text-sm font-bold text-navy-200">
                  sur {leaderboard.length}
                </span>
              )}
            </div>
          </HeroTile>
        )}

        {!isAdmin && money && (
          <HeroTile
            label={`Commissions acquises · ${money.mois}`}
            sub={`Salaire prévu ${formatCHFCompact(money.salairePrevu)} · ${money.garantieActive ? "garantie active" : "performance pure"}`}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="score-number text-[30px] text-white min-[400px]:text-[34px] sm:text-[44px]">
                {formatNumber(Math.round(money.commissions))}
              </span>
              <span className="text-base font-extrabold text-win-50">CHF</span>
            </div>
          </HeroTile>
        )}
      </div>
    </HeroPanel>
  );
}
