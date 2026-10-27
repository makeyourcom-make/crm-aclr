/**
 * Zone héros de « Ma journée » : où j'en suis et quoi faire maintenant.
 *
 *   - gauche : titre coach (appels restants pour la mission), phrase de
 *     rythme calculée sur les vrais appels du jour, CTA Phoning, accès aux
 *     rappels, Power score du jour vs record, série en cours vs record
 *   - droite : les 3 missions du jour (moteur de jeu, mêmes chiffres que la
 *     topbar et le dashboard), +100 XP chacune
 *
 * Server-safe. Toutes les valeurs viennent de getPlayerStats() et du cockpit.
 */
import { ArrowRight, Flame, Phone } from "lucide-react";
import Link from "next/link";

import { formatInt, formatXp, pctOf, plural } from "@/components/arena/format";
import { ProgressRing } from "@/components/arena/progress-ring";
import { HeroPanel } from "@/components/arena/hero-panel";
import type { Tone } from "@/components/arena/tones";
import { buttonVariants } from "@/components/ui/button";
import { XP_RULES, type Mission, type PlayerStats } from "@/lib/gamification/rules";
import type { TodayCockpit } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

interface TodayHeroProps {
  stats: PlayerStats;
  now: TodayCockpit["now"];
  /** Actions en retard encore ouvertes. */
  retards: number;
  /** Rappels (appels planifiés) restant aujourd'hui. */
  rappels: number;
  premierAppelMs: number | null;
}

const HOUR_MS = 3_600_000;

/** Teinte de l'anneau par mission (maquette : appels coral, RDV bleu, proposition violet). */
const RING_TONE: Record<Mission["key"], Tone> = {
  appels: "coral",
  rdvPris: "blue",
  propositions: "violet",
};

function missionLeft(m: Mission): number {
  return Math.max(0, Math.ceil(m.target - m.current));
}

/** « 13 appels », « 1 RDV », « 1 proposition ». */
function leftLabel(m: Mission): string {
  const left = missionLeft(m);
  if (m.key === "appels") return plural(left, "appel");
  if (m.key === "rdvPris") return `${formatInt(left)} RDV`;
  return plural(left, "proposition");
}

