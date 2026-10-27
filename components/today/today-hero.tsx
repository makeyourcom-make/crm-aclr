/**
 * Zone héros de « Ma journée » : où j'en suis et quoi faire maintenant.
 *
 *   - gauche : titre coach (appels restants pour l'objectif du jour), phrase
 *     de rythme calculée sur les vrais appels du jour, CTA Phoning, accès aux
 *     rappels, puis les résultats : RDV pris aujourd'hui vs record, RDV pris
 *     cette semaine, CA signé du mois vs objectif, série vs record
 *   - droite : les 3 objectifs du jour (appels, RDV pris, propositions),
 *     mêmes chiffres que la topbar et le dashboard
 *
 * Server-safe. Toutes les valeurs viennent de getPlayerStats() et du cockpit :
 * aucun chiffre inventé (pas d'objectif mensuel défini = pas de texte d'objectif).
 */
import { ArrowRight, Flame, Phone } from "lucide-react";
import Link from "next/link";

import { formatInt, pctOf, plural } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { DailyGoalCard } from "@/components/arena/mission-card";
import { formatMoneyAmount, moneyTargetText } from "@/components/arena/money-stat";
import { buttonVariants } from "@/components/ui/button";
import {
  DAILY_GOALS_TITLE,
  dailyGoalsFor,
  type DailyGoal,
  type PlayerStats,
} from "@/lib/gamification/rules";
import type { TodayCockpit } from "@/lib/queries/today";

interface TodayHeroProps {
  stats: PlayerStats;
  now: TodayCockpit["now"];
  /** Actions en retard encore ouvertes. */
  retards: number;
  /** Rappels (appels planifiés) restant aujourd'hui. */
  rappels: number;
  premierAppelMs: number | null;
  /** RDV pris cette semaine (null si les compteurs de la semaine sont indisponibles). */
  rdvSemaine: number | null;
}

const HOUR_MS = 3_600_000;

/** « 13 appels », « 1 RDV », « 1 proposition ». */
function leftLabel(m: DailyGoal): string {
  if (m.key === "appels") return plural(m.remaining, "appel");
  if (m.key === "rdvPris") return `${formatInt(m.remaining)} RDV`;
  return plural(m.remaining, "proposition");
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
  appels: DailyGoal;
  streak: number;
  isWorkingDay: boolean;
  nowMs: number;
  nowClock: string;
  premierAppelMs: number | null;
  retards: number;
  rappels: number;
}): string {
  const left = appels.remaining;
  const serie = isWorkingDay ? ` et ta série passe à ${plural(streak + 1, "jour")}` : "";
  let rythme: string;

  if (appels.done) {
    rythme = isWorkingDay
      ? `Objectif d'appels atteint : ta série de ${plural(streak, "jour")} continue. Chaque appel de plus peut devenir un RDV.`
      : "Objectif d'appels atteint. Chaque appel de plus peut devenir un RDV.";
  } else if (appels.current === 0) {
    rythme =
      streak > 0
        ? `Ta série de ${plural(streak, "jour")} continue si tu passes tes ${plural(appels.target, "appel")} aujourd'hui.`
        : `${plural(appels.target, "appel")} aujourd'hui et ta série démarre. Chaque appel compte.`;
  } else {
    const hours = premierAppelMs ? (nowMs - premierAppelMs) / HOUR_MS : 0;
    if (appels.current >= 3 && hours >= 0.33) {
      const rate = appels.current / hours;
      const eta = minutesOfClock(nowClock) + (left / rate) * 60;
      const perHour = Math.max(1, Math.round(rate));
      rythme =
        eta <= 20 * 60
          ? `À ton rythme de ${plural(perHour, "appel")} par heure, ton objectif est atteint vers ${clockOfMinutes(eta)}${serie}.`
          : `À ton rythme de ${plural(perHour, "appel")} par heure, accélère pour atteindre ton objectif aujourd'hui.`;
    } else {
      rythme = `Encore ${plural(left, "appel")} pour ton objectif${serie}.`;
    }
  }

  let suite: string;
  if (retards > 1) suite = `Commence par traiter tes ${formatInt(retards)} retards, puis enchaîne les rappels.`;
  else if (retards === 1) suite = "Traite ton dernier retard, puis enchaîne les rappels.";
  else if (rappels > 0) suite = "Zéro retard : enchaîne tes rappels.";
  else suite = "Zéro retard : place au phoning.";

  return `${rythme} ${suite}`;
}

/** Texte du record de RDV pris en une journée (aujourd'hui inclus ou non dans le record). */
function rdvRecordText(today: number, record: number): string {
  if (record <= 0) return "Ton premier RDV pris pose ton record";
  if (today > record) return "Nouveau record en cours : chaque RDV de plus le repousse";
  if (today === record) {
    return today > 0
      ? "Tu es à ton record : 1 RDV de plus et tu le bats"
      : "Décroche un RDV pour poser ton record";
  }
  const left = record - today;
  return left === 1
    ? "1 RDV de plus et tu égales ton record"
    : `Encore ${formatInt(left)} RDV pour égaler ton record`;
}

