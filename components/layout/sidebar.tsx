"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import {
  ROUTE_GROUPS,
  findRoute,
  getAccessibleRoutes,
  type RouteDef,
} from "@/lib/routes";

import type { Role } from "@prisma/client";

interface SidebarProps {
  role: Role;
  /** Pour le drawer mobile : callback exécuté au clic sur un lien. */
  onNavigate?: () => void;
  /** Compteurs de notifications par section (emails non lus, etc.) */
  badges?: {
    emails?: number;
  };
}

export function Sidebar({ role, onNavigate, badges }: SidebarProps) {
  const pathname = usePathname();
  const active = findRoute(pathname);
  const visible = getAccessibleRoutes(role);

  return (
    <nav
      className="flex h-full flex-col gap-1 overflow-y-auto bg-sidebar px-3 py-4"
      aria-label="Navigation principale"
    >
      {/* Marque */}
      <div className="mb-4 flex items-center gap-2.5 px-2">
        <Logo variant="mark" size={36} className="rounded-md" />
        <div>
          <p className="text-sm font-semibold leading-tight">Make Your Com</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            CRM — ACLR Sàrl
          </p>
        </div>
      </div>

      {/* Liens groupés */}
      {ROUTE_GROUPS.map((group) => {
        const items = visible.filter((r) => r.group === group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id} className="mt-2">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  isActive={active?.href === item.href}
                  isAdmin={role === "ADMIN"}
                  onClick={onNavigate}
                  badge={
                    item.href === "/emails" ? badges?.emails ?? 0 : 0
                  }
                />
              ))}
            </ul>
          </div>
        );
      })}
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
  /** Compteur de notifications à afficher en badge rouge (0 = caché) */
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
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <Icon name={item.icon} className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {hasBadge && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white"
            aria-label={`${badge} non lu${badge > 1 ? "s" : ""}`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    </li>
  );
}