function minutesOfClock(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function clockOfMinutes(total: number): string {
  const rounded = Math.ceil(total / 5) * 5;
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

/** Phrase coach : rythme réel du jour + priorité (retards puis rappels). */
function coachText({
  appels,
  streak,
  isWorkingDay,
  nowMs,
  nowClock,
  premierAppelMs,
  retards,
  rappels,
}: {
  appels: Mission;
  streak: number;
  isWorkingDay: boolean;
  nowMs: number;
  nowClock: string;
  premierAppelMs: number | null;
  retards: number;
  rappels: number;
}): string {
  const left = missionLeft(appels);
  const serie = isWorkingDay ? ` et ta série passe à ${plural(streak + 1, "jour")}` : "";
  let rythme: string;

  if (appels.done) {
    rythme = isWorkingDay
      ? `Mission appels pliée : ta série de ${plural(streak, "jour")} est assurée aujourd'hui. Chaque appel de plus fait grimper ton score.`
      : "Mission appels pliée. Chaque appel de plus fait grimper ton score.";
  } else if (appels.current === 0) {
    rythme =
      streak > 0
        ? `Ta série de ${plural(streak, "jour")} t'attend : premier appel +${XP_RULES.appel} XP, +${XP_RULES.conversation} XP de plus s'il décroche.`
        : `Premier appel +${XP_RULES.appel} XP, +${XP_RULES.conversation} XP de plus s'il décroche : lance ta série aujourd'hui.`;
  } else {
    const hours = premierAppelMs ? (nowMs - premierAppelMs) / HOUR_MS : 0;
    if (appels.current >= 3 && hours >= 0.33) {
      const rate = appels.current / hours;
      const eta = minutesOfClock(nowClock) + (left / rate) * 60;
      const perHour = Math.max(1, Math.round(rate));
      rythme =
        eta <= 20 * 60
          ? `À ton rythme de ${plural(perHour, "appel")} par heure, la mission est pliée vers ${clockOfMinutes(eta)}${serie}.`
          : `À ton rythme de ${plural(perHour, "appel")} par heure, accélère pour plier la mission aujourd'hui.`;
    } else {
      rythme = `Encore ${plural(left, "appel")} et la mission est pliée${serie}.`;
    }
  }

  let suite: string;
  if (retards > 1) suite = `Commence par abattre tes ${formatInt(retards)} retards, puis enchaîne les rappels.`;
  else if (retards === 1) suite = "Abats ton dernier retard, puis enchaîne les rappels.";
  else if (rappels > 0) suite = "Zéro retard : enchaîne tes rappels.";
  else suite = "Zéro retard : ardoise propre, place au phoning.";

  return `${rythme} ${suite}`;
}

export function TodayHero({ stats, now, retards, rappels, premierAppelMs }: TodayHeroProps) {
  const missions = stats.missions;
  const appels =
    missions.find((m) => m.key === "appels") ??
    ({
      key: "appels",
      label: "Passer des appels",
      current: stats.today.appels,
      target: stats.dailyCallTarget,
      pct: pctOf(stats.today.appels, stats.dailyCallTarget),
      done: stats.today.appels >= stats.dailyCallTarget,
      xpReward: XP_RULES.missionDuJour,
    } satisfies Mission);
  const missionsDone = missions.filter((m) => m.done).length;
  const nextMission = missions.find((m) => !m.done && m.key !== "appels");

  const coach = coachText({
    appels,
    streak: stats.streak,
    isWorkingDay: now.isWorkingDay,
    nowMs: now.ms,
    nowClock: now.heure,
    premierAppelMs,
    retards,
    rappels,
  });

  const record = stats.xpRecordDay;
  const xpToday = stats.xpToday;
  const recordTxt =
    record <= 0
      ? "Ton premier record se joue aujourd'hui"
      : xpToday >= record
        ? xpToday > 0
          ? "Record du jour en cours : chaque XP le repousse"
          : "Lance la journée pour poser un record"
        : `Encore ${formatXp(record - xpToday)} pour égaler ton record`;
  const recordPct = record > 0 ? pctOf(xpToday, record) : 0;

  return (
    <HeroPanel aria-labelledby="hero-titre" className="flex flex-wrap items-stretch gap-7">
      {/* ---- Gauche : coach + CTA + scores ---- */}
      <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-navy-100 uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-win-500" />
            À jour · {now.heure}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-400/20 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-coral-100 uppercase">
            <Flame aria-hidden="true" className="size-3.5" />
            {stats.streak > 0
              ? `Série de ${plural(stats.streak, "jour")} en jeu`
              : "Lance ta série aujourd'hui"}
          </span>
        </div>

        <h2
          id="hero-titre"
          className="font-display text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white sm:text-4xl"
        >
          {now.titre} ·{" "}
          {!appels.done ? (
            <>
              il te reste <span className="text-coral-400">{leftLabel(appels)}</span> pour la mission
            </>
          ) : missionsDone === missions.length ? (
            <>
              <span className="text-coral-400">{missions.length} missions pliées</span>, machine de guerre
            </>
          ) : nextMission ? (
            <>
              appels pliés, encore <span className="text-coral-400">{leftLabel(nextMission)}</span>
            </>
          ) : (
            <>
              mission appels <span className="text-coral-400">pliée</span>
            </>
          )}
        </h2>

        <p className="max-w-[560px] text-[15px] leading-relaxed text-navy-200">{coach}</p>

        <div className="flex flex-wrap gap-3">
          <Link href="/phoning" className={buttonVariants({ variant: "hero", size: "xl" })}>
            <Phone aria-hidden="true" />
            Lancer le phoning
          </Link>
          {rappels > 0 && (
            <a
              href="#rappels"
              className="inline-flex h-[52px] items-center gap-2 rounded-[12px] border border-white/30 bg-white/[0.08] px-[18px] text-sm font-bold text-white transition-colors hover:bg-white/[0.14]"
            >
              Voir mes {plural(rappels, "rappel")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-6 border-t border-white/12 pt-4">
          <div className="min-w-0 flex-[1_1_220px]">
            <div className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
              Power score du jour
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="score-number text-[40px] text-white">{formatInt(xpToday)}</span>
              <span className="text-sm font-bold text-gold-500">XP</span>
              {record > 0 && (
                <span className="text-[13px] text-navy-200">· record {formatXp(record)}</span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Power score par rapport au record journalier"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={recordPct}
              aria-valuetext={`${recordPct} % du record`}
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"
            >
              <div
                className="h-full rounded-full bg-gold-500 transition-[width] duration-700 ease-out motion-safe:animate-meter-fill"
                style={{ width: `${recordPct}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-navy-200">{recordTxt}</div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-[14px] bg-coral-400/20 text-coral-400"
            >
              <Flame className="size-[26px]" />
            </span>
            <div>
              <div className="font-display text-2xl font-extrabold text-white">
                {plural(stats.streak, "jour")}
              </div>
              <div className="text-xs text-navy-200">
                de série · record {formatInt(Math.max(stats.streakRecord, stats.streak))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Droite : missions du jour ---- */}
      <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
            Missions du jour · +{XP_RULES.missionDuJour} XP chacune
          </h3>
          <span className="text-[13px] font-bold text-white">
            {missionsDone} / {missions.length} pliées
          </span>
        </div>
        <ul className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {missions.map((m) => (
            <MissionTile key={m.key} mission={m} />
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}

function MissionTile({ mission: m }: { mission: Mission }) {
  const pct = Math.min(Math.max(Math.round(m.pct), 0), 100);
  const left = missionLeft(m);
  const reste = m.done
    ? "Mission pliée"
    : m.key === "appels"
      ? `Encore ${plural(left, "appel")}`
      : m.key === "rdvPris"
        ? `Encore ${formatInt(left)} RDV`
        : `Encore ${plural(left, "proposition")}`;

  return (
    <li
      className={cn(
        "flex flex-col items-center gap-2.5 rounded-[16px] border p-4 text-center",
        m.done ? "border-gold-500/60 bg-gold-500/15" : "border-white/12 bg-white/[0.07]",
      )}
    >
      <ProgressRing
        value={m.current}
        max={m.target}
        size={104}
        stroke={10}
        tone={m.done ? "gold" : RING_TONE[m.key]}
        trackColor="rgba(255,255,255,0.14)"
        label={`Mission ${m.label} : ${formatInt(m.current)} sur ${formatInt(m.target)}${m.done ? ", pliée" : ""}`}
      >
        <span className="score-number text-[28px] text-white">{formatInt(m.current)}</span>
        <span className="mt-0.5 text-xs font-bold text-navy-200">sur {formatInt(m.target)}</span>
      </ProgressRing>
      <h4 className="text-sm leading-tight font-bold text-white">{m.label}</h4>
      <p className="min-h-4 text-xs text-navy-200">{reste}</p>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-bold",
          m.done ? "bg-gold-500 text-navy-700" : "bg-white/12 text-white",
        )}
      >
        {m.done ? `Pliée · +${m.xpReward} XP` : `+${m.xpReward} XP · ${pct} %`}
      </span>
    </li>
  );
}
