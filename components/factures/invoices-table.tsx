import Link from "next/link";

import { InvoiceStatutBadge } from "@/components/factures/invoice-statut-badge";
import { formatCHF } from "@/lib/format";

import type { InvoiceListItem } from "@/lib/queries/invoices";

interface InvoicesTableProps {
  rows: InvoiceListItem[];
  showCommerciale?: boolean;
}

function monthLabel(d: Date): string {
  return d
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric" })
    .replace(/^(.)/, (m) => m.toUpperCase());
}

export function InvoicesTable({ rows, showCommerciale }: InvoicesTableProps) {
  return (
    <>
      {/* Vue CARTES sur mobile */}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card md:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Aucune facture mensuelle. Lance la génération depuis le bouton en haut.
          </p>
        ) : (
          rows.map((inv) => (
            <div key={inv.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/factures/${inv.id}`}
                    className="block truncate text-sm font-medium capitalize hover:underline"
                  >
                    {monthLabel(inv.mois)}
                  </Link>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {inv.referenceFacture}
                    {showCommerciale ? ` · ${inv.user.name}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatCHF(Number(inv.montantTotal))}
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <InvoiceStatutBadge statut={inv.statut} />
                <span className="text-muted-foreground">
                  Comm. {formatCHF(Number(inv.montantCommissions))}
                </span>
                {Number(inv.montantGarantieAbsorbee) > 0 && (
                  <span className="text-amber-700">
                    Gar. +{formatCHF(Number(inv.montantGarantieAbsorbee))}
                  </span>
                )}
                <span className="text-muted-foreground">
                  Frais +{formatCHF(Number(inv.montantFrais))}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Vue TABLEAU sur desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <Th>N°</Th>
            <Th>Mois facturé</Th>
            {showCommerciale && <Th>Commerciale</Th>}
            <Th className="text-right">Commissions</Th>
            <Th className="text-right">Garantie</Th>
            <Th className="text-right">Frais</Th>
            <Th className="text-right">Total</Th>
            <Th>Statut</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={showCommerciale ? 8 : 7}
                className="px-3 py-12 text-center text-muted-foreground"
              >
                Aucune facture mensuelle. Lance la génération depuis le bouton
                en haut.
              </td>
            </tr>
          ) : (
            rows.map((inv) => (
              <tr
                key={inv.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/factures/${inv.id}`}
                    className="font-medium hover:underline"
                  >
                    {inv.referenceFacture}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm capitalize">
                  {monthLabel(inv.mois)}
                </td>
                {showCommerciale && (
                  <td className="px-3 py-2 text-xs">{inv.user.name}</td>
                )}
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCHF(Number(inv.montantCommissions))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                  {Number(inv.montantGarantieAbsorbee) > 0
                    ? `+ ${formatCHF(Number(inv.montantGarantieAbsorbee))}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  + {formatCHF(Number(inv.montantFrais))}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCHF(Number(inv.montantTotal))}
                </td>
                <td className="px-3 py-2">
                  <InvoiceStatutBadge statut={inv.statut} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
