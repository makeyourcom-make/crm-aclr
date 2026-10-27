"use client";

/**
 * Barre de session (zone héros navy) : chrono, objectif d'appels du jour,
 * conversations et taux de conversation, RDV pris (session, jour, record).
 * Uniquement des chiffres réels (appels du jour en base, objectifs du jour).
 */
import { CalendarCheck, Flag, Pause, Phone, Play } from "lucide-react";

import { formatInt, plural } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { Meter } from "@/components/arena/meter";
import { goalCoach } from "@/components/arena/mission-card";
import { ProgressRing } from "@/components/arena/progress-ring";
import { useNow } from "@/components/call/clock";
import { zDuration, zTime } from "@/components/call/zurich";
import type { DailyGoal } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { activeDurationMs, type PhoningSession } from "./phoning-session-store";
import type { SessionStats } from "./phoning-stats";

const TILE =
  "flex min-w-0 flex-col gap-2 rounded-[16px] border border-white/12 bg-white/[0.06] p-3.5 sm:p-4";
const EYEBROW = "text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase";

export interface SessionHeroProps {
  session: PhoningSession | null;
  stats: SessionStats;
  /** Objectif d'appels du jour (compteurs réels du jour). */
  goalAppels: DailyGoal | null;
  /** Objectif de RDV pris du jour. */
  goalRdv: DailyGoal | null;
  /** Record : meilleure journée en RDV pris (null si inconnu). */
  bestDayRdvPris: number | null;
  onStart: () => void;
  onTogglePause: () => void;
  onEnd: () => void;
}

/** Phrase « record » orientée résultat, uniquement sur données réelles. */
function rdvRecordLine(rdvToday: number, best: number | null): string | null {
  if (best === null || best <= 0) return null;
  if (rdvToday > best) return `Nouveau record : ${formatInt(rdvToday)} RDV aujourd'hui`;
  if (rdvToday === best) return `Tu égales ton record de ${formatInt(best)} RDV en une journée`;
  const left = best - rdvToday;
  return left === 1
    ? "1 RDV de plus et tu égales ton record"
    : `Encore ${formatInt(left)} RDV pour égaler ton record (${formatInt(best)})`;
}

