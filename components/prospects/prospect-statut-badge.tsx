/**
 * Pastille de statut d'entreprise (MYC Arena) : 12 px 700, rayon 999,
 * fond clair + texte foncé de la teinte du statut (voir statut-meta.ts).
 * « Vierge » s'affiche « À attaquer » (bord pointillé coral), comme dans la
 * maquette validée. Server-safe.
 */
import type { ProspectStatut } from "@prisma/client";

import { cn } from "@/lib/utils";

import { STATUT_META } from "./statut-meta";

export function ProspectStatutBadge({
  statut,
  size = "sm",
  className,
}: {
  statut: ProspectStatut;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = STATUT_META[statut];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold leading-none whitespace-nowrap",
        size === "md" ? "h-8 px-3 text-[13px]" : "h-6 px-2.5 text-xs",
        meta.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", meta.solid)} />
      {meta.label}
    </span>
  );
}
