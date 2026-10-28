import { Check, Coins, TrendingUp, Wallet } from "lucide-react";

import { plural } from "@/components/arena/format";
import { MoneyStat } from "@/components/arena/money-stat";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { ActivityOverview } from "@/components/dashboard/activity-overview";
import {
  ContratsASigner,
  ContratsAValiderDefinitif,
} from "@/components/dashboard/admin-contracts";
import { AgencyKpis } from "@/components/dashboard/agency-kpis";
import { CommissionsChartLazy as CommissionsChart } from "@/components/dashboard/commissions-chart-lazy";
import { DailyGoalsSection } from "@/components/dashboard/daily-goals-section";
import { zDateLong, zTime } from "@/components/dashboard/dates";
import { ResultsLeaderboard } from "@/components/dashboard/leaderboard";
import { MonthlyGoals } from "@/components/dashboard/monthly-goals";
import { PlanningAlertCard } from "@/components/dashboard/planning-alert-card";
import { RdvAValiderBanner } from "@/components/dashboard/rdv-a-valider";
import { RecordsSection } from "@/components/dashboard/records-section";
import { ResultsFeed } from "@/components/dashboard/results-feed";
import { DEVISE, ResultsHero } from "@/components/dashboard/results-hero";
import { TeamActivity } from "@/components/dashboard/team-activity";
import { UpcomingRdvSection } from "@/components/dashboard/upcoming-rdv";
import { PageHeader } from "@/components/page-header";
import { formatCHFCompact } from "@/lib/format";
import {
  getMonthlyLeaderboard,
  getPlayerStats,
  getWeeklyLeaderboard,
} from "@/lib/gamification";
import { getPlanningAlertes } from "@/lib/planning/queries";
import {
  getActivityPeriods,
  getDashboard,
  getMonthCalendar,
  getResultsFeed,
  getUpcomingRdv,
  isTodayWorkingDay,
} from "@/lib/queries/dashboard";
import { getRdvAValider } from "@/lib/queries/rdv-a-valider";
import {
  getTeamActivityOverview,
  resolvePeriode,
} from "@/lib/queries/stats";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Blocs de résultats : si une de ces requêtes échoue, le dashboard reste
 * utilisable (blocs métier intacts), seul le bloc concerné disparaît.
 */