export function SessionHero({
  session,
  stats,
  goalAppels,
  goalRdv,
  bestDayRdvPris,
  onStart,
  onTogglePause,
  onEnd,
}: SessionHeroProps) {
  const started = !!session?.startedAt;
  const paused = !!session?.pausedAt;
  const appelsCur = goalAppels?.current ?? 0;
  const appelsTarget = goalAppels?.target ?? 40;
  const rdvToday = goalRdv?.current ?? stats.rdv;
  const recordLine = rdvRecordLine(rdvToday, bestDayRdvPris);

  return (
    <HeroPanel aria-label="Session de phoning" className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {/* Chrono */}
        <div className={TILE}>
          <div className={cn(EYEBROW, "flex items-center gap-2")}>
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                started && !paused ? "bg-win-500 motion-safe:animate-pulse" : "bg-subtle",
              )}
            />
            <span className="truncate">
              {!started ? "Session prête" : paused ? "En pause" : "Session en cours"}
            </span>
          </div>
          <SessionChrono session={session} />
          <p className="text-xs font-medium text-navy-200 sm:text-[13px]">
            {started && session?.startedAt ? (
              <>
                Démarrée à {zTime(session.startedAt)} ·{" "}
                <strong className="text-white">{plural(stats.calls, "appel")}</strong>
              </>
            ) : (
              "Le chrono démarre à ton premier appel."
            )}
          </p>
        </div>

        {/* Objectif d'appels du jour (pleine largeur sur téléphone) */}
        <div className={cn(TILE, "order-first col-span-2 flex-row items-center gap-4 sm:order-none sm:col-span-1")}>
          <ProgressRing
            value={appelsCur}
            max={appelsTarget}
            size={88}
            stroke={9}
            tone="coral"
            trackColor="rgba(255,255,255,0.18)"
            label={`Objectif d'appels du jour : ${formatInt(appelsCur)} sur ${formatInt(appelsTarget)}`}
          >
            <span className="score-number text-2xl text-white">{formatInt(appelsCur)}</span>
            <span className="mt-0.5 text-xs font-bold text-navy-200">
              / {formatInt(appelsTarget)}
            </span>
          </ProgressRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={EYEBROW}>Objectif du jour · {plural(appelsTarget, "appel")}</span>
            <span className="text-sm leading-snug font-bold text-white sm:text-[15px]">
              {goalAppels ? goalCoach(goalAppels) : "Le premier appel lance la journée."}
            </span>
            {goalRdv && (
              <Meter
                value={goalRdv.current}
                max={goalRdv.target}
                tone="green"
                size="sm"
                onDark
                label="RDV du jour"
                valueLabel={`${formatInt(goalRdv.current)} / ${formatInt(goalRdv.target)}`}
              />
            )}
          </div>
        </div>

        {/* Conversations */}
        <div className={TILE}>
          <span className={cn(EYEBROW, "flex items-center gap-1.5")}>
            <Phone aria-hidden="true" className="size-3.5" />
            Conversations
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="score-number text-[36px] text-white sm:text-5xl">
              {formatInt(stats.conversations)}
            </span>
            <span className="text-xs font-semibold text-navy-200 sm:text-[13px]">
              sur {plural(stats.calls, "appel")}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Taux de conversation de la session"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stats.taux}
            aria-valuetext={`${formatInt(stats.taux)} % des appels décrochés`}
            className="h-2.5 overflow-hidden rounded-full bg-white/15"
          >
            <div
              className="h-full rounded-full bg-gradient-coral transition-[width] duration-700"
              style={{ width: `${stats.taux}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-navy-200">
            Taux de conversation <strong className="text-white">{formatInt(stats.taux)} %</strong>
          </p>
        </div>

        {/* RDV pris */}
        <div className={cn(TILE, "col-span-2 sm:col-span-1")}>
          <span className={cn(EYEBROW, "flex items-center gap-1.5")}>
            <CalendarCheck aria-hidden="true" className="size-3.5" />
            RDV pris en session
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="score-number text-[36px] text-win-500 sm:text-5xl">
              {formatInt(stats.rdv)}
            </span>
            <span className="text-xs font-semibold text-navy-200 sm:text-[13px]">
              {formatInt(rdvToday)} aujourd&apos;hui
            </span>
          </div>
          <p className="text-xs font-semibold text-navy-200">
            {recordLine ??
              (rdvToday > 0
                ? "Chaque RDV est une chance de signer."
                : "Le premier RDV du jour est au bout du fil.")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!started ? (
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-gradient-coral px-4 text-lg font-extrabold text-white shadow-cta text-shadow-[0_1px_1px_rgba(120,20,26,0.35)] transition-[filter] hover:brightness-105"
          >
            <Play aria-hidden="true" className="size-5 fill-white" />
            Démarrer la session
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onTogglePause}
              className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-white/30 bg-white/10 px-4 text-sm font-bold text-white transition-colors hover:bg-white/15"
            >
              {paused ? (
                <Play aria-hidden="true" className="size-4" />
              ) : (
                <Pause aria-hidden="true" className="size-4" />
              )}
              {paused ? "Reprendre" : "Pause"}
            </button>
            <button
              type="button"
              onClick={onEnd}
              className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-sm font-bold text-white underline underline-offset-4 hover:bg-white/10"
            >
              <Flag aria-hidden="true" className="size-4" />
              Terminer la session
            </button>
          </>
        )}
        <span className="ml-auto text-xs font-semibold text-navy-200">
          {started
            ? `${formatInt(stats.conversations)} décroché${stats.conversations > 1 ? "s" : ""} · ${formatInt(stats.rdv)} RDV pris en session`
            : "Chaque appel compte. Chaque RDV est une chance."}
        </span>
      </div>
    </HeroPanel>
  );
}

/** Chrono isolé (seul composant rafraîchi chaque seconde). */
function SessionChrono({ session }: { session: PhoningSession | null }) {
  const running = !!session?.startedAt && !session.pausedAt;
  const now = useNow(1000, running);
  const frozenNow = session?.pausedAt ?? now;
  const ms = activeDurationMs(session, running ? now : frozenNow);
  return (
    <span className="score-number text-[32px] text-white sm:text-5xl">
      <span className="sr-only">Durée de session : </span>
      {zDuration(Math.floor(ms / 1000))}
    </span>
  );
}
