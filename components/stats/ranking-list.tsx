/**
 * Liste classée avec barre de progression visuelle + pourcentage.
 *
 * Utilisée pour les tops : produits, secteurs B2B, cantons.
 * Le pourcentage est relatif au LEADER de la liste (barre 100 % = top 1)
 * pour que la comparaison visuelle entre items soit lisible.
 *
 * Le pct affiché en revanche est le "vrai" pourcentage (part du marché).
 */
import { formatCHF, formatPercent } from "@/lib/format";

interface RankingItem {
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
  /** Tooltip en bas du composant. */
  hint?: string;
}

export function RankingList({
  items,
  emptyMessage = "Aucune donnée sur cette période.",
  hint,
}: RankingListProps) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const maxCount = items.reduce((m, it) => Math.max(m, it.count), 0);

  return (
    <div className="space-y-2.5">
      {items.map((it, idx) => {
        const widthPct = maxCount > 0 ? (it.count / maxCount) * 100 : 0;
        const isLeader = idx === 0;
        return (
          <div key={it.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    isLeader
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="truncate font-medium">{it.label}</span>
                {it.sublabel && (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {it.sublabel}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {it.count} ·{" "}
                <span className="font-semibold text-foreground">
                  {formatPercent(it.pct)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full transition-all ${
                    isLeader ? "bg-primary" : "bg-slate-400"
                  }`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                {formatCHF(it.ca)}
              </span>
            </div>
          </div>
        );
      })}
      {hint && (
        <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
