/**
 * Fiche contrat cycle de vie (Créé → Signé client → Contre-signé
 * → Validé → 1er paiement) et pastilles de commission, calculés sur les
 * données réelles du contrat. Server-safe.
 */
import { Check } from "lucide-react";

import { formatInt } from "@/components/arena/format";
import { formatCHF, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LifecycleStep {
  label: string;
  done: boolean;
  date?: Date | null;
}

export function ContractLifecycle({ steps }: { steps: LifecycleStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol
      aria-label="Cycle de vie du contrat"
      className="grid grid-cols-1 gap-0 sm:grid-cols-5 sm:gap-3"
    >
      {steps.map((s, i) => {
        const isCurrent = i === current;
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="flex gap-3 sm:flex-col sm:gap-2">
            <div className="flex flex-col items-center sm:flex-row sm:items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold",
                  s.done
                    ? "border-win-500 bg-win-500 text-white"
                    : isCurrent
                      ? "border-coral-500 bg-card text-coral-600 motion-safe:animate-pulse-ring"
                      : "border-border-strong bg-card text-muted-foreground",
                )}
              >
                {s.done ? (
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </span>
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "min-h-3 w-0.5 flex-1 sm:h-0.5 sm:min-h-0 sm:w-auto",
                    s.done && steps[i + 1]?.done ? "bg-win-500" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className="pb-3 sm:pb-0">
              <p className="text-sm font-bold text-foreground">{s.label}</p>
              <p
                className={cn(
                  "text-xs font-semibold",
                  s.done
                    ? "text-win-700"
                    : isCurrent
                      ? "text-coral-600"
                      : "text-muted-foreground",
                )}
              >
                <span className="sr-only">Étape {i + 1} : </span>
                {s.done
                  ? s.date
                    ? `Fait le ${formatDate(s.date)}`
                    : "Fait"
                  : isCurrent
                    ? "En cours"
                    : "À venir"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface CommissionDot {
  id: string;
  typePart: string;
  statut: string;
  montant: number;
}

/**
 * Pastilles de versement de commission : signature (large), étalements,
 * renouvellements. Or = part signature acquise, vert = acquise, gris = à
 * venir, rouge pâle = annulée.
 */
export function CommissionDots({
  dots,
  total,
  ownerName,
}: {
  dots: CommissionDot[];
  total: number;
  ownerName: string;
}) {
  const acquired = dots
    .filter((d) => d.statut === "PAYE")
    .reduce((s, d) => s + d.montant, 0);
  const upcoming = dots
    .filter((d) => d.statut === "PREVU")
    .reduce((s, d) => s + d.montant, 0);
  const paidCount = dots.filter((d) => d.statut === "PAYE").length;
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-extrabold">Commission de {ownerName}</span>
        <span className="score-number text-xl text-win-700">{formatCHF(total)}</span>
      </div>
      <div
        role="img"
        aria-label={`Commission : ${formatInt(paidCount)} versement${paidCount > 1 ? "s" : ""} acquis sur ${formatInt(dots.length)}`}
        className="flex flex-wrap gap-1"
      >
        {dots.map((d) => (
          <span
            key={d.id}
            className={cn(
              "h-3.5 rounded-full",
              d.typePart === "SIGNATURE" ? "w-[30px]" : "w-3.5",
              d.statut === "PAYE"
                ? d.typePart === "SIGNATURE"
                  ? "bg-gold-500"
                  : "bg-win-500"
                : d.statut === "ANNULE"
                  ? "bg-alert-50 ring-1 ring-alert-500/40"
                  : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Acquise {formatCHF(acquired)} · à venir {formatCHF(upcoming)} · 50 % au 1er
        paiement, 50 % étalés
      </p>
    </div>
  );
}
