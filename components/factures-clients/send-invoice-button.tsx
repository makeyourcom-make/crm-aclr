"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { sendClientInvoiceByEmail } from "@/app/(app)/factures-clients/actions";
import { Icon } from "@/components/icon";

interface SendInvoiceButtonProps {
  invoiceId: string;
  invoiceNumero: string;
  clientName: string;
  clientEmail: string | null;
}

export function SendInvoiceButton({
  invoiceId,
  invoiceNumero,
  clientName,
  clientEmail,
}: SendInvoiceButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!clientEmail) {
      toast.error(
        `Pas d'email connu pour ${clientName} — ajoute-le sur sa fiche prospect.`,
      );
      return;
    }
    if (
      !confirm(
        `Envoyer la facture ${invoiceNumero} à ${clientEmail} ?\n\n` +
          `Le PDF (facture + QR-bill + CGV) sera attaché et le statut passera à "Émise".`,
      )
    )
      return;
    startTransition(async () => {
      const res = await sendClientInvoiceByEmail(invoiceId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      if (res.dryRun) {
        toast.success(
          `Facture ${invoiceNumero} simulée (dry-run, pas d'envoi réel).`,
        );
      } else {
        toast.success(`Facture ${invoiceNumero} envoyée à ${res.recipient} ✓`);
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || !clientEmail}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
      title={
        clientEmail
          ? `Envoyer par email à ${clientEmail}`
          : "Pas d'email sur la fiche client"
      }
    >
      <Icon name="MailPlus" className="h-3 w-3" />
      {pending ? "Envoi…" : "Envoyer"}
    </button>
  );
}
