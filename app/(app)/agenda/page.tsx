import { AddActivityDialog } from "@/components/agenda/add-activity-dialog";
import { AgendaViewSwitcher } from "@/components/agenda/agenda-view-switcher";
import { WeekNav } from "@/components/agenda/week-nav";
import { WeekView } from "@/components/agenda/week-view";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { getAgendaWeek, getStartOfWeek } from "@/lib/queries/agenda";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;

  const weekParam = typeof raw.week === "string" ? raw.week : undefined;
  const requested = weekParam ? new Date(weekParam) : new Date();
  const weekStart = getStartOfWeek(
    isNaN(requested.getTime()) ? new Date() : requested,
  );
  const hideDone = raw.hideDone === "1";

  // Vue admin : "mine" (défaut), "all", ou userId d'une commerciale précise.
  // Ignorée pour les commerciaux (scope verrouillé côté query).
  const view = typeof raw.view === "string" ? raw.view : "mine";
  const isAdmin = user.role === "ADMIN";

  // Pour le switcher : liste des users actifs (admin uniquement)
  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [activities, prospects] = await Promise.all([
    getAgendaWeek(user, weekStart, hideDone, view),
    prisma.prospect.findMany({
      where: {
        ...scopedWhere(user, {}),
        statut: { notIn: ["PERDU", "NE_PAS_RAPPELER"] },
      },
      select: { id: true, raisonSociale: true, ville: true },
      orderBy: { raisonSociale: "asc" },
    }),
  ]);

  const today = new Date();

  // Description dynamique selon la vue active
  const viewedUser =
    view !== "mine" && view !== "all"
      ? teamUsers.find((u) => u.id === view)
      : null;
  const viewLabel = isAdmin
    ? view === "all"
      ? "Toute l'équipe"
      : viewedUser
        ? `Agenda de ${viewedUser.name}`
        : "Mon agenda"
    : "Mon agenda";
  const description = `${activities.length} activité(s) sur la semaine · ${viewLabel}.`;

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Agenda"
        description={description}
        actions={
          <AddActivityDialog
            prospects={prospects}
            defaultDate={toIso(today)}
            defaultTime="09:00"
            triggerMode="header"
          />
        }
      />

      {isAdmin && teamUsers.length > 1 && (
        <div className="mb-3">
          <AgendaViewSwitcher
            users={teamUsers}
            currentUserId={user.id}
            activeView={view}
          />
        </div>
      )}

      <div className="mb-4">
        <WeekNav weekStart={weekStart} hideDone={hideDone} />
      </div>

      <WeekView
        weekStart={weekStart}
        activities={activities}
        prospects={prospects}
        showUserBadge={isAdmin && view === "all"}
      />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Clique « + Ajouter » au bas de chaque jour pour planifier une
        activité (RDV, appel, email…). Drag &amp; drop d&apos;une case
        à l&apos;autre arrive en v2.
      </p>
    </div>
  );
}
