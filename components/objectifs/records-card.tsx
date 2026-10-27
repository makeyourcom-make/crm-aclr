/**
 * Records personnels : meilleure journée, meilleure semaine, plus longue
 * série, meilleur mois de gains, plus gros contrat… avec la comparaison au
 * présent (« encore 365 XP pour l'égaler »). Données réelles fournies par la
 * page (getPlayerStats + frise des commissions). Server-safe.
 */
import { Star } from "lucide-react";

import { SectionCard } from "@/components/arena/section-card";
import { cn } from "@/lib/utils";

export interface PersonalRecord {
  label: string;
  value: string;
  context?: string;
  /** Avancement vers le record (0-100), barre or. */
  pct?: number;
  ariaLabel?: string;
  challenge: string;
  /** Mise en avant (record en vue ou battu). */
  highlight?: boolean;
}

export function RecordsCard({
  records,
  className,
}: {
  records: PersonalRecord[];
  className?: string;
}) {
  return (
    <SectionCard
      title="Records personnels"
      icon={Star}
      tone="gold"
      description="Ton seul vrai adversaire, c'est toi"
      className={className}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {records.map((r) => (
          <article
            key={r.label}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-border p-3.5",
              r.highlight ? "bg-gold-50" : "bg-card",
            )}
          >
            <h3 className="text-[11px] font-bold tracking-[0.08em] text-gold-700 uppercase">
              {r.label}
            </h3>
            <div className="score-number text-[28px] break-words text-foreground">{r.value}</div>
            {r.context && (
              <div className="text-xs font-medium text-muted-foreground">{r.context}</div>
            )}
            {r.pct !== undefined && (
              <div
                role="img"
                aria-label={r.ariaLabel ?? `${r.pct} % du record`}
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-50"
              >
                <div
                  className="h-full rounded-full bg-gold-500 motion-safe:animate-meter-fill"
                  style={{ width: `${Math.min(100, Math.max(0, r.pct))}%` }}
                />
              </div>
            )}
            <div className="text-xs font-bold text-foreground">{r.challenge}</div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
