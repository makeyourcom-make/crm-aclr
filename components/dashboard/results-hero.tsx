/**
 * Héros du Dashboard : « où j'en suis et quoi faire maintenant » en 2
 * secondes, centré sur l'argent et les résultats. Devise de l'outil, bonjour,
 * phrase coach (CHF, appels, RDV), gros CTA « Lancer le phoning », puis
 * tuiles de résultats :
 *  - commerciale : CA signé du mois (vs objectif), contrats signés, RDV pris /
 *    effectués, commissions acquises, série, classement de la semaine ;
 *  - admin : CA signé et RDV pris de l'agence cette semaine, en tête de la
 *    semaine, actions en attente (les chiffres du mois sont dans AgencyKpis).
 *
 * Toutes les valeurs viennent de lib/gamification (getPlayerStats,
 * getWeeklyLeaderboard) ou des requêtes du dashboard : rien d'inventé.
 * Server-safe.
 */
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Coins,
  FileSignature,
  Flame,
  Inbox,
  Phone,
  Target,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatInt, pctOf, plural } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { formatCHFCompact, formatNumber } from "@/lib/format";
import { firstNameOf, type LeaderboardEntry, type PlayerStats } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

/** Devise de l'outil (décision d'Arthur, 27.10.2026). */
export const DEVISE = "Chaque appel compte. Chaque RDV est une chance. Chaque signature rapporte.";

export interface HeroMoney {
  /** Commissions générées ce mois (25 % de ce qui est signé, hors budget pub). */
  commissions: number;
  /** Forfait de frais mensuel (ex. 250 CHF). */
  frais: number;
  /** Déjà versées ce mois. */
  versees: number;
  salairePrevu: number;
  garantieActive: boolean;
}

export interface ResultsHeroProps {
  stats: PlayerStats;
  /** Classement de la semaine (CA signé puis RDV pris). */
  weekly: LeaderboardEntry[] | null;
  role: Role;
  /** « Mardi 27.10.2026 · 15:40 » */
  dateLabel: string;
  /** « octobre » */
  mois: string;
  isWorkingDay: boolean;
  /** Commerciale : commissions + salaire prévu du mois. */
  money?: HeroMoney | null;
  /** Nombre d'actions en attente (contrats, RDV à valider, planning). */
  pendingCount?: number;
}

const BIG = "score-number text-[28px] text-white min-[400px]:text-[32px] sm:text-[40px]";

function rankLabel(rank: number): ReactNode {
  return (
    <>
      {rank}
      <span className="text-xl">{rank === 1 ? "er" : "e"}</span>
    </>
  );
}

/** Montant en gros chiffre sur le navy : « 6'831 CHF ». */
function HeroChf({ value }: { value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={BIG}>{formatNumber(Math.round(value))}</span>
      <span className="text-base font-extrabold text-win-50">CHF</span>
    </span>
  );
}

/** Tuile translucide sur le navy du héros. */
function HeroTile({
  label,
  icon: Icon,
  children,
  sub,
  progress,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  sub?: ReactNode;
  /** Jauge vers l'objectif (0-100) avec son libellé accessible. */
  progress?: { pct: number; label: string; reached: boolean } | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[16px] border border-white/12 bg-white/7 p-3.5 sm:p-4">
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </span>
      {children}
      {progress && (
        <div
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.pct}
          aria-valuetext={`${progress.pct} %`}
          className="h-1.5 overflow-hidden rounded-full bg-navy-500"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 motion-safe:animate-meter-fill",
              progress.reached ? "bg-win-500" : "bg-gold-500",
            )}
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      )}
      {sub && <span className="text-xs font-semibold text-navy-200">{sub}</span>}
    </div>
  );
}

const strong = (children: ReactNode) => <strong className="text-white">{children}</strong>;

