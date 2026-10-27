/**
 * Tableaux MYC Arena pour les pages de gestion (finance, admin, config).
 *
 * - En-têtes 11 px, 700, majuscules espacées 0.08em, texte #5B6478.
 * - Lignes 13 px, survol navy 50, séparateurs #E5E8F0.
 * - Boîte `overflow-x-auto` : un tableau large défile dans sa carte, jamais
 *   la page (rien ne déborde à 390 px).
 *
 * Server-safe (aucun hook).
 */
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const TABLE_CLASS = "w-full border-collapse text-[13px] text-foreground";
export const THEAD_CLASS = "border-b border-border bg-ground/80";
export const TR_CLASS =
  "border-b border-border transition-colors last:border-0 hover:bg-navy-50/70";
export const TH_CLASS =
  "px-3 py-3 text-left text-[11px] font-bold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase";
export const TD_CLASS = "px-3 py-2.5 align-middle";

/** Boîte de défilement horizontal (nommée si `label`, focusable au clavier). */
export function TableScroll({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cn("min-w-0 overflow-x-auto", className)}
    >
      {children}
    </div>
  );
}

export function Th({ className, scope = "col", ...props }: ComponentProps<"th">) {
  return <th scope={scope} className={cn(TH_CLASS, className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn(TD_CLASS, className)} {...props} />;
}

/** Ligne « rien à afficher » sur toute la largeur du tableau. */
export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6">
        {children}
      </td>
    </tr>
  );
}
