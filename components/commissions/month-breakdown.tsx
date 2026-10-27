/**
 * « D'où viennent tes X CHF » : commissions du mois en cours, contrat par
 * contrat (part signature / étalement / renouvellement), répartition
 * signature vs récurrent, déjà acquis / à venir / annulé. Server-safe.
 */
import { Percent } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { formatCHF } from "@/lib/format";
import type { MonthLine } from "@/lib/queries/commissions-gains";
import { formatAmountShort, formatDateCH, formatPercentRate } from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

const MAX_LINES = 6;

export interface MonthBreakdownProps {
  monthName: string;
  lastDay: Date | null;
  total: number;
  acquis: number;
  aVenir: number;
  signature: number;
  recurrent: number;
  annuleTotal: number;
  lines: MonthLine[];
  rates: { signature: number; renouvellement: number };
  className?: string;
}

function baseText(l: MonthLine, rates: MonthBreakdownProps["rates"]): string {
  switch (l.typePart) {
    case "SIGNATURE":
      return `Signature · 50 % de ta commission (${formatPercentRate(rates.signature)} de la base)`;
    case "ETALEMENT":
      return l.numeroMois
        ? `Étalement ${l.numeroMois}/11 · l'autre moitié, mois après mois`
        : "Étalement · l'autre moitié, mois après mois";
    case "RENOUVELLEMENT":
      return `Renouvellement · ${formatPercentRate(rates.renouvellement)} du mensuel`;
    default:
      return "";
  }
}

export function MonthBreakdown({
  monthName,
  lastDay,
  total,
  acquis,
  aVenir,
  signature,
  recurrent,
  annuleTotal,
  lines,
  rates,
  className,
}: MonthBreakdownProps) {
  const shown = lines.slice(0, MAX_LINES);
  const hidden = lines.length - shown.length;
  const sigPct = total > 0 ? Math.round((signature / total) * 100) : 0;

  return (
    <SectionCard
      title={`D'où viennent tes ${formatAmountShort(total)} CHF`}
      icon={Percent}
      tone="navy"
      description={`Commissions de ${monthName}, contrat par contrat`}
      className={className}
      contentClassName="flex flex-1 flex-col gap-4"
    >
      {total > 0 ? (
        <>
          <div
            role="img"
            aria-label={`À la signature ${formatCHF(signature)}, récurrent ${formatCHF(recurrent)}`}
            className="flex h-3.5 gap-[3px] overflow-hidden rounded-full"
          >
            {signature > 0 && <div className="min-w-0 bg-navy-600" style={{ flex: `${sigPct} 1 0` }} />}
            {recurrent > 0 && <div className="min-w-0 bg-win-500" style={{ flex: `${100 - sigPct} 1 0` }} />}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[14px] bg-navy-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-navy-600" />À la signature
              </div>
              <div className="text-lg font-extrabold break-words tabular-nums sm:text-xl">{formatCHF(signature)}</div>
            </div>
            <div className="rounded-[14px] bg-win-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-win-700">
                <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-win-500" />Récurrent
              </div>
              <div className="text-lg font-extrabold break-words text-win-700 tabular-nums sm:text-xl">
                {formatCHF(recurrent)}
              </div>
            </div>
          </div>

          <ul className="flex flex-col gap-2.5">
            {shown.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-[14px] border border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/prospects/${l.prospectId}`}
                    className="block truncate text-sm font-bold text-foreground hover:underline"
                  >
                    {l.client}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    <Link href={`/contrats/${l.contractId}`} className="font-bold text-info-700 hover:underline">
                      {l.numero}
                    </Link>
                    {l.products ? ` · ${l.products}` : ""} · {formatDateCH(l.date)}
                  </div>
                  <div className="text-xs text-muted-foreground">{baseText(l, rates)}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="text-[15px] font-extrabold tabular-nums">{formatCHF(l.montant)}</span>
                  <StatusPill tone={l.statut === "PAYE" ? "green" : "navy"}>
                    {l.statut === "PAYE" ? "Acquise" : "À venir"}
                  </StatusPill>
                </div>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-xs font-semibold text-muted-foreground">
              + {hidden} {hidden >= 2 ? "autres versements" : "autre versement"} ce mois
            </p>
          )}
        </>
      ) : (
        <p className="rounded-[14px] bg-ground px-4 py-6 text-center text-sm font-medium text-muted-foreground">
          Aucune commission ce mois pour l&apos;instant. Ta prochaine signature te rapporte la
          moitié de sa commission tout de suite.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        <Row label="Déjà acquis" value={formatCHF(acquis)} tone="text-win-700" />
        <Row
          label={lastDay ? `À venir d'ici le ${formatDateCH(lastDay).slice(0, 5)}` : "À venir ce mois"}
          value={formatCHF(aVenir)}
        />
        <Row label="Annulées (résiliations)" value={formatCHF(annuleTotal)} small />
        <a href="#versements" className="mt-1 self-start text-[13px] font-bold text-info-700 hover:underline">
          Voir tous mes versements
        </a>
      </div>
    </SectionCard>
  );
}

function Row({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: string;
  small?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-2", small ? "text-xs" : "text-[13px]")}>
      <span className="text-muted-foreground">{label}</span>
      <strong className={cn("tabular-nums", tone ?? "text-foreground", small && "font-semibold text-muted-foreground")}>
        {value}
      </strong>
    </div>
  );
}
