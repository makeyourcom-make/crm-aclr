import { Check, TrendingUp, Wallet } from "lucide-react";

import { plural } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { ActivityOverview } from "@/components/dashboard/activity-overview";
import {
  ContratsASigner,
  ContratsAValiderDefinitif,
} from "@/components/dashboard/admin-contracts";
import { AgencyKpis } from "@/components/dashboard/agency-kpis";
import { BadgesSection } from "@/components/dashboard/badges-section";
import { CommissionsChartLazy as CommissionsChart } from "@/components/dashboard/commissions-chart-lazy";
import { zDateLong, zTime } from "@/components/dashboard/dates";
import { MissionsSection } from "@/components/dashboard/missions-section";
import { MonthlyGoals } from "@/components/dashboard/monthly-goals";
import { PlanningAlertCard } from "@/components/dashboard/planning-alert-card";
import { PlayerHero } from "@/components/dashboard/player-hero";
import { RdvAValiderBanner } from "@/components/dashboard/rdv-a-valider";
import { TeamActivity } from "@/components/dashboard/team-activity";
import { UpcomingRdvSection } from "@/components/dashboard/upcoming-rdv";
import { WeeklyLeaderboard } from "@/components/dashboard/weekly-leaderboard";
import { XpFeed } from "@/components/dashboard/xp-feed";
import { PageHeader } from "@/components/page-header";
import { formatCHFCompact } from "@/lib/format";
import { getPlayerStats, getWeeklyLeaderboard } from "@/lib/gamification";
import { getPlanningAlertes } from "@/lib/planning/queries";
import {
  getActivityPeriods,
  getDashboard,
  getMonthCalendar,
  getUpcomingRdv,
  getXpFeed,
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
 * Couche de jeu : si une requête du moteur échoue, le dashboard reste
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
    leaderboard,
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
    safe("getUpcomingRdv", () => getUpcomingRdv(user.id)),
    isAdmin ? Promise.resolve(null) : safe("getXpFeed", () => getXpFeed(user.id)),
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

  const missionTarget = (key: "appels" | "rdvPris") =>
    stats?.missions.find((m) => m.key === key)?.target ?? null;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={stats ? "Dashboard" : `Bonjour ${firstName}`}
        description={`Vue d'ensemble · ${calendar.label}`}
      />

      <div className="flex flex-col gap-6">
      {stats && (
        <PlayerHero
          stats={stats}
          leaderboard={leaderboard}
          role={user.role}
          dateLabel={`${zDateLong(now)} · ${zTime(now)}`}
          isWorkingDay={isTodayWorkingDay(now)}
          money={
            isAdmin
              ? null
              : {
                  commissions: data.commissionsAcquisesMois,
                  salairePrevu: data.salairePrevuMois,
                  garantieActive: data.garantieActiveMois,
                  mois: calendar.mois,
                }
          }
          pendingCount={pendingCount}
        />
      )}

      {/* Moteur de jeu indisponible : on garde les KPI de rémunération. */}
      {!stats && !isAdmin && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <StatTile
            label="Commissions acquises"
            value={formatCHFCompact(data.commissionsAcquisesMois)}
            sub="versées via ton salaire mensuel"
            icon={Wallet}
            tone="green"
          />
          <StatTile
            label="Salaire prévu"
            value={formatCHFCompact(data.salairePrevuMois)}
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
              Tout est traité, bravo
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
            {isAdmin ? ", aucun contrat en attente" : ""}. Place à l&apos;action !
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

          {(leaderboard || upcoming) && (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              {leaderboard && <WeeklyLeaderboard entries={leaderboard} stats={stats} />}
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
          {stats && <MissionsSection missions={stats.missions} />}

          {periods && (
            <ActivityOverview
              periods={periods}
              objectifs={{
                jour: { appels: missionTarget("appels"), rdvPris: missionTarget("rdvPris") },
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
            {leaderboard && (
              <WeeklyLeaderboard
                entries={leaderboard}
                stats={stats}
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
            {feed && <XpFeed items={feed} xpToday={stats?.xpToday ?? 0} today={todayZurich} />}
            {stats && <BadgesSection badges={stats.badges} />}
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
