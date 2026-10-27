import { Gauge } from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { CallQueue } from "@/components/today/call-queue";
import { DayCountersCard } from "@/components/today/day-counters";
import { RdvReminder } from "@/components/today/rdv-reminder";
import { RdvValidation } from "@/components/today/rdv-validation";
import { RelancesCard } from "@/components/today/relances-card";
import { ShortcutsHelp } from "@/components/today/shortcuts-help";
import { TodayHero } from "@/components/today/today-hero";
import { TodayList } from "@/components/today/today-list";
import type { DayProgress, DayTargets } from "@/components/today/task-meta";
import { TodayShortcuts } from "@/components/today/today-shortcuts";
import { TomorrowPreview } from "@/components/today/tomorrow-preview";
import { WeekSidebar, type WeeklyGoals } from "@/components/today/week-sidebar";
import { DEFAULT_DAILY_GOALS, DEFAULT_WEEKLY_GOALS } from "@/lib/constants";
import { getPlayerStats } from "@/lib/gamification";
import { DEFAULT_DAILY_TARGETS, type PlayerStats } from "@/lib/gamification/rules";
import { getTodayCockpit } from "@/lib/queries/today";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Ma journée" };
export const dynamic = "force-dynamic";

/** Les compteurs ne doivent jamais casser la feuille de route. */
async function loadStats(userId: string): Promise<PlayerStats | null> {
  try {
    return await getPlayerStats(userId);
  } catch (err) {
    console.error("[aujourd-hui] getPlayerStats a échoué :", err);
    return null;
  }
}

const positive = (v: number | null | undefined): v is number => v != null && v > 0;

export default async function AujourdhuiPage() {
  const user = await requireUser();
  // Page strictement terrain : Arthur n'a pas à voir les tâches de l'équipe
  // ni des objectifs personnels. Redirige vers son dashboard.
  if (user.role === "ADMIN") {
    redirect("/");
  }

  const [cockpit, stats] = await Promise.all([getTodayCockpit(user), loadStats(user.id)]);
  const { sections, now } = cockpit;

  // Cibles du jour : objectifs du jour (objectif QUOTIDIEN actif, sinon
  // 40 appels / 3 RDV / 1 proposition), emails depuis l'objectif quotidien.
  const goalTarget = (key: "appels" | "rdvPris" | "propositions") =>
    stats?.dailyTargets[key] ?? DEFAULT_DAILY_TARGETS[key];
  const objEmails = cockpit.objectif?.emails;
  const objSignatures = cockpit.objectif?.signatures;
  const emailsTarget = positive(objEmails) ? objEmails : DEFAULT_DAILY_GOALS.emails;
  const dayTargets: DayTargets = {
    appels: goalTarget("appels"),
    rdvPris: goalTarget("rdvPris"),
    rdvEffectues: goalTarget("rdvPris"),
    propositions: goalTarget("propositions"),
    emails: emailsTarget,
  };

  // Hebdo = objectif quotidien × jours ouvrés de la semaine.
  const jours = Math.max(1, cockpit.semaine.joursOuvres);
  const weeklyGoals: WeeklyGoals = {
    appels: dayTargets.appels * jours,
    emails: emailsTarget * jours,
    rdv: dayTargets.rdvPris * jours,
    signatures: positive(objSignatures)
      ? objSignatures * jours
      : DEFAULT_WEEKLY_GOALS.signatures,
  };

  const retards = sections.enRetard.length;
  const rappels = [
    ...sections.enRetard,
    ...sections.maintenant,
    ...sections.ceMatin,
    ...sections.cetApresMidi,
    ...sections.ceSoir,
  ].filter((t) => t.kind === "call").length;
  const rdvAValiderAujourdhui = cockpit.rdvAValider.filter((r) => r.isToday).length;

  const firstName = stats?.firstName || user.name.split(" ")[0];
  const progress: DayProgress | null = stats ? { today: stats.today, targets: dayTargets } : null;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <TodayShortcuts />

      <PageHeader
        title="Ma journée"
        description={`Bonjour ${firstName} · ${now.jour} ${now.date} · ta feuille de route, triée par urgence`}
      />

      <div className="flex flex-col gap-6">
        {stats ? (
          <TodayHero
            stats={stats}
            now={now}
            retards={retards}
            rappels={rappels}
            premierAppelMs={cockpit.premierAppelMs}
            rdvSemaine={cockpit.semaine.compteurs?.rdvPris ?? null}
          />
        ) : (
          <div
            role="status"
            className="flex items-center gap-3 rounded-[16px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-arena"
          >
            <Gauge aria-hidden="true" className="size-5 shrink-0 text-subtle" />
            Compteurs et objectifs du jour momentanément indisponibles : ta feuille de route reste
            à jour.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <TodayList
              sections={sections}
              goals={stats?.dailyGoals ?? null}
              today={stats?.today ?? null}
              progress={progress}
            />
            <CallQueue sections={sections} progress={progress} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start gap-6">
              <RdvValidation items={cockpit.rdvAValider} />
              <RelancesCard items={cockpit.relances.items} total={cockpit.relances.total} />
            </div>
          </div>

          <aside aria-label="Compteurs et semaine" className="flex min-w-0 flex-col gap-6">
            {stats && (
              <DayCountersCard
                today={stats.today}
                targets={dayTargets}
                veille={cockpit.veille}
                rdvAValider={rdvAValiderAujourdhui}
              />
            )}
            <RdvReminder items={cockpit.rdvAValider} />
            <WeekSidebar
              semaine={cockpit.semaine}
              goals={weeklyGoals}
              jour={now.jour}
              isWorkingDay={now.isWorkingDay}
            />
            <TomorrowPreview items={sections.demain} />
            <ShortcutsHelp />
          </aside>
        </div>
      </div>
    </div>
  );
}
