import { WeekNav } from "@/components/agenda/week-nav";
import { WeekView } from "@/components/agenda/week-view";
import { PageHeader } from "@/components/page-header";
import { getAgendaWeek, getStartOfWeek } from "@/lib/queries/agenda";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

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

  const activities = await getAgendaWeek(user, weekStart, hideDone);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Agenda"
        description={`${activities.length} activité(s) sur la semaine.`}
      />

      <div className="mb-4">
        <WeekNav weekStart={weekStart} hideDone={hideDone} />
      </div>

      <WeekView weekStart={weekStart} activities={activities} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Pour drag &amp; drop des cases d&apos;une journée à l&apos;autre, une
        v2 est prévue. Pour l&apos;instant : ✓ Fait marque l&apos;activité,
        J+1 la replanifie au lendemain.
      </p>
    </div>
  );
}
