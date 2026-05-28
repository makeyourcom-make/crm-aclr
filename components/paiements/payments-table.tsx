"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { markPaymentEncaisse } from "@/app/(app)/paiements/actions";
import { PaymentStatutBadge } from "@/components/paiements/payment-statut-badge";
import { formatCHF, formatDate } from "@/lib/format";

import type { PaymentListItem } from "@/lib/queries/payments";

const TYPE_LABEL: Record<string, string> = {
  ACOMPTE: "Acompte",
  SOLDE: "Solde",
  MENSUALITE: "Mensualité",
};

interface PaymentsTableProps {
  rows: PaymentListItem[];
  showCommerciale?: boolean;
}

export function PaymentsTable({ rows, showCommerciale }: PaymentsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <Th>Date</Th>
            <Th>Contrat</Th>
            <Th>Client</Th>
            <Th>Type</Th>
            <Th>Facture</Th>
            <Th className="text-right">Montant</Th>
            <Th>Statut</Th>
            {showCommerciale && <Th>Commerciale</Th>}
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={showCommerciale ? 9 : 8}
                className="px-3 py-12 text-center text-muted-foreground"
              >
                Aucun paiement.
              </td>
            </tr>
          ) : (
            rows.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                showCommerciale={showCommerciale}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaymentRow({
  payment: p,
  showCommerciale,
}: {
  payment: PaymentListItem;
  showCommerciale?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleEncaisser = () => {
    startTransition(async () => {
      const res = await markPaymentEncaisse({ paymentId: p.id });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Paiement encaissé.");
    });
  };

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30">
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        {formatDate(p.date)}
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/contrats/${p.contract.id}`}
          className="font-mono text-xs font-medium hover:underline"
        >
          {p.contract.numero}
        </Link>
      </td>
      <td className="px-3 py-2 text-sm">
        <Link
          href={`/prospects/${p.contract.prospect.id}`}
          className="hover:underline"
        >
          {p.contract.prospect.raisonSociale}
        </Link>
      </td>
      <td className="px-3 py-2 text-xs">{TYPE_LABEL[p.type] ?? p.type}</td>
      <td className="px-3 py-2 text-xs font-mono">
        {p.clientInvoice?.numero ?? p.referenceFactureClient ?? "—"}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">
        {formatCHF(Number(p.montant))}
      </td>
      <td className="px-3 py-2">
        <PaymentStatutBadge statut={p.statut} />
      </td>
      {showCommerciale && (
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {p.contract.assigneA.name}
        </td>
      )}
      <td className="px-3 py-2 text-right">
        {p.statut !== "ENCAISSE" && (
          <button
            type="button"
            onClick={handleEncaisser}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            {pending ? "…" : "Encaisser"}
          </button>
        )}
      </td>
    </tr>
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
