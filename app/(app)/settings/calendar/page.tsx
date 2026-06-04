import { CalendarFeedManager } from "@/components/settings/calendar-feed-manager";
import { CaldavManager } from "@/components/settings/caldav-manager";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Synchronisation agenda" };
export const dynamic = "force-dynamic";

/**
 * Page de configuration de l'abonnement iCalendar + de la sync
 * bidirectionnelle CalDAV avec un serveur externe (Infomaniak, etc.).
 *
 * Chaque user voit uniquement sa propre config.
 */
export default async function CalendarSettingsPage() {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      calendarFeedToken: true,
      caldavServerUrl: true,
      caldavUsername: true,
      caldavCalendarUrl: true,
      caldavLastSyncAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-8">
      <PageHeader
        title="Synchroniser l'agenda"
        description="Sync bidirectionnelle CalDAV (recommandé) ou abonnement iCalendar lecture seule."
      />

      <section>
        <h2 className="mb-1 text-lg font-semibold">
          🔄 Sync bidirectionnelle (CalDAV)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Les RDV créés / modifiés dans Infomaniak remontent dans le CRM, et
          inversement. Recommandé.
        </p>
        <CaldavManager
          initial={{
            serverUrl: dbUser?.caldavServerUrl ?? null,
            username: dbUser?.caldavUsername ?? null,
            calendarUrl: dbUser?.caldavCalendarUrl ?? null,
            lastSyncAt: dbUser?.caldavLastSyncAt
              ? dbUser.caldavLastSyncAt.toISOString()
              : null,
          }}
        />
      </section>

      <section className="border-t border-border pt-8">
        <h2 className="mb-1 text-lg font-semibold">
          📤 Abonnement iCalendar (lecture seule)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Alternative simple : expose un lien .ics que tu abonnes dans
          n&apos;importe quel agenda. Lecture seule — pour le bidirectionnel,
          utilise plutôt CalDAV ci-dessus.
        </p>
        <CalendarFeedManager
          initialToken={dbUser?.calendarFeedToken ?? null}
          userName={user.name}
        />
      </section>
    </div>
  );
}
