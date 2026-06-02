import { ActivityFilters } from "@/components/activities/activity-filters";
import { ActivityRow } from "@/components/activities/activity-row";
import { ActivityViewSwitcher } from "@/components/activities/activity-view-switcher";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/db";
import { getActivities, getTodayCallStats } from "@/lib/queries/activities";
import { ActivityListParamsSchema } from "@/lib/schemas/activity";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Activités" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ActivitiesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Vue admin : "mine" (défaut), "all", ou userId d'une commerciale précise.
  const view = typeof raw.view === "string" ? raw.view : "mine";

  // Traduit la vue en filtre userId pour la requête.
  // - "mine" → userId = current user.id
  // - "all" → pas de filtre userId (admin uniquement → voit tout)
  // - userId → filtre par userId spécifique
  // Pour les commerciaux, la requête force déjà leur scope, on ignore "view".
  const filterUserId = (() => {
    if (!isAdmin) return undefined;
    if (view === "all") return undefined;
    if (view === "mine") return user.id;
    return view; // userId d'un autre user
  })();

  const params = ActivityListParamsSchema.parse({
    ...raw,
    userId: filterUserId ?? raw.userId,
  });

  // Liste des users pour le switcher (admin uniquement)
  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [{ items, total, page, pageSize, totalPages }, todayStats] =
    await Promise.all([
      getActivities(user, params),
      getTodayCallStats(user),
    ]);

  // Libellé descriptif de la vue active
  const viewedUser =
    view !== "mine" && view !== "all"
      ? teamUsers.find((u) => u.id === view)
      : null;
  const viewLabel = isAdmin
    ? view === "all"
      ? "Toute l'équipe"
      : viewedUser
        ? `Activités de ${viewedUser.name}`
        : "Mes activités"
    : "Mes activités";

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Activités"
        description={`${viewLabel} · Aujourd'hui : ${todayStats.appelsSortants} appels sortants · ${todayStats.rdvFaits} RDV faits · ${todayStats.emailsEnvoyes} emails envoyés.`}
      />

      {isAdmin && teamUsers.length > 1 && (
        <div className="mb-3">
          <ActivityViewSwitcher
            users={teamUsers}
            currentUserId={user.id}
            activeView={view}
          />
        </div>
      )}

      <div className="mb-4">
        <ActivityFilters params={params} />
      </div>

      <Card className="overflow-hidden p-0">
        {items.length === 0 ? (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">
            Aucune activité ne correspond aux filtres.
          </p>
        ) : (
          items.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              showUser={isAdmin}
              currentUserId={user.id}
            />
          ))
        )}
      </Card>

      <div className="mt-4">
        <Pagination
          current={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
