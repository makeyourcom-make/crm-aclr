/**
 * Liste classée MYC Arena : médaille de rang + barre de progression + part.
 *
 * Utilisée pour les tops : produits, secteurs B2B, cantons.
 * La longueur de barre est relative au LEADER de la liste (barre 100 % =
 * top 1) pour que la comparaison visuelle entre items soit lisible.
 * Le pourcentage affiché est le « vrai » pourcentage (part des signatures).
 *
 * Server-safe (importable depuis un composant client).
 */
import { formatCHFCompact, formatPercent } from "@/lib/format";
import { TONE_HEX, type Tone } from "@/components/arena/tones";
import { EmptyState } from "@/components/arena/empty-state";
import { Trophy } from "lucide-react";

import { RankBadge, cleanText } from "./ui";

export interface RankingItem {
  key: string;
  label: string;
  sublabel?: string;
  count: number;
  ca: number;
  pct: number; // entre 0 et 1
}

interface RankingListProps {
  items: RankingItem[];
  emptyMessage?: string;
  /** Explication en bas du composant. */
  hint?: string;
  /** Teinte des barres (défaut violet). */
  tone?: Tone;
}

export function RankingList({
  items,
  emptyMessage = "Aucune donnée sur cette période.",
  hint,
  tone = "violet",
}: RankingListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        tone="gold"
        title="Podium vide pour l'instant"
        description={emptyMessage}
      />
    );
  }

  const maxCount = items.reduce((m, it) => Math.max(m, it.count), 0);
  const color = TONE_HEX[tone]?.solid ?? TONE_HEX.violet.solid;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3.5">
        {items.map((it, idx) => {
          const widthPct = maxCount > 0 ? Math.max(3, (it.count / maxCount) * 100) : 0;
          return (
            <li key={it.key} className="flex items-center gap-3">
              <RankBadge rank={idx + 1} size={30} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-foreground">
                    {cleanText(it.label)}
                    {it.sublabel && (
                      <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                        {cleanText(it.sublabel)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[13px] font-extrabold whitespace-nowrap tabular-nums">
                    {formatCHFCompact(it.ca)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ground">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {it.count} contrat{it.count > 1 ? "s" : ""} · {formatPercent(it.pct, 0)} des
                  signatures
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {hint && (
        <p className="rounded-[14px] bg-ground px-3.5 py-3 text-xs font-semibold text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