async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.error(`[dashboard] ${label} a échoué :`, err);
    return null;
  }
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  // Pilotage équipe (admin) : activité par collaborateur sur jour/semaine/mois.
  const raw = await searchParams;
  const periodeActivite = resolvePeriode(
    typeof raw.activite === "string" ? raw.activite : "jour",
  );
  const now = new Date();
  const todayZurich = now.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });

  const [
    data,
    // Alerte planning de production (tâches du jour / en retard).
    planning,
    // Rappel de fin de journée : RDV passés à valider (effectué / manqué / annulé).
    rdvAValider,
    teamActivity,
    stats,
    weekly,
    monthly,
    upcoming,
    feed,
    periods,
  ] = await Promise.all([
    getDashboard(user),
    getPlanningAlertes(user.id),
    getRdvAValider(user.id),
    isAdmin
      ? getTeamActivityOverview(periodeActivite.start, periodeActivite.end)
      : Promise.resolve(null),
    safe("getPlayerStats", () => getPlayerStats(user.id)),
    safe("getWeeklyLeaderboard", () => getWeeklyLeaderboard(user.id)),
    safe("getMonthlyLeaderboard", () => getMonthlyLeaderboard(user.id)),
    safe("getUpcomingRdv", () => getUpcomingRdv(user.id)),
    isAdmin ? Promise.resolve(null) : safe("getResultsFeed", () => getResultsFeed(user.id)),
    isAdmin
      ? Promise.resolve(null)
      : safe("getActivityPeriods", () => getActivityPeriods(user.id)),
  ]);

  const calendar = getMonthCalendar(now);
  const contratsDefinitif = isAdmin ? (data.contratsAValiderDefinitif ?? []) : [];
  const contratsASigner = isAdmin ? (data.contratsAValider ?? []) : [];
  const hasPlanning = planning.aujourdhui > 0 || planning.enRetard > 0;
  const pendingCount =
    rdvAValider.rdvs.length +
    planning.aujourdhui +
    planning.enRetard +
    contratsDefinitif.length +
    contratsASigner.length;

  const pipelinePondere = data.topDeals.reduce((s, d) => s + d.montantPondere, 0);
  const caTotal12 = data.evolutionCASignatures.reduce((s, m) => s + m.montant, 0);
  const firstName = user.name.split(" ")[0];

  const dailyTarget = (key: "appels" | "rdvPris" | "propositions") =>
    stats?.dailyTargets[key] ?? null;
  const hasLeaderboard = weekly !== null || monthly !== null;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={stats ? "Dashboard" : `Bonjour ${firstName}`}
        description={`Vue d'ensemble · ${calendar.label}`}
      />

      <div className="flex flex-col gap-6">
      {stats && (
        <ResultsHero
          stats={stats}
          weekly={weekly}
          role={user.role}
          dateLabel={`${zDateLong(now)} · ${zTime(now)}`}
          mois={calendar.mois}
          isWorkingDay={isTodayWorkingDay(now)}
          money={
            isAdmin
              ? null
              : {
                  commissions: data.commissionsEstimeesMois,
                  frais: data.forfaitFraisMois,
                  versees: data.commissionsAcquisesMois,
                  salairePrevu: data.salairePrevuMois,
                  garantieActive: data.garantieActiveMois,
                }
          }
          pendingCount={pendingCount}
        />
      )}

      {/* Résultats indisponibles : on garde la devise, le CA signé et la
          rémunération (requêtes du dashboard). */}
      {!stats && <p className="text-sm font-bold text-coral-600">{DEVISE}</p>}
      {!stats && !isAdmin && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          <MoneyStat
            label={`CA signé · ${calendar.mois}`}
            amount={data.monthlyProgress.caRealise}
            target={data.monthlyProgress.caObjectif}
            icon={Coins}
            tone="green"
            href="/contrats"
          />
          <MoneyStat
            label={`Commission sur tes signatures · ${calendar.mois}`}
            amount={data.commissionsEstimeesMois}
            sub="25 % de ce que tu signes, budget pub exclu · moitié à la signature, moitié étalée sur les mois restants du contrat"
            icon={Wallet}
            tone="green"
          />
          <MoneyStat
            label="Salaire prévu"
            amount={data.salairePrevuMois}
            sub={data.garantieActiveMois ? "Garantie active" : "Performance pure"}
            icon={Wallet}
            tone={data.garantieActiveMois ? "gold" : "green"}
          />
        </div>
      )}

      {/* ==================================================================
          À TRAITER MAINTENANT : contrats (admin), RDV à valider, planning
      ================================================================== */}
      <section aria-labelledby="traiter-titre" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="traiter-titre"
            className="font-display text-xl font-extrabold tracking-[-0.02em] text-foreground"
          >
            À traiter maintenant
          </h2>
          {pendingCount > 0 ? (
            <StatusPill tone="red" size="md">
              {plural(pendingCount, "action en attente", "actions en attente")}
            </StatusPill>
          ) : (
            <StatusPill tone="green" icon={Check} size="md">
              Tout est traité
            </StatusPill>
          )}
        </div>

        {/* Contrats contre-signés par la commerciale → validation DÉFINITIVE
            (admin uniquement). C'est l'étape finale. */}
        <ContratsAValiderDefinitif contrats={contratsDefinitif} />
        {/* Contrats en attente de contre-signature ACLR (admin uniquement) */}
        <ContratsASigner contrats={contratsASigner} />

        <div className="flex flex-wrap items-stretch gap-4 empty:hidden">
          <RdvAValiderBanner
            rdvs={rdvAValider.rdvs}
            today={todayZurich}
            className="flex-[3_1_460px]"
          />
          {/* Planning de production : tâches du jour + retards (alerte rouge
              au-delà d'un mois de retard, règle validée avec Arthur). */}
          {hasPlanning && (
            <PlanningAlertCard planning={planning} className="flex-[2_1_360px]" />
          )}
        </div>

        {pendingCount === 0 && (
          <p className="rounded-[16px] border border-win-500/30 bg-win-50 px-4 py-3 text-[13px] font-semibold text-win-700">
            Aucun RDV à valider, planning à jour
            {isAdmin ? ", aucun contrat en attente" : ""}. Place aux appels !
          </p>
        )}
      </section>

      {isAdmin ? (
        <>
          {/* KPI agence */}
          <AgencyKpis data={data} />

          {/* Pilotage équipe : activité par collaborateur (jour/semaine/mois) */}
          {teamActivity && (
            <TeamActivity rows={teamActivity} periode={periodeActivite} />
          )}

          {(hasLeaderboard || upcoming) && (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              {hasLeaderboard && <ResultsLeaderboard weekly={weekly} monthly={monthly} />}
              {upcoming && (
                <UpcomingRdvSection
                  rdvs={upcoming.rdvs}
                  restantsSemaine={upcoming.restantsSemaine}
                  today={todayZurich}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {stats && <DailyGoalsSection goals={stats.dailyGoals} />}

          {periods && (
            <ActivityOverview
              periods={periods}
              objectifs={{
                jour: {
                  appels: dailyTarget("appels"),
                  rdvPris: dailyTarget("rdvPris"),
                  propositions: dailyTarget("propositions"),
                },
                mois: {
                  appels: data.monthlyProgress.nbAppelsObjectif,
                  rdvEffectues: data.monthlyProgress.nbRdvObjectif,
                },
              }}
            />
          )}

          <div className="flex flex-wrap items-stretch gap-6">
            <MonthlyGoals
              progress={data.monthlyProgress}
              isAdmin={false}
              calendar={calendar}
              evolution={data.evolutionCASignatures}
              pipeline={{ montant: pipelinePondere, deals: data.topDeals.length }}
              className="flex-[3_1_560px]"
            />
            {hasLeaderboard && (
              <ResultsLeaderboard
                weekly={weekly}
                monthly={monthly}
                className="flex-[2_1_340px]"
              />
            )}
          </div>

          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {upcoming && (
              <UpcomingRdvSection
                rdvs={upcoming.rdvs}
                restantsSemaine={upcoming.restantsSemaine}
                today={todayZurich}
              />
            )}
            {feed && <ResultsFeed items={feed} today={todayZurich} />}
            {stats && <RecordsSection stats={stats} todayKey={todayZurich} />}
          </div>
        </>
      )}

      <SectionCard
        title="Évolution du CA signé · 12 derniers mois"
        icon={TrendingUp}
        tone="navy"
        description={`${isAdmin ? "Valeur totale des contrats signés, toute l'agence" : "Valeur totale de tes contrats signés"} · ${formatCHFCompact(caTotal12)} sur 12 mois`}
      >
        <CommissionsChart data={data.evolutionCASignatures} tooltipLabel="CA signé" />
      </SectionCard>
      </div>
    </div>
  );
}
