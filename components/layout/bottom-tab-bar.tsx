"use client";

/**
 * Barre d'onglets en bas : visible UNIQUEMENT sur mobile (`md:hidden`).
 *
 * Sensation « app » : Agenda · Entreprises · PHONING (onglet central mis en
 * avant, bouton coral surélevé) · Emails · Menu (ouvre la sidebar complète :
 * Pipeline, Ma journée et tout le reste).
 * Gère la safe-area (encoche / barre home iPhone) via env(safe-area-inset-bottom).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon, type IconName } from "@/components/icon";
import { DRAWER_CLASSES } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

interface Tab {
  href: string;
  label: string;
  icon: IconName;
}

const LEFT_TABS: Tab[] = [
  { href: "/agenda", label: "Agenda", icon: "Calendar" },
  { href: "/prospects", label: "Entreprises", icon: "Building2" },
];

const CENTER_TAB: Tab = { href: "/phoning", label: "Phoning", icon: "Phone" };

const RIGHT_TABS: Tab[] = [{ href: "/emails", label: "Emails", icon: "Mail" }];

export function BottomTabBar({
  role,
  badges,
  player,
}: {
  role: Role;
  badges?: { emails?: number };
  player?: PlayerHeader | null;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const unread = badges?.emails ?? 0;
  const centerActive = isActive(CENTER_TAB.href);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-[0_-8px_24px_rgba(14,25,54,0.06)] backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navigation rapide"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-1">
          {LEFT_TABS.map((t) => (
            <TabLink key={t.href} tab={t} active={isActive(t.href)} />
          ))}

          {/* Onglet central : Phoning, bouton coral surélevé */}
          <Link
            href={CENTER_TAB.href}
            aria-current={centerActive ? "page" : undefined}
            className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-2 text-[11px] font-bold text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute -top-5 flex size-14 items-center justify-center rounded-full bg-gradient-coral text-white shadow-[0_10px_24px_rgba(233,82,86,0.45)] ring-4 ring-card transition-transform duration-150 group-active:scale-95",
                centerActive && "ring-coral-100",
              )}
            >
              <Icon name={CENTER_TAB.icon} className="size-6" />
            </span>
            <span className={cn(centerActive && "text-coral-600")}>
              {CENTER_TAB.label}
            </span>
          </Link>

          {RIGHT_TABS.map((t) => (
            <TabLink
              key={t.href}
              tab={t}
              active={isActive(t.href)}
              badge={t.href === "/emails" ? unread : 0}
            />
          ))}

          {/* Onglet Menu → ouvre la sidebar complète */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Ouvrir le menu"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <Icon name="Menu" className="size-5" />
            </span>
            Menu
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" showCloseButton={false} className={DRAWER_CLASSES}>
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            role={role}
            onNavigate={() => setMenuOpen(false)}
            onClose={() => setMenuOpen(false)}
            badges={badges}
            player={player}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function TabLink({
  tab,
  active,
  badge = 0,
}: {
  tab: Tab;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-navy-50",
        )}
      >
        <Icon
          name={tab.icon}
          className={cn("size-5", active && "text-coral-600")}
        />
        {badge > 0 && (
          <span className="absolute -top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-card bg-coral-600 px-1 text-[9px] leading-none font-extrabold text-white tabular-nums">
            {badge > 9 ? "9+" : badge}
            <span className="sr-only"> non lu{badge > 1 ? "s" : ""}</span>
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-0.5">{tab.label}</span>
    </Link>
  );
}