export function TodayHero({
  stats,
  now,
  retards,
  rappels,
  premierAppelMs,
  rdvSemaine,
}: TodayHeroProps) {
  const goals =
    stats.dailyGoals.length > 0 ? stats.dailyGoals : dailyGoalsFor(stats.today, stats.dailyTargets);
  const appels = goals.find((m) => m.key === "appels") ?? dailyGoalsFor(stats.today, stats.dailyTargets)[0];
  const goalsDone = goals.filter((m) => m.done).length;
  const nextGoal = goals.find((m) => !m.done && m.key !== "appels");

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

  const rdvToday = stats.today.rdvPris;
  const rdvRecord = stats.records.bestDayRdvPris;
  const rdvPct = rdvRecord > 0 ? pctOf(rdvToday, rdvRecord) : 0;
  const caTargetTxt = moneyTargetText(stats.month.caSigne, stats.monthTargets.caSigne);

  return (
    <HeroPanel aria-labelledby="hero-titre" className="flex flex-wrap items-stretch gap-7">
      {/* ---- Gauche : coach + CTA + résultats ---- */}
      <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-navy-100 uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-win-500" />
            À jour · {now.heure}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-400/20 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-coral-100 uppercase">
            <Flame aria-hidden="true" className="size-3.5" />
            {stats.streak > 0
              ? `Série de ${plural(stats.streak, "jour")}`
              : "Pas encore de série"}
          </span>
        </div>

        <h2
          id="hero-titre"
          className="font-display text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white sm:text-4xl"
        >
          {now.titre} ·{" "}
          {!appels.done ? (
            <>
              il te reste <span className="text-coral-400">{leftLabel(appels)}</span> pour ton
              objectif
            </>
          ) : goalsDone === goals.length ? (
            <>
              <span className="text-coral-400">objectifs du jour atteints</span>
            </>
          ) : nextGoal ? (
            <>
              appels faits, encore <span className="text-coral-400">{leftLabel(nextGoal)}</span>
            </>
          ) : (
            <>
              objectif d&apos;appels <span className="text-coral-400">atteint</span>
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

        <dl className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-4 border-t border-white/12 pt-4">
          {/* RDV pris aujourd'hui vs record */}
          <div className="min-w-0">
            <dt className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
              RDV pris aujourd&apos;hui
            </dt>
            <dd className="mt-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="score-number text-[40px] text-white">{formatInt(rdvToday)}</span>
                {rdvRecord > 0 && (
                  <span className="text-[13px] text-navy-200">· record {formatInt(rdvRecord)}</span>
                )}
              </div>
              {rdvRecord > 0 && (
                <div
                  role="progressbar"
                  aria-label="RDV pris aujourd'hui par rapport au record journalier"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={rdvPct}
                  aria-valuetext={`${rdvPct} % du record`}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-gold-500 transition-[width] duration-700 ease-out motion-safe:animate-meter-fill"
                    style={{ width: `${rdvPct}%` }}
                  />
                </div>
              )}
              <div className="mt-1.5 text-xs text-navy-200">{rdvRecordText(rdvToday, rdvRecord)}</div>
            </dd>
          </div>

          {/* RDV pris cette semaine */}
          {rdvSemaine !== null && (
            <div className="min-w-0">
              <dt className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
                RDV pris cette semaine
              </dt>
              <dd className="mt-1">
                <span className="score-number text-[40px] text-white">{formatInt(rdvSemaine)}</span>
                <div className="mt-1.5 text-xs text-navy-200">
                  Chaque RDV est une chance de signer
                </div>
              </dd>
            </div>
          )}

          {/* CA signé du mois vs objectif */}
          <div className="min-w-0">
            <dt className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
              CA signé ce mois
            </dt>
            <dd className="mt-1">
              <span className="score-number text-[32px] text-white">
                {formatMoneyAmount(stats.month.caSigne)}
              </span>
              <div className="mt-1.5 text-xs text-navy-200">
                {caTargetTxt ??
                  `${plural(stats.month.contratsSignes, "contrat signé", "contrats signés")} ce mois`}
              </div>
            </dd>
          </div>

          {/* Série */}
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-coral-400/20 text-coral-400"
            >
              <Flame className="size-[26px]" />
            </span>
            <div>
              <dt className="sr-only">Série</dt>
              <dd>
                <div className="font-display text-2xl font-extrabold text-white">
                  {plural(stats.streak, "jour")}
                </div>
                <div className="text-xs text-navy-200">
                  de série · record {formatInt(Math.max(stats.streakRecord, stats.streak))}
                </div>
              </dd>
            </div>
          </div>
        </dl>
      </div>

      {/* ---- Droite : objectifs du jour ---- */}
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
            {DAILY_GOALS_TITLE}
          </h3>
          <span className="text-[13px] font-bold text-white">
            {formatInt(goalsDone)} / {formatInt(goals.length)} atteints
          </span>
        </div>
        <ul className="flex flex-1 flex-col gap-3">
          {goals.map((g) => (
            <li key={g.key}>
              <DailyGoalCard goal={g} className="text-foreground" />
            </li>
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}
