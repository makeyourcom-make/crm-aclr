/**
 * Montant pour les gros chiffres (StatTile, héros) : nombre arrondi au format
 * suisse (helper `formatNumber` de lib/format) suivi d'un « CHF » plus petit,
 * comme dans le Kit (« 4 850 CHF »). Évite qu'un « CHF 186'400.00 » en 38 px
 * déborde d'une tuile étroite.
 *
 * Server-safe.
 */
import { formatCHF, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChfValue({
  amount,
  className,
  unitClassName,
  cents = false,
}: {
  amount: number | null | undefined;
  className?: string;
  /** Classes du suffixe « CHF » (ex. sur fond navy : "text-navy-300"). */
  unitClassName?: string;
  /**
   * Garde les centimes (format suisse exact de `formatCHF`, ex. 4'812.35).
   * Pour un montant à payer ou facturé, où l'arrondi au franc fausserait
   * le chiffre.
   */
  cents?: boolean;
}) {
  const n = amount !== null && amount !== undefined && Number.isFinite(amount) ? amount : 0;
  return (
    <span className={cn("tabular-nums", className)}>
      {cents ? formatCHF(n).replace(/^CHF[\s ]?/, "") : formatNumber(Math.round(n))}
      <span
        className={cn(
          "ml-1.5 font-sans text-[0.42em] font-bold tracking-normal text-muted-foreground",
          unitClassName,
        )}
      >
        CHF
      </span>
    </span>
  );
}
