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
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
