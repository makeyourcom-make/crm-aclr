import { CallInProgressWidget } from "@/components/call/call-in-progress-widget";
import { CallResultModal } from "@/components/call/call-result-modal";
import { CallSessionProvider } from "@/components/call/call-session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarAside } from "@/components/layout/sidebar-aside";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { Topbar } from "@/components/layout/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

/**
 * Layout des pages authentifiées (sidebar + topbar).
 *
 * Toutes les routes sous (app)/ partagent ce shell.
 * Le route group `(app)` n'apparaît PAS dans l'URL — par ex.
 *   `app/(app)/prospects/page.tsx` → URL = `/prospects`.
 *
 * requireUser() est défensif : le proxy.ts a déjà filtré, mais on garantit
 * ici aussi qu'un utilisateur valide existe.
 *
 * CallSessionProvider enveloppe TOUT pour que le widget d'appel survive aux
 * navigations internes (la commerciale peut continuer à naviguer pendant
 * que l'appel est en cours).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Badge non-lus : strictement scopé à l'utilisateur connecté (mailbox privée).
  // Exclut les archivés (qui ne sont plus dans l'inbox active).
  const unreadEmails = await prisma.email.count({
    where: {
      lu: false,
      direction: "ENTRANT",
      userId: user.id,
      archive: false,
    },
  });

  const badges = { emails: unreadEmails };

  return (
    <TooltipProvider delay={200}>
      <CallSessionProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            {/* Sidebar — repliable sur desktop, drawer mobile via Topbar */}
            <SidebarAside>
              <Sidebar role={user.role} badges={badges} />
            </SidebarAside>

            {/* Zone principale */}
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar user={user} badges={badges} />
              <main className="flex-1 overflow-x-auto">{children}</main>
            </div>
          </div>
        </SidebarProvider>

        {/* Widget flottant + modale de résultat (gérés par le provider) */}
        <CallInProgressWidget />
        <CallResultModal />

        <Toaster richColors position="top-right" />
      </CallSessionProvider>
    </TooltipProvider>
  );
}
