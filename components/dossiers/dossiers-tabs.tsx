"use client";

/**
 * Sous-onglets de la Gestion des projets : « Tableau » (kanban) et
 * « Document de suivi » (Google Doc partagé).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dossiers", label: "Tableau", icon: "ClipboardList" },
  { href: "/dossiers/document", label: "Document de suivi", icon: "FileText" },
] as const;

export function DossiersTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
