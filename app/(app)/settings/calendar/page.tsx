import { CalendarFeedManager } from "@/components/settings/calendar-feed-manager";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Synchronisation agenda" };
export const dynamic = "force-dynamic";

/**
 * Page de configuration de l'abonnement iCalendar pour synchroniser
 * l'agenda CRM vers un agenda externe (Infomaniak, Google, Apple).
 *
 * Chaque user voit uniquement son propre flux. Le token est révoqué
 * quand on clique "Régénérer".
 */
export default async function CalendarSettingsPage() {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { calendarFeedToken: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Synchroniser l'agenda"
        description="Affiche tes RDV CRM dans ton agenda Infomaniak, Apple Calendar ou Google Calendar."
      />

      <CalendarFeedManager
        initialToken={dbUser?.calendarFeedToken ?? null}
        userName={user.name}
      />
    </div>
  );
}
