"use client";

import { useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

/**
 * Conteneur <aside> de la sidebar desktop, repliable via le contexte.
 * Replié → largeur 0 (masqué) ; l'écran principal occupe toute la largeur.
 */
export function SidebarAside({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:block",
        collapsed ? "w-0 overflow-hidden border-r-0" : "w-64",
      )}
    >
      <div className="sticky top-0 h-screen w-64">{children}</div>
    </aside>
  );
}
