import { CalendarCheck, CalendarSync, RefreshCw, Rss } from "lucide-react";

import { SectionCard, StatusPill } from "@/components/arena";
import { IconPageHeader } from "@/components/common/icon-page-header";
import { PageShell } from "@/components/common/page-shell";
import { CalendarFeedManager } from "@/components/settings/calendar-feed-manager";
import { CaldavManager } from "@/components/settings/caldav-manager";
import { GoogleCalendarManager } from "@/components/settings/google-calendar-manager";
import { prisma } from "@/lib/db";
import { googleOAuthConfigured } from "@/lib/google-calendar";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Synchronisation agenda" };
export const dynamic = "force-dynamic";

/**
 * Page de configuration de la sync Google Agenda, de la sync bidirectionnelle
 * CalDAV avec un serveur externe (Infomaniak, etc.) et de l'abonnement
 * iCalendar en lecture seule.
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
      googleRefreshTokenEnc: true,
      googleEmail: true,
      googleLastSyncAt: true,
    },
  });

  const googleConnected = !!dbUser?.googleRefreshTokenEnc;
  const caldavConnected = !!dbUser?.caldavServerUrl && !!dbUser?.caldavCalendarUrl;
  const feedActive = !!dbUser?.calendarFeedToken;

  return (
    <PageShell width="narrow">
      <IconPageHeader
        icon={CalendarSync}
        tone="gold"
        title="Synchroniser l'agenda"
        description="Sync bidirectionnelle Google ou CalDAV (recommandé), ou abonnement iCalendar lecture seule."
      />

      <div className="space-y-6">
        <SectionCard
          title="Google Agenda"
          description="Sync bidirectionnelle avec ton compte Gmail : ce qui est dans le CRM apparaît dans Google Agenda, et inversement."
          icon={CalendarCheck}
          tone="gold"
          action={
            googleConnected ? (
              <StatusPill tone="green">Connecté</StatusPill>
            ) : (
              <StatusPill tone="gold">Recommandé</StatusPill>
            )
          }
        >
          <GoogleCalendarManager
            initial={{
              connected: googleConnected,
              email: dbUser?.googleEmail ?? null,
              lastSyncAt: dbUser?.googleLastSyncAt
                ? dbUser.googleLastSyncAt.toISOString()
                : null,
              configured: googleOAuthConfigured(),
            }}
          />
        </SectionCard>

        <SectionCard
          title="Sync bidirectionnelle (CalDAV)"
          description="Les RDV créés / modifiés dans Infomaniak remontent dans le CRM, et inversement."
          icon={RefreshCw}
          tone="blue"
          action={
            caldavConnected ? (
              <StatusPill tone="green">Connecté</StatusPill>
            ) : undefined
          }
        >
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
        </SectionCard>

        <SectionCard
          title="Abonnement iCalendar (lecture seule)"
          description="Alternative simple : un lien .ics à abonner dans n'importe quel agenda. Pour le bidirectionnel, utilise plutôt CalDAV ci-dessus."
          icon={Rss}
          tone="navy"
          action={
            feedActive ? <StatusPill tone="green">Actif</StatusPill> : undefined
          }
        >
          <CalendarFeedManager
            initialToken={dbUser?.calendarFeedToken ?? null}
            userName={user.name}
          />
        </SectionCard>
      </div>
    </PageShell>
  );
}
