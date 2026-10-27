"use client";

import { Icon } from "@/components/icon";
import { useSidebar } from "@/components/layout/sidebar-context";

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
      aria-expanded={!collapsed}
      className="hidden size-10 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(14,25,54,0.04)] transition-colors hover:border-border-strong hover:text-foreground md:flex"
    >
      <Icon
        name={collapsed ? "PanelLeftOpen" : "PanelLeftClose"}
        className="size-[18px]"
      />
    </button>
  );
}
