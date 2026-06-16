import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { UserMenu } from "@/components/layout/user-menu";

import type { Role } from "@prisma/client";

interface TopbarProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
  badges?: { emails?: number };
}

export function Topbar({ user, badges }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Hamburger mobile */}
      <MobileNav role={user.role} badges={badges} />

      {/* Réduire / afficher le bandeau latéral (desktop) */}
      <SidebarToggle />

      {/* Recherche globale (⌘K) — entreprises, deals, contrats */}
      <GlobalSearch />

      <div className="flex-1 md:flex-none" />

      {/* Menu utilisateur */}
      <UserMenu user={user} />
    </header>
  );
}
