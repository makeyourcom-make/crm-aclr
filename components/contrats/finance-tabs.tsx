/**
 * Onglets de la rubrique « Contrats & factures » (liens de navigation) :
 * Contrats · Factures clients (admin) · Signatures, avec compteur de choses à
 * traiter. L'onglet actif porte aria-current="page".
 *
 * Server-safe.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { formatInt } from "@/components/arena/format";
import { cn } from "@/lib/utils";

export type FinanceTabKey = "contrats" | "factures" | "signatures";

export interface FinanceTabCounts {
  contrats?: number;
  factures?: number;
  signatures?: number;
}

export function FinanceTabs({
  active,
  isAdmin,
  counts,
  actions,
}: {
  active: FinanceTabKey;
  isAdmin: boolean;
  counts: FinanceTabCounts;
  /** Boutons à droite (Nouveau contrat…). */
  actions?: ReactNode;
}) {
  const tabs: { key: FinanceTabKey; href: string; label: string; count?: number }[] = [
    { key: "contrats", href: "/contrats", label: "Contrats", count: counts.contrats },
    ...(isAdmin
      ? [
          {
            key: "factures" as const,
            href: "/factures-clients",
            label: "Factures clients",
            count: counts.factures,
          },
        ]
      : []),
    {
      key: "signatures",
      href: "/signatures",
      label: "Signatures",
      count: counts.signatures,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Rubrique contrats et factures" className="min-w-0 max-w-full">
        <ul className="flex flex-wrap gap-1.5 rounded-[16px] border border-border bg-card p-1.5 shadow-arena">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-[12px] px-3.5 text-sm font-bold transition-colors sm:px-4",
                    on
                      ? "bg-navy-700 text-white"
                      : "text-foreground hover:bg-navy-50",
                  )}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums",
                        on ? "bg-coral-400 text-navy-700" : "bg-coral-100 text-alert-700",
                      )}
                    >
                      <span className="sr-only">, </span>
                      {formatInt(t.count)}
                      <span className="sr-only"> à traiter</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
