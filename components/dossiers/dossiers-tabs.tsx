"use client";

/**
 * Sous-onglets de la Gestion des projets (MYC Arena, contrôle segmenté) :
 * « Planning » (planning de production, par défaut), « Dossiers » (kanban)
 * et « Document de suivi ».
 */
import { CalendarRange, ClipboardList, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dossiers/planning", label: "Planning", icon: CalendarRange, title: "Planning de production" },
  { href: "/dossiers", label: "Dossiers", icon: ClipboardList, title: "Kanban des dossiers" },
  { href: "/dossiers/document", label: "Document de suivi", icon: FileText, title: "Document de suivi client" },
] as const;

export function DossiersTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Gestion des projets"
      className={cn(
        "flex max-w-full flex-wrap gap-1 rounded-[14px] border border-border bg-card p-1 shadow-[0_1px_2px_rgba(14,25,54,0.04)]",
        className,
      )}
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            title={t.title}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] transition-colors sm:px-3.5 sm:text-sm",
              active ? "bg-lvl-50 font-bold text-lvl-700" : "font-semibold text-muted-foreground hover:bg-navy-50 hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="hidden size-4 sm:block" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
