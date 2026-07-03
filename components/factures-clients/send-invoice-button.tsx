"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  getInvoiceEmailDefaults,
  sendClientInvoiceByEmail,
} from "@/app/(app)/factures-clients/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SendInvoiceButtonProps {
  invoiceId: string;
  invoiceNumero: string;
  clientName: string;
  clientEmail: string | null;
  /** Facture déjà envoyée : le bouton devient « Renvoyer ». */
  alreadySent?: boolean;
}

export function SendInvoiceButton({
  invoiceId,
  invoiceNumero,
  clientName,
  clientEmail,
  alreadySent = false,
}: SendInvoiceButtonProps) {
  const actionLabel = alreadySent ? "Renvoyer" : "Envoyer";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState(clientEmail ?? "");

  // Charge les valeurs par défaut quand on ouvre le dialog
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getInvoiceEmailDefaults(invoiceId).then((res) => {
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de chargement.");
        setOpen(false);
        return;
      }
      setSubject(res.subject ?? "");
      setBody(res.body ?? "");
      setRecipient(res.recipient ?? clientEmail ?? "");
    });
  }, [open, invoiceId, clientEmail]);

  const handleSend = () => {
    if (!recipient.trim()) {
      toast.error("Pas de destinataire.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Sujet vide.");
      return;
    }
    if (!body.trim()) {
      toast.error("Corps du mail vide.");
      return;
    }
    startTransition(async () => {
      const res = await sendClientInvoiceByEmail(
        invoiceId,
        subject.trim(),
        body.trim(),
      );
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
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={!clientEmail}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        title={
          clientEmail
            ? `${actionLabel} la facture par email`
            : "Pas d'email sur la fiche client"
        }
      >
        <Icon name="MailPlus" className="h-3 w-3" />
        {actionLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {actionLabel} la facture {invoiceNumero}
            {alreadySent && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 align-middle">
                déjà envoyée
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            À : <strong>{clientName}</strong>. Tu peux modifier le sujet et le
            corps avant l&apos;envoi. Le PDF (facture + QR-bill + CGV) sera
            attaché automatiquement.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chargement…
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recipient">Destinataire</Label>
              <Input
                id="recipient"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject">Sujet</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="body">Corps du mail</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={pending}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Texte brut. Une copie sera archivée dans la fiche du client
                (timeline d&apos;activités + boîte mail).
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={pending || loading}
          >
            {pending ? "Envoi…" : "Envoyer maintenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
