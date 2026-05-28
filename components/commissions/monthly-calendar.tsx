/**
 * Calendrier visuel des versements sur 13 mois.
 *
 * Chaque mois : 1 barre proportionnelle au montant (acquis en vert opaque,
 * à venir en bleu hachuré). Mois courant en surbrillance.
 */
import { formatCHF, formatCHFCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MonthlyCalendarProps {
  parMois: Array<{
    mois: Date;
    label: string;
    acquis: number;
    aVenir: number;
  }>;
}

export function MonthlyCalendar({ parMois }: MonthlyCalendarProps) {
  const maxMontant = Math.max(
    1,
    ...parMois.map((m) => m.acquis + m.aVenir),
  );
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-end gap-1">
        {parMois.map((m, idx) => {
          const isCurrent =
            m.mois.getMonth() === currentMonth &&
            m.mois.getFullYear() === currentYear;
          const total = m.acquis + m.aVenir;
          const heightTotal = (total / maxMontant) * 100;
          const heightAcquis =
            total > 0 ? (m.acquis / total) * heightTotal : 0;
          const heightAVenir = heightTotal - heightAcquis;

          return (
            <div
              key={idx}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${m.label} : ${formatCHF(total)} (${formatCHF(m.acquis)} acquis + ${formatCHF(m.aVenir)} à venir)`}
            >
              {/* Barre */}
              <div className="relative flex h-32 w-full max-w-[40px] items-end overflow-hidden rounded-sm bg-slate-50">
                {heightTotal > 0 && (
                  <div
                    className="w-full"
                    style={{ height: `${heightTotal}%` }}
                  >
                    {heightAVenir > 0 && (
                      <div
                        className="w-full bg-blue-200"
                        style={{
                          height: `${(heightAVenir / heightTotal) * 100}%`,
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent 0 4px, rgba(59,130,246,0.2) 4px 5px)",
                        }}
                      />
                    )}
                    {heightAcquis > 0 && (
                      <div
                        className="w-full bg-emerald-500"
                        style={{
                          height: `${(heightAcquis / heightTotal) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute inset-0 ring-2 ring-primary ring-offset-1" />
                )}
              </div>

              {/* Montant */}
              <p
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  total === 0 && "text-muted-foreground",
                  total > 0 && "text-foreground",
                )}
              >
                {total > 0 ? formatCHFCompact(total).replace("CHF ", "") : "—"}
              </p>

              {/* Label mois */}
              <p
                className={cn(
                  "text-[10px] uppercase",
                  isCurrent
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                )}
              >
                {m.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Acquise
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-200"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 3px, rgba(59,130,246,0.4) 3px 4px)",
            }}
          />
          À venir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-primary" />
          Mois courant
        </span>
      </div>
    </div>
  );
}
