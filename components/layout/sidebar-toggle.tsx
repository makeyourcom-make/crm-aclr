"use client";

import { Icon } from "@/components/icon";
import { useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

/**
 * Bouton (desktop) pour réduire / afficher le bandeau latéral.
 * Réduit = écran centré sur le contenu (utile face client).
 */
export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      title={collapsed ? "Afficher le menu" : "Réduire le menu (mode client)"}
      aria-label={collapsed ? "Afficher le menu" : "Réduire le menu"}
      className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
    >
      <Icon
        name={collapsed ? "Menu" : "ChevronRight"}
        className={cn("h-4 w-4", !collapsed && "rotate-180")}
      />
    </button>
  );
}
