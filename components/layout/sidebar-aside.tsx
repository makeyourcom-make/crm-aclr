"use client";

import { useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

/**
 * Conteneur <aside> de la sidebar desktop, repliable via le contexte.
 * Replié → largeur 0 (masqué) et inerte (liens hors du parcours clavier) ;
 * l'écran principal occupe toute la largeur (utile face client).
 */
export function SidebarAside({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <aside
      inert={collapsed}
      className={cn(
        "hidden shrink-0 bg-sidebar transition-[width] duration-200 md:block",
        collapsed ? "w-0 overflow-hidden" : "w-64",
      )}
    >
      <div className="sticky top-0 h-screen w-64">{children}</div>
    </aside>
  );
}
