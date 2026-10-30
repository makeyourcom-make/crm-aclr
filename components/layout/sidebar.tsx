"use client";

/**
 * Sidebar navy : logo Make Your Com + devise, groupes de navigation
 * (lib/routes : Prospecter / Vendre / Livrer / Gagner, + Finance,
 * Administration, Configuration pour l'admin), bouton d'installation PWA et
 * carte « résultats du mois » en bas.
 *
 * Utilisée à la fois dans l'aside desktop (repliable) et dans le tiroir
 * mobile (MobileNav / BottomTabBar) : `onNavigate` ferme le tiroir au clic,
 * `onClose` affiche un bouton « Fermer le menu ».
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/icon";
import { PlayerCard } from "@/components/layout/player-card";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import type { PlayerHeader } from "@/lib/gamification/rules";
import {
  ROUTE_GROUPS,
  findRoute,
  getAccessibleRoutes,
  type RouteDef,
} from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

interface SidebarProps {
  role: Role;
  /** Pour le drawer mobile : callback exécuté au clic sur un lien. */
  onNavigate?: () => void;
  /** Pour le drawer mobile : affiche un bouton de fermeture. */
  onClose?: () => void;
  /** Compteurs de notifications par section (emails non lus, etc.) */
  badges?: {
    emails?: number;
  };
  /** Carte résultats (null si les résultats sont indisponibles). */
  player?: PlayerHeader | null;
}

export function Sidebar({
  role,
  onNavigate,
  onClose,
  badges,
  player,
}: SidebarProps) {
  const pathname = usePathname();
  const active = findRoute(pathname);
  const visible = getAccessibleRoutes(role);

  return (
    <nav
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
      aria-label="Navigation principale"
    >
      {/* Marque : logo officiel Make Your Com (blanc + coral sur navy) et devise. */}
      <div className="flex shrink-0 items-start justify-between gap-2 px-3.5 pb-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex flex-col gap-2.5 rounded-[12px] px-2.5 pt-1 pb-1.5"
          aria-label="Make Your Com - Accueil"
        >
          <Logo variant="wordmark" tone="dark" size={40} />
          <span className="text-[11px] leading-snug font-semibold text-navy-300">
            Chaque appel compte.
            <br />
            Chaque RDV est une chance.
            <br />
            Chaque signature rapporte.
          </span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex size-10 shrink-0 items-center justify-center rounded-[12px] text-navy-300 transition-colors hover:bg-navy-600 hover:text-white"
          >
            <Icon name="X" className="size-5" />
          </button>
        )}
      </div>

      {/* Liens groupés : seule cette zone défile, la carte résultats reste visible. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3.5 pb-3 [scrollbar-color:#2F4470_transparent] [scrollbar-width:thin]">
        {ROUTE_GROUPS.map((group) => {
          const items = visible.filter((r) => r.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-[11px] font-bold tracking-[0.08em] text-navy-400 uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    isActive={active?.href === item.href}
                    isAdmin={role === "ADMIN"}
                    onClick={onNavigate}
                    badge={item.href === "/emails" ? (badges?.emails ?? 0) : 0}
                  />
                ))}
              </ul>
            </div>
          );
        })}

        {/* Installer la PWA : visible seulement si installable / pas déjà installé */}
        <InstallAppButton />
      </div>

      {/* Carte résultats épinglée en bas (commerciales uniquement : l'admin
          n'a pas d'objectif personnel d'appels/RDV, cette carte ne lui sert pas) */}
      {player && role !== "ADMIN" && (
        <div className="shrink-0 border-t border-white/[0.06] px-3.5 pt-3">
          <PlayerCard player={player} role={role} />
        </div>
      )}
    </nav>
  );
}

function SidebarLink({
  item,
  isActive,
  isAdmin,
  onClick,
  badge,
}: {
  item: RouteDef;
  isActive: boolean;
  isAdmin: boolean;
  onClick?: () => void;
  /** Compteur de notifications à afficher en pastille coral (0 = caché) */
  badge?: number;
}) {
  const label =
    !isAdmin && item.commercialLabel ? item.commercialLabel : item.label;
  const hasBadge = badge !== undefined && badge > 0;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group/link flex h-10 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold transition-colors",
          isActive
            ? "bg-navy-600 text-white"
            : "text-sidebar-foreground hover:bg-navy-600/70 hover:text-white",
        )}
      >
        <Icon
          name={item.icon}
          className={cn(
            "size-[18px] shrink-0 transition-colors",
            isActive ? "text-coral-400" : "text-navy-300 group-hover/link:text-white",
          )}
        />
        <span className="flex-1 truncate">{label}</span>
        {hasBadge && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-600 px-1.5 text-[11px] font-extrabold text-white tabular-nums">
            {badge > 99 ? "99+" : badge}
            <span className="sr-only"> non lu{badge > 1 ? "s" : ""}</span>
          </span>
        )}
        {isActive && (
          <span
            aria-hidden="true"
            className="h-[18px] w-1 shrink-0 rounded-full bg-coral-400"
          />
        )}
      </Link>
    </li>
  );
}
