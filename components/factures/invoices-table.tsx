import { ChevronRight, Eye, ReceiptText } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableEmptyRow,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { InvoiceStatutBadge } from "@/components/factures/invoice-statut-badge";
import { formatCHF } from "@/lib/format";
import { computePayslip } from "@/lib/salary-payslip";

import type { InvoiceListItem } from "@/lib/queries/invoices";

interface InvoicesTableProps {
  rows: InvoiceListItem[];
  showCommerciale?: boolean;
}

function monthLabel(d: Date): string {
  // Le mois facturé est stocké au 1er du mois en UTC : on formate en UTC pour
  // éviter tout décalage de fuseau (sinon « octobre » peut s'afficher en
  // « septembre » selon le fuseau du serveur).
  return d
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/^(.)/, (m) => m.toUpperCase());
}

function Empty() {
  return (
    <EmptyState
      icon={ReceiptText}
      tone="navy"
      title="Aucune fiche de salaire"
      description="Aucune facture mensuelle pour l'instant. Lance la génération depuis le bouton en haut."
    />
  );
}

export function InvoicesTable({ rows, showCommerciale }: InvoicesTableProps) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-arena">
      {/* Vue CARTES sur mobile */}
      <div className="divide-y divide-border md:hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty />
          </div>
        ) : (
          rows.map((inv) => {
            const pay = computePayslip({
              baseCommission: Number(inv.montantCommissions),
              frais: Number(inv.montantFrais),
            });
            return (
            <Link
              key={inv.id}
              href={`/factures/${inv.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-navy-50/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold capitalize">
                    {monthLabel(inv.mois)}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {inv.referenceFacture}
                    {showCommerciale ? ` · ${inv.user.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <p className="text-[15px] font-extrabold tabular-nums">
                    {formatCHF(pay.montantVerse)}
                  </p>
                  <ChevronRight aria-hidden="true" className="size-4 text-subtle" />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <InvoiceStatutBadge statut={inv.statut} />
                <span className="text-muted-foreground">
                  Comm. {formatCHF(Number(inv.montantCommissions))}
                </span>
                <span className="text-alert-700">
                  Cotis. -{formatCHF(pay.totalDeductions)}
                </span>
                <span className="text-muted-foreground">
                  Frais +{formatCHF(Number(inv.montantFrais))}
                </span>
              </div>
            </Link>
            );
          })
        )}
      </div>

      {/* Vue TABLEAU sur desktop */}
      <TableScroll label="Fiches de salaire" className="hidden md:block">
        <table className={TABLE_CLASS}>
          <thead className={THEAD_CLASS}>
            <tr>
              <Th className="pl-5">N°</Th>
              <Th>Mois facturé</Th>
              {showCommerciale && <Th>Commerciale</Th>}
              <Th className="text-right">Commissions</Th>
              <Th className="text-right">Cotisations</Th>
              <Th className="text-right">Frais</Th>
              <Th className="text-right">Net versé</Th>
              <Th>Statut</Th>
              <Th className="pr-5">Bulletin</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <TableEmptyRow colSpan={showCommerciale ? 9 : 8}>
                <Empty />
              </TableEmptyRow>
            ) : (
              rows.map((inv) => {
                const pay = computePayslip({
                  baseCommission: Number(inv.montantCommissions),
                  frais: Number(inv.montantFrais),
                });
                return (
                <tr key={inv.id} className={TR_CLASS}>
                  <Td className="pl-5 font-mono text-xs whitespace-nowrap">
                    <Link
                      href={`/factures/${inv.id}`}
                      className="font-bold text-info-700 hover:underline"
                    >
                      {inv.referenceFacture}
                    </Link>
                  </Td>
                  <Td className="font-semibold whitespace-nowrap capitalize">
                    {monthLabel(inv.mois)}
                  </Td>
                  {showCommerciale && (
                    <Td className="text-xs whitespace-nowrap">{inv.user.name}</Td>
                  )}
                  <Td className="text-right tabular-nums whitespace-nowrap">
                    {formatCHF(Number(inv.montantCommissions))}
                  </Td>
                  <Td className="text-right text-alert-700 tabular-nums whitespace-nowrap">
                    - {formatCHF(pay.totalDeductions)}
                  </Td>
                  <Td className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                    + {formatCHF(Number(inv.montantFrais))}
                  </Td>
                  <Td className="text-right font-extrabold tabular-nums whitespace-nowrap">
                    {formatCHF(pay.montantVerse)}
                  </Td>
                  <Td>
                    <InvoiceStatutBadge statut={inv.statut} />
                  </Td>
                  <Td className="pr-5">
                    <a
                      href={`/api/factures/${inv.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-info-700 hover:underline"
                    >
                      <Eye aria-hidden="true" className="size-3.5" />
                      Voir
                    </a>
                  </Td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
