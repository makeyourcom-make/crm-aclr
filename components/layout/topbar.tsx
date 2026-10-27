import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ScorePills } from "@/components/layout/score-pills";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { PlayerHeader } from "@/lib/gamification/rules";

import type { Role } from "@prisma/client";

interface TopbarProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
  badges?: { emails?: number };
  /** Données de jeu (XP du jour, série) ; null si indisponibles. */
  player?: PlayerHeader | null;
}

/**
 * Barre du haut MYC Arena : burger (mobile) / repli sidebar (desktop),
 * recherche globale, pilule « XP du jour », pilule série, menu utilisateur.
 * Reste collée en haut, sous l'encoche en mode app (safe-area).
 */
export function Topbar({ user, badges, player }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:gap-3 sm:px-6 lg:px-8"
      style={{
        // Descend le contenu sous l'encoche en mode app (0 sur desktop).
        height: "calc(4rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Hamburger mobile */}
      <MobileNav role={user.role} badges={badges} player={player} />

      {/* Réduire / afficher le bandeau latéral (desktop) */}
      <SidebarToggle />

      {/* Recherche globale (⌘K) : entreprises, deals, contrats */}
      <GlobalSearch />

      <div className="min-w-0 flex-1" />

      {/* Score du jour + série */}
      {player && <ScorePills player={player} role={user.role} />}

      {/* Menu utilisateur */}
      <UserMenu user={user} player={player} />
    </header>
  );
}
