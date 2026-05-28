import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
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
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-screen w-full">
        {/* Sidebar — fixée à gauche sur desktop, drawer mobile via Topbar */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
          <div className="sticky top-0 h-screen">
            <Sidebar role={user.role} />
          </div>
        </aside>

        {/* Zone principale */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} />
          <main className="flex-1 overflow-x-auto">{children}</main>
        </div>
      </div>

      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
