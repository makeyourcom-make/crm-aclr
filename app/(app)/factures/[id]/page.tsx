import Link from "next/link";
import { notFound } from "next/navigation";

import {
  InvoiceStatusButtons,
} from "@/components/factures/invoice-actions";
import { InvoiceStatutBadge } from "@/components/factures/invoice-statut-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatDateLong } from "@/lib/format";
import { getInvoiceById } from "@/lib/queries/invoices";
import { requireUser } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Facture ${id.slice(0, 8)}…` };
}

const TYPE_PART_LABEL: Record<string, string> = {
  SIGNATURE: "Signature",
  ETALEMENT: "Étalement",
  RENOUVELLEMENT: "Renouvellement",
};

function monthLabel(d: Date): string {
  return d
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric" })
    .replace(/^(.)/, (m) => m.toUpperCase());
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await getInvoiceById(user, id);
  if (!invoice) notFound();

  const garantieActivee = Number(invoice.montantGarantieAbsorbee) > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 lg:px-8">
      <PageHeader
        title={invoice.referenceFacture}
        description={`Facture mensuelle · ${monthLabel(invoice.mois)}`}
        breadcrumb={
          <Link
            href="/factures"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux factures
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/api/factures/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted transition-colors"
            >
              <Icon name="Receipt" className="h-4 w-4" />
              PDF
            </a>
            <InvoiceStatusButtons
              invoiceId={invoice.id}
              statut={invoice.statut}
              isAdmin={user.role === "ADMIN"}
            />
          </div>
        }
      />

      {/* Header info */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <InvoiceStatutBadge statut={invoice.statut} />
        <span className="text-xs text-muted-foreground">
          Émise le {formatDateLong(invoice.createdAt)}
        </span>
        <span className="text-xs text-muted-foreground">
          · Commerciale : <strong>{invoice.user.name}</strong>
        </span>
      </div>

      {/* Récap montants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <Row
              label={`Sous-total commissions (${invoice.commissionPayments.length} versement·s acquis ce mois)`}
              value={formatCHF(Number(invoice.montantCommissions))}
            />
            {garantieActivee && (
              <Row
                label={`Garantie absorbée — complète jusqu'au minimum (${formatCHF(Number(invoice.user.garantieMensuelle))})`}
                value={`+ ${formatCHF(Number(invoice.montantGarantieAbsorbee))}`}
                tone="amber"
              />
            )}
            <Row
              label="Forfait frais"
              value={`+ ${formatCHF(Number(invoice.montantFrais))}`}
              tone="muted"
            />
            <div className="my-2 border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Total à verser</span>
              <span className="text-2xl font-semibold text-primary tabular-nums">
                {formatCHF(Number(invoice.montantTotal))}
              </span>
            </div>
          </div>

          {garantieActivee && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⓘ La garantie absorbée (CHF {Number(invoice.montantGarantieAbsorbee).toFixed(2)}) a
              complété les commissions ({formatCHF(Number(invoice.montantCommissions))})
              pour atteindre la garantie mensuelle.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détail des versements */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Versements de commission acquis ce mois (
            {invoice.commissionPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left">
                <tr>
                  <Th>Contrat</Th>
                  <Th>Client</Th>
                  <Th>Type</Th>
                  <Th>Mois</Th>
                  <Th className="text-right">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {invoice.commissionPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      Aucun versement acquis ce mois — la garantie absorbée
                      couvre le minimum.
                    </td>
                  </tr>
                ) : (
                  invoice.commissionPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/contrats/${p.commission.contract.id}`}
                          className="hover:underline"
                        >
                          {p.commission.contract.numero}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.commission.contract.prospect.raisonSociale}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {TYPE_PART_LABEL[p.typePart]}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.numeroMois ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCHF(Number(p.montant))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "muted";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={
          tone === "amber"
            ? "text-amber-700"
            : tone === "muted"
              ? "text-muted-foreground"
              : ""
        }
      >
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
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
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
