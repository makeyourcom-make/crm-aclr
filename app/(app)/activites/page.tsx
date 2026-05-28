import { ActivityFilters } from "@/components/activities/activity-filters";
import { ActivityRow } from "@/components/activities/activity-row";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
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
  const params = ActivityListParamsSchema.parse(raw);

  const [{ items, total, page, pageSize, totalPages }, todayStats] =
    await Promise.all([
      getActivities(user, params),
      getTodayCallStats(user),
    ]);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Activités"
        description={`Aujourd'hui : ${todayStats.appelsSortants} appels sortants · ${todayStats.rdvFaits} RDV faits · ${todayStats.emailsEnvoyes} emails envoyés.`}
      />

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
              showUser={user.role === "ADMIN"}
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
