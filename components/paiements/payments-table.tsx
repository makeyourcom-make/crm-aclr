"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markPaymentEncaisse } from "@/app/(app)/paiements/actions";
import { PaymentStatutBadge } from "@/components/paiements/payment-statut-badge";
import { Button } from "@/components/ui/button";
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

const TH =
  "px-3 py-3 text-left text-[11px] font-bold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase";

export function PaymentsTable({ rows, showCommerciale }: PaymentsTableProps) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-border bg-card shadow-arena">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-ground/80">
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Contrat</th>
            <th className={TH}>Client</th>
            <th className={TH}>Type</th>
            <th className={TH}>Facture</th>
            <th className={`${TH} text-right`}>Montant</th>
            <th className={TH}>Statut</th>
            {showCommerciale && <th className={TH}>Commerciale</th>}
            <th className={TH}>
              <span className="sr-only">Actions</span>
            </th>
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleEncaisser = () => {
    startTransition(async () => {
      const res = await markPaymentEncaisse({ paymentId: p.id });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Paiement encaissé.");
      router.refresh();
    });
  };

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-navy-50/70">
      <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(p.date)}</td>
      <td className="px-3 py-2.5">
        <Link
          href={`/contrats/${p.contract.id}`}
          className="font-bold tabular-nums hover:underline"
        >
          {p.contract.numero}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <Link
          href={`/prospects/${p.contract.prospect.id}`}
          className="font-semibold hover:underline"
        >
          {p.contract.prospect.raisonSociale}
        </Link>
      </td>
      <td className="px-3 py-2.5">{TYPE_LABEL[p.type] ?? p.type}</td>
      <td className="px-3 py-2.5 tabular-nums">
        {p.clientInvoice?.numero ?? p.referenceFactureClient ?? "-"}
      </td>
      <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
        {formatCHF(Number(p.montant))}
      </td>
      <td className="px-3 py-2.5">
        <PaymentStatutBadge statut={p.statut} />
      </td>
      {showCommerciale && (
        <td className="px-3 py-2.5 text-muted-foreground">
          {p.contract.assigneA.name}
        </td>
      )}
      <td className="px-3 py-2.5 text-right">
        {p.statut !== "ENCAISSE" && (
          <Button
            type="button"
            size="sm"
            onClick={handleEncaisser}
            disabled={pending}
            className="bg-win-700 text-white hover:bg-win-700/90"
          >
            {pending ? "..." : "Encaisser"}
          </Button>
        )}
      </td>
    </tr>
  );
}
