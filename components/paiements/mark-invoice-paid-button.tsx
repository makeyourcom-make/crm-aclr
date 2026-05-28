"use client";

/**
 * Petit bouton "Marquer payée" sur une ligne ClientInvoice dans la fiche
 * d'un contrat. En 1 clic :
 *   - crée un Payment ENCAISSE couvrant le montant total de la facture
 *   - marque la ClientInvoice PAYEE
 *   - déclenche la commission SIGNATURE si c'est le 1er paiement encaissé
 */
import { useTransition } from "react";
import { toast } from "sonner";

import { markClientInvoicePaid } from "@/app/(app)/paiements/actions";

interface MarkInvoicePaidButtonProps {
  invoiceId: string;
  /** Si true, masque le bouton (facture déjà payée). */
  hidden?: boolean;
}

export function MarkInvoicePaidButton({
  invoiceId,
  hidden,
}: MarkInvoicePaidButtonProps) {
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  const handleClick = () => {
    startTransition(async () => {
      const res = await markClientInvoicePaid({ clientInvoiceId: invoiceId });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Facture marquée payée.");
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex h-6 items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 text-[11px] text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
    >
      {pending ? "…" : "Marquer payée"}
    </button>
  );
}
