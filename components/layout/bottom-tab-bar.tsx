"use client";

/**
 * Barre d'onglets en bas — visible UNIQUEMENT sur mobile (`md:hidden`).
 *
 * Donne une vraie sensation « app » : les 4 sections quotidiennes accessibles
 * au pouce + un onglet « Menu » qui ouvre la sidebar complète (tout le reste).
 * Gère la safe-area (encoche / barre home iPhone) via env(safe-area-inset-bottom).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon, type IconName } from "@/components/icon";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

interface Tab {
  href: string;
  label: string;
  icon: IconName;
}

const TABS: Tab[] = [
  { href: "/agenda", label: "Agenda", icon: "Calendar" },
  { href: "/prospects", label: "Entreprises", icon: "Users" },
  { href: "/pipeline", label: "Pipeline", icon: "GitBranch" },
  { href: "/emails", label: "Emails", icon: "Mail" },
];

export function BottomTabBar({
  role,
  badges,
}: {
  role: Role;
  badges?: { emails?: number };
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navigation principale"
      >
        <div className="flex h-14 items-stretch">
          {TABS.map((t) => {
            const active = isActive(t.href);
            const showBadge = t.href === "/emails" && (badges?.emails ?? 0) > 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
                )}
                <span className="relative">
                  <Icon name={t.icon} className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-semibold leading-none text-white">
                      {badges!.emails! > 9 ? "9+" : badges!.emails}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}

          {/* Onglet Menu → ouvre la sidebar complète */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Ouvrir le menu"
          >
            <Icon name="Menu" className="h-5 w-5" />
            Menu
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de navigation</SheetTitle>
          </SheetHeader>
          <Sidebar role={role} onNavigate={() => setMenuOpen(false)} badges={badges} />
        </SheetContent>
      </Sheet>
    </>
  );
}
