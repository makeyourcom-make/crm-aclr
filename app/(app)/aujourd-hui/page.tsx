import { DailyGoalsBanner } from "@/components/today/daily-goals-banner";
import { TodayList } from "@/components/today/today-list";
import { TodayShortcuts } from "@/components/today/today-shortcuts";
import { WeekSidebar } from "@/components/today/week-sidebar";
import { getTodayCockpit } from "@/lib/queries/today";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Aujourd'hui" };
export const dynamic = "force-dynamic";

export default async function AujourdhuiPage() {
  const user = await requireUser();
  const cockpit = await getTodayCockpit(user);

  const todayLabel = new Date().toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <TodayShortcuts />

      <DailyGoalsBanner counters={cockpit.jour} />

      <div className="px-6 py-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bonjour {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {todayLabel}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Colonne principale — la liste d'actions */}
          <div>
            <TodayList sections={cockpit.sections} />
          </div>

          {/* Sidebar droite — compteurs hebdo */}
          <aside className="space-y-4">
            <WeekSidebar counters={cockpit.semaine} />

            {/* Aide raccourcis clavier */}
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">
                Raccourcis clavier
              </p>
              <ul className="space-y-1">
                <li>
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                    c
                  </kbd>{" "}
                  appeler le prochain prospect
                </li>
                <li>
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                    Espace
                  </kbd>{" "}
                  marquer la prochaine tâche faite
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
