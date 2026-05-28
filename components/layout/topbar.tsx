import { Icon } from "@/components/icon";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";

import type { Role } from "@prisma/client";

interface TopbarProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Hamburger mobile */}
      <MobileNav role={user.role} />

      {/* Recherche globale (placeholder — Cmd+K implémenté à l'étape 4 finale) */}
      <button
        className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Recherche globale"
        disabled
        title="Recherche globale — disponible bientôt"
      >
        <Icon name="Search" className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher prospect, deal, contrat…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1 md:flex-none" />

      {/* Menu utilisateur */}
      <UserMenu user={user} />
    </header>
  );
}
