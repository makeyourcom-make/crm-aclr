"use client";

/**
 * Barre de session (zone héros navy) : chrono, mission appels du jour,
 * combo en cours, XP de la session vs score et record du jour.
 */
import { Flag, Pause, Play, Zap } from "lucide-react";

import { formatInt, pctOf, plural } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { Meter } from "@/components/arena/meter";
import { missionCoach } from "@/components/arena/mission-card";
import { ProgressRing } from "@/components/arena/progress-ring";
import { useNow } from "@/components/call/clock";
import { zDuration, zTime } from "@/components/call/zurich";
import { COMBO_GAP_MINUTES, COMBO_STEPS, XP_RULES, type Mission } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { activeDurationMs, type PhoningSession } from "./phoning-session-store";
import { multLabel, type ComboState, type SessionStats } from "./phoning-stats";

const TILE =
  "flex min-w-0 flex-col gap-2 rounded-[16px] border border-white/12 bg-white/[0.06] p-3.5 sm:p-4";
const EYEBROW = "text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase";

export interface SessionHeroProps {
  session: PhoningSession | null;
  stats: SessionStats;
  combo: ComboState;
  missionAppels: Mission | null;
  missionRdv: Mission | null;
  xpToday: number;
  xpRecordDay: number;
  onStart: () => void;
  onTogglePause: () => void;
  onEnd: () => void;
}

export function SessionHero({
  session,
  stats,
  combo,
  missionAppels,
  missionRdv,
  xpToday,
  xpRecordDay,
  onStart,
  onTogglePause,
  onEnd,
}: SessionHeroProps) {
  const started = !!session?.startedAt;
  const paused = !!session?.pausedAt;
  const appelsCur = missionAppels?.current ?? 0;
  const appelsTarget = missionAppels?.target ?? 40;
  const comboSpan = combo.next ? combo.next.minCalls - combo.floor : 1;
  const comboPct = combo.next ? pctOf(combo.current - combo.floor, comboSpan) : 100;
  const recordPct = xpRecordDay > 0 ? pctOf(xpToday, xpRecordDay) : xpToday > 0 ? 100 : 0;
  const recordLabel =
    xpRecordDay <= 0
      ? "ton premier record se joue aujourd'hui"
      : xpToday >= xpRecordDay
        ? `record de ${formatInt(xpRecordDay)} XP battu !`
        : `record ${formatInt(xpRecordDay)} XP, plus que ${formatInt(xpRecordDay - xpToday)}`;

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

        {/* Mission appels (pleine largeur sur téléphone) */}
        <div className={cn(TILE, "order-first col-span-2 flex-row items-center gap-4 sm:order-none sm:col-span-1")}>
          <ProgressRing
            value={appelsCur}
            max={appelsTarget}
            size={88}
            stroke={9}
            tone="coral"
            trackColor="rgba(255,255,255,0.18)"
            label={`Mission appels : ${formatInt(appelsCur)} sur ${formatInt(appelsTarget)}`}
          >
            <span className="score-number text-2xl text-white">{formatInt(appelsCur)}</span>
            <span className="mt-0.5 text-xs font-bold text-navy-200">
              / {formatInt(appelsTarget)}
            </span>
          </ProgressRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={EYEBROW}>Mission · {formatInt(appelsTarget)} appels</span>
            <span className="text-sm leading-snug font-bold text-white sm:text-[15px]">
              {missionAppels ? missionCoach(missionAppels) : "Lance la machine."}
            </span>
            {missionRdv && (
              <Meter
                value={missionRdv.current}
                max={missionRdv.target}
                tone="green"
                size="sm"
                onDark
                label="RDV"
                valueLabel={`${formatInt(missionRdv.current)} / ${formatInt(missionRdv.target)}`}
              />
            )}
          </div>
        </div>

        {/* Combo */}
        <div className={TILE}>
          <span className={EYEBROW}>Combo actuel</span>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="score-number text-[36px] text-gold-500 sm:text-5xl">
              {multLabel(combo.mult)}
            </span>
            <span className="text-xs font-semibold text-white sm:text-[13px]">
              {plural(combo.current, "appel enchaîné", "appels enchaînés")}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progression du combo"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={comboPct}
            aria-valuetext={
              combo.next
                ? `${combo.next.minCalls - combo.current} appels avant ${multLabel(combo.next.mult)}`
                : "Combo maximum"
            }
            className="h-2.5 overflow-hidden rounded-full bg-white/15"
          >
            <div
              className="h-full rounded-full bg-gradient-coral transition-[width] duration-700"
              style={{ width: `${comboPct}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs font-semibold text-navy-200">
            <span className="text-white">
              {combo.next
                ? `${plural(combo.next.minCalls - combo.current, "appel")} avant ${multLabel(combo.next.mult)}`
                : `Combo max ${multLabel(COMBO_STEPS[COMBO_STEPS.length - 1]?.mult ?? 1)}, garde le rythme`}
            </span>
            <span className="hidden sm:inline">moins de {COMBO_GAP_MINUTES} min entre 2 appels</span>
          </div>
        </div>

        {/* XP session */}
        <div className={cn(TILE, "col-span-2 sm:col-span-1")}>
          <span className={EYEBROW}>XP gagnés en session</span>
          <div className="flex items-baseline gap-1.5">
            <span className="score-number text-[36px] text-gold-500 sm:text-5xl">
              +{formatInt(stats.xp)}
            </span>
            <span className="text-[15px] font-extrabold text-gold-500">XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Score du jour par rapport au record"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={recordPct}
            aria-valuetext={`Score du jour ${formatInt(xpToday)} XP, ${recordLabel}`}
            className="h-1.5 overflow-hidden rounded-full bg-white/15"
          >
            <div className="h-full rounded-full bg-gold-500" style={{ width: `${recordPct}%` }} />
          </div>
          <p className="text-xs font-semibold text-navy-200">
            Jour <strong className="text-white">{formatInt(xpToday)} XP</strong>
            <span className="hidden sm:inline"> · {recordLabel}</span>
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
            <Zap aria-hidden="true" className="size-5 fill-white" />
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
            : `Chaque appel compte : +${XP_RULES.appel} XP, +${XP_RULES.conversation} si ça décroche, +${XP_RULES.rdvPris} le RDV.`}
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