export function ResultsHero({
  stats,
  weekly,
  role,
  dateLabel,
  mois,
  isWorkingDay,
  money,
  pendingCount = 0,
}: ResultsHeroProps) {
  const isAdmin = role === "ADMIN";
  const appelsTarget = stats.dailyTargets.appels || stats.dailyCallTarget;
  const appelsLeft = Math.max(0, appelsTarget - stats.today.appels);
  const rdvJourTarget = stats.dailyTargets.rdvPris;
  const rdvJourLeft = Math.max(0, rdvJourTarget - stats.today.rdvPris);

  const month = stats.month;
  const targets = stats.monthTargets;
  const caTarget = targets.caSigne;
  const caLeft = caTarget !== null ? Math.max(0, caTarget - month.caSigne) : null;
  const bestRdv = stats.records.bestDayRdvPris;

  // Classement de la semaine
  const me = weekly?.find((e) => e.isMe) ?? null;
  const leader = weekly?.[0] ?? null;
  const second = (weekly ?? []).find((e) => !e.isMe) ?? null;
  const agenceCa = (weekly ?? []).reduce((s, e) => s + e.caSigne, 0);
  const agenceRdv = (weekly ?? []).reduce((s, e) => s + e.rdvPris, 0);
  const agenceContrats = (weekly ?? []).reduce((s, e) => s + e.contratsSignes, 0);
  const agenceAppels = (weekly ?? []).reduce((s, e) => s + e.appels, 0);

  // ---- Phrase coach (données réelles uniquement, orientée argent / résultats) ----
  const coach: ReactNode[] = [];
  if (isAdmin) {
    coach.push(
      pendingCount > 0 ? (
        <>
          Tu as {strong(plural(pendingCount, "action"))} en attente : contrats, RDV ou
          planning.
        </>
      ) : (
        <>Tout est à jour. Place au pilotage de l&apos;équipe.</>
      ),
    );
    if (weekly) {
      coach.push(
        agenceCa > 0 || agenceRdv > 0 ? (
          <>
            Cette semaine, l&apos;agence a signé {strong(formatCHFCompact(agenceCa))} et pris{" "}
            {strong(plural(agenceRdv, "RDV", "RDV"))}.
          </>
        ) : (
          <>Rien de signé ni de RDV pris cette semaine pour l&apos;instant.</>
        ),
      );
    }
  } else {
    if (!isWorkingDay && stats.today.appels === 0) {
      coach.push(<>Jour de repos : la série reprend au prochain jour ouvré.</>);
    } else if (rdvJourLeft > 0) {
      coach.push(<>Encore {strong(plural(rdvJourLeft, "RDV", "RDV"))} à décrocher pour ton objectif du jour.</>);
    } else {
      coach.push(<>Objectif de RDV du jour atteint, bravo.</>);
    }
    if (bestRdv > 0 && stats.today.rdvPris > 0 && stats.today.rdvPris >= bestRdv) {
      coach.push(
        <>Tu tiens ta meilleure journée en RDV pris : {strong(plural(stats.today.rdvPris, "RDV", "RDV"))}.</>,
      );
    } else if (isWorkingDay && bestRdv > 0 && bestRdv - stats.today.rdvPris === 1) {
      coach.push(<>{strong("1 RDV de plus")} et tu égales ton record.</>);
    }
    if (caTarget !== null && caLeft !== null) {
      coach.push(
        caLeft > 0 ? (
          <>Il te manque {strong(formatCHFCompact(caLeft))} pour l&apos;objectif du mois.</>
        ) : (
          <>Objectif du mois atteint : {strong(formatCHFCompact(month.caSigne))} signés.</>
        ),
      );
    } else if (month.caSigne > 0) {
      coach.push(<>{strong(formatCHFCompact(month.caSigne))} signés en {mois}.</>);
    }
    if (stats.streak >= 2) {
      coach.push(<>Série en cours : {strong(plural(stats.streak, "jour"))}.</>);
    }
  }
  const coachShown = coach.slice(0, 3);

  // ---- Tuile classement (commerciale) ----
  let rankSub = "";
  if (me) {
    const resume = `${formatCHFCompact(me.caSigne)} · ${plural(me.rdvPris, "RDV", "RDV")}`;
    if (me.caSigne <= 0 && me.rdvPris <= 0 && (leader?.caSigne ?? 0) <= 0 && (leader?.rdvPris ?? 0) <= 0) {
      rankSub = "Personne n'a encore signé ni pris de RDV cette semaine";
    } else if (me.rank === 1 && second) {
      const d = me.caSigne - second.caSigne;
      rankSub =
        d > 0
          ? `${resume} · ${formatCHFCompact(d)} d'avance sur ${firstNameOf(second.name)}`
          : `${resume} · en tête`;
    } else if (me.rank > 1 && leader) {
      const d = leader.caSigne - me.caSigne;
      const r = leader.rdvPris - me.rdvPris;
      rankSub =
        d > 0
          ? `${resume} · ${formatCHFCompact(d)} derrière ${firstNameOf(leader.name)}`
          : r > 0
            ? `${resume} · ${plural(r, "RDV", "RDV")} derrière ${firstNameOf(leader.name)}`
            : resume;
    } else {
      rankSub = resume;
    }
  }

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

  const rdvTarget = targets.rdv;
  const contratsTarget = targets.contratsSignes;

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
          <p className="text-xs leading-snug font-bold text-coral-100 sm:whitespace-nowrap sm:text-sm">
            {DEVISE}
          </p>
          <h2
            id="hero-titre"
            className="font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em] break-words text-white sm:text-[44px]"
          >
            Bonjour {stats.firstName || "toi"}
          </h2>
          {coachShown.length > 0 && (
            <p className="max-w-[560px] text-[15px] leading-normal font-medium text-navy-200 sm:text-base">
              {coachShown.map((c, i) => (
                <span key={i}>
                  {i > 0 ? " " : ""}
                  {c}
                </span>
              ))}
            </p>
          )}
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
              {formatInt(stats.today.rdvPris)} / {formatInt(rdvJourTarget)}
            </span>{" "}
            RDV pris aujourd&apos;hui · {plural(stats.today.appels, "appel")}
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

      {/* Tuiles de résultats */}
      {isAdmin ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {weekly && (
            <>
              <HeroTile
                label="CA signé · agence cette semaine"
                icon={Coins}
                sub={plural(agenceContrats, "contrat signé", "contrats signés")}
              >
                <HeroChf value={agenceCa} />
              </HeroTile>
              <HeroTile
                label="RDV pris · agence cette semaine"
                icon={CalendarCheck}
                sub={plural(agenceAppels, "appel passé", "appels passés")}
              >
                <span className={BIG}>{formatInt(agenceRdv)}</span>
              </HeroTile>
              <HeroTile
                label="En tête de la semaine"
                icon={Trophy}
                sub={
                  leader && (leader.caSigne > 0 || leader.rdvPris > 0)
                    ? `${formatCHFCompact(leader.caSigne)} · ${plural(leader.rdvPris, "RDV", "RDV")}`
                    : "Personne n'a encore marqué cette semaine"
                }
              >
                <span className="truncate font-display text-2xl font-extrabold text-white sm:text-[28px]">
                  {leader && (leader.caSigne > 0 || leader.rdvPris > 0)
                    ? firstNameOf(leader.name)
                    : "Personne"}
                </span>
              </HeroTile>
            </>
          )}
          <HeroTile
            label="Actions en attente"
            icon={Inbox}
            sub={pendingCount > 0 ? "contrats, RDV à valider, planning" : "tout est traité"}
          >
            <span className={BIG}>{formatInt(pendingCount)}</span>
          </HeroTile>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          <HeroTile
            label={`CA signé · ${mois}`}
            icon={Coins}
            progress={
              caTarget !== null
                ? {
                    pct: pctOf(month.caSigne, caTarget),
                    label: "CA signé du mois par rapport à l'objectif",
                    reached: month.caSigne >= caTarget,
                  }
                : null
            }
            sub={
              caTarget !== null && caLeft !== null
                ? caLeft > 0
                  ? `Objectif ${formatCHFCompact(caTarget)} · il manque ${formatCHFCompact(caLeft)}`
                  : `Objectif ${formatCHFCompact(caTarget)} atteint`
                : "Pas d'objectif de CA fixé ce mois"
            }
          >
            <HeroChf value={month.caSigne} />
          </HeroTile>

          <HeroTile
            label={`Contrats signés · ${mois}`}
            icon={FileSignature}
            progress={
              contratsTarget !== null
                ? {
                    pct: pctOf(month.contratsSignes, contratsTarget),
                    label: "Contrats signés du mois par rapport à l'objectif",
                    reached: month.contratsSignes >= contratsTarget,
                  }
                : null
            }
            sub={
              contratsTarget !== null
                ? `Objectif ${formatInt(contratsTarget)}`
                : `${formatInt(month.propositions)} ${month.propositions >= 2 ? "propositions envoyées" : "proposition envoyée"}`
            }
          >
            <span className={BIG}>{formatInt(month.contratsSignes)}</span>
          </HeroTile>

          <HeroTile
            label={`RDV pris · ${mois}`}
            icon={CalendarCheck}
            progress={
              rdvTarget !== null
                ? {
                    pct: pctOf(month.rdvEffectues, rdvTarget),
                    label: "RDV effectués du mois par rapport à l'objectif",
                    reached: month.rdvEffectues >= rdvTarget,
                  }
                : null
            }
            sub={
              rdvTarget !== null
                ? `${formatInt(month.rdvEffectues)} / ${formatInt(rdvTarget)} effectués (objectif)`
                : `${formatInt(month.rdvEffectues)} ${month.rdvEffectues >= 2 ? "effectués" : "effectué"}`
            }
          >
            <span className={BIG}>{formatInt(month.rdvPris)}</span>
          </HeroTile>

          {money && (
            <HeroTile
              label={`Commission sur tes signatures · ${mois}`}
              icon={Wallet}
              sub="25 % de ce que tu signes, budget pub exclu"
            >
              <HeroChf value={money.commissions} />
            </HeroTile>
          )}

          <HeroTile label="Série en cours" icon={Flame} sub={streakSub || undefined}>
            <span className="flex items-baseline gap-2">
              <span className={BIG}>{formatInt(stats.streak)}</span>
              <span className="text-base font-bold text-white">
                {stats.streak >= 2 ? "jours" : "jour"}
              </span>
            </span>
          </HeroTile>

          {me && (
            <HeroTile label="Classement semaine" icon={Trophy} sub={rankSub || undefined}>
              <span className="flex items-baseline gap-2">
                <span className={BIG}>
                  <span className="sr-only">Rang </span>
                  {rankLabel(me.rank)}
                </span>
                {weekly && weekly.length > 1 && (
                  <span className="text-sm font-bold text-navy-200">sur {weekly.length}</span>
                )}
              </span>
            </HeroTile>
          )}
        </div>
      )}
    </HeroPanel>
  );
}
