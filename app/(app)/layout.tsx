import { CelebrationHost } from "@/components/arena/celebrate";
import { CallInProgressWidget } from "@/components/call/call-in-progress-widget";
import { CallResultModal } from "@/components/call/call-result-modal";
import { CallSessionProvider } from "@/components/call/call-session-provider";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarAside } from "@/components/layout/sidebar-aside";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { Topbar } from "@/components/layout/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { prisma } from "@/lib/db";
import { getPlayerHeader } from "@/lib/gamification";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { requireUser } from "@/lib/session";

/**
 * Layout des pages authentifiées (sidebar navy + topbar MYC Arena).
 *
 * Toutes les routes sous (app)/ partagent ce shell.
 * Le route group `(app)` n'apparaît PAS dans l'URL : par ex.
 *   `app/(app)/prospects/page.tsx` → URL = `/prospects`.
 *
 * requireUser() est défensif : le proxy.ts a déjà filtré, mais on garantit
 * ici aussi qu'un utilisateur valide existe.
 *
 * CallSessionProvider enveloppe TOUT pour que le widget d'appel survive aux
 * navigations internes (la commerciale peut continuer à naviguer pendant
 * que l'appel est en cours).
 *
 * Couche de jeu : `getPlayerHeader` (léger) alimente la carte joueur de la
 * sidebar et les pilules XP / série de la topbar. Si le moteur de jeu échoue,
 * le CRM reste pleinement utilisable (player = null → pas de carte joueur).
 */
async function loadPlayer(userId: string): Promise<PlayerHeader | null> {
  try {
    return await getPlayerHeader(userId);
  } catch (err) {
    console.error("[gamification] getPlayerHeader a échoué :", err);
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Badge non-lus : strictement scopé à l'utilisateur connecté (mailbox privée).
  // Exclut les archivés (qui ne sont plus dans l'inbox active).
  // En parallèle : l'en-tête joueur (XP total, XP du jour, série).
  const [unreadEmails, player] = await Promise.all([
    prisma.email.count({
      where: {
        lu: false,
        direction: "ENTRANT",
        userId: user.id,
        archive: false,
      },
    }),
    loadPlayer(user.id),
  ]);

  const badges = { emails: unreadEmails };

  return (
    <TooltipProvider delay={200}>
      <CallSessionProvider>
        <SidebarProvider>
          {/* Lien d'évitement clavier vers le contenu */}
          <a
            href="#contenu"
            className="sr-only z-[60] rounded-[12px] bg-navy-700 px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Aller au contenu
          </a>

          <div className="flex min-h-screen w-full bg-background">
            {/* Sidebar navy : repliable sur desktop, drawer mobile via Topbar */}
            <SidebarAside>
              <Sidebar role={user.role} badges={badges} player={player} />
            </SidebarAside>

            {/* Zone principale */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Bandeau « Voir en tant que » (admin en support) */}
              <ImpersonationBanner />
              <Topbar user={user} badges={badges} player={player} />
              {/* Padding bas sur mobile pour que la barre d'onglets fixe (et
                  son bouton Phoning surélevé) ne masque pas le contenu. */}
              <main
                id="contenu"
                className="flex-1 overflow-x-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
              >
                {children}
              </main>
            </div>
          </div>

          {/* Barre d'onglets mobile (se cache seule sur desktop) */}
          <BottomTabBar role={user.role} badges={badges} player={player} />
        </SidebarProvider>

        {/* Widget flottant + modale de résultat (gérés par le provider) */}
        <CallInProgressWidget />
        <CallResultModal />

        <Toaster richColors position="top-right" />

        {/* Confettis MYC Arena (portail, monté une seule fois) */}
        <CelebrationHost />
      </CallSessionProvider>
    </TooltipProvider>
  );
}
