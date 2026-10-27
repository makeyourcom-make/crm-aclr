import { CalendarDays, FileDown, ListChecks, ReceiptText, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionCard } from "@/components/arena/section-card";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableEmptyRow,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { BackLink } from "@/components/common/back-link";
import { Callout } from "@/components/common/callout";
import { ChfValue } from "@/components/common/chf-value";
import { PageShell } from "@/components/common/page-shell";
import { InvoiceStatusButtons } from "@/components/factures/invoice-actions";
import { InvoiceStatutBadge } from "@/components/factures/invoice-statut-badge";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatCHF, formatDateLong } from "@/lib/format";
import { getInvoiceById } from "@/lib/queries/invoices";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

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
    <PageShell width="form">
      <PageHeader
        rubrique="finance"
        title={invoice.referenceFacture}
        description={`Facture mensuelle · ${monthLabel(invoice.mois)}`}
        breadcrumb={<BackLink href="/factures">Retour aux salaires</BackLink>}
        actions={
          <>
            <a
              href={`/api/factures/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <FileDown aria-hidden="true" />
              PDF
            </a>
            <InvoiceStatusButtons
              invoiceId={invoice.id}
              statut={invoice.statut}
              isAdmin={user.role === "ADMIN"}
            />
          </>
        }
      />

      {/* Méta */}
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-muted-foreground">
        <InvoiceStatutBadge statut={invoice.statut} />
        <span className="inline-flex items-center gap-1">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          Émise le {formatDateLong(invoice.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <UserRound aria-hidden="true" className="size-3.5" />
          Commerciale : <strong className="text-foreground">{invoice.user.name}</strong>
        </span>
      </div>

      {/* Récap montants */}
      <SectionCard title="Récapitulatif" icon={ReceiptText} tone="navy">
        <dl className="space-y-2.5 text-sm">
          <Row
            label={`Sous-total commissions (${invoice.commissionPayments.length} versement·s acquis ce mois)`}
            value={formatCHF(Number(invoice.montantCommissions))}
          />
          {garantieActivee && (
            <Row
              label={`Garantie absorbée : complète jusqu'au minimum (${formatCHF(Number(invoice.user.garantieMensuelle))})`}
              value={`+ ${formatCHF(Number(invoice.montantGarantieAbsorbee))}`}
              tone="gold"
            />
          )}
          <Row
            label="Forfait frais"
            value={`+ ${formatCHF(Number(invoice.montantFrais))}`}
            tone="muted"
          />
        </dl>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-[14px] bg-ground px-4 py-3.5">
          <span className="text-sm font-extrabold">Total à verser</span>
          <span className="score-number text-[32px] sm:text-[38px]">
            <ChfValue amount={Number(invoice.montantTotal)} cents />
          </span>
        </div>

        {garantieActivee && (
          <Callout tone="gold" className="mt-4">
            La garantie absorbée ({formatCHF(Number(invoice.montantGarantieAbsorbee))}) a
            complété les commissions ({formatCHF(Number(invoice.montantCommissions))})
            pour atteindre la garantie mensuelle.
          </Callout>
        )}
      </SectionCard>

      {/* Détail des versements */}
      <SectionCard
        className="mt-6 overflow-hidden"
        title="Versements de commission acquis ce mois"
        description={`${invoice.commissionPayments.length} versement(s)`}
        icon={ListChecks}
        tone="green"
        contentClassName="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6"
      >
        <TableScroll label="Versements de commission du mois">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <Th className="pl-5 sm:pl-6">Contrat</Th>
                <Th>Client</Th>
                <Th>Type</Th>
                <Th>Mois</Th>
                <Th className="pr-5 text-right sm:pr-6">Montant</Th>
              </tr>
            </thead>
            <tbody>
              {invoice.commissionPayments.length === 0 ? (
                <TableEmptyRow colSpan={5}>
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Aucun versement acquis ce mois : la garantie absorbée
                    couvre le minimum.
                  </p>
                </TableEmptyRow>
              ) : (
                invoice.commissionPayments.map((p) => (
                  <tr key={p.id} className={TR_CLASS}>
                    <Td className="pl-5 font-mono text-xs whitespace-nowrap sm:pl-6">
                      <Link
                        href={`/contrats/${p.commission.contract.id}`}
                        className="font-bold text-info-700 hover:underline"
                      >
                        {p.commission.contract.numero}
                      </Link>
                    </Td>
                    <Td className="min-w-[160px] font-semibold">
                      {p.commission.contract.prospect.raisonSociale}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {TYPE_PART_LABEL[p.typePart]}
                    </Td>
                    <Td className="text-xs tabular-nums">
                      {p.numeroMois ?? (
                        <span className="text-muted-foreground">
                          <span aria-hidden="true">·</span>
                          <span className="sr-only">Non applicable</span>
                        </span>
                      )}
                    </Td>
                    <Td className="pr-5 text-right font-bold tabular-nums whitespace-nowrap sm:pr-6">
                      {formatCHF(Number(p.montant))}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </SectionCard>
    </PageShell>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold" | "muted";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt
        className={cn(
          "min-w-0",
          tone === "gold" && "font-semibold text-gold-700",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd className="shrink-0 font-bold tabular-nums">{value}</dd>
    </div>
  );
}
