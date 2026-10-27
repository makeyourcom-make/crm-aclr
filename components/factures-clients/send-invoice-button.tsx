"use client";

/**
 * Envoi (ou renvoi) d'une facture client par email : sujet / corps éditables,
 * PDF (facture + QR-bill + CGV) joint automatiquement, justificatifs en plus.
 * Chaque envoi crée une activité EMAIL_ENVOYE (+3 XP) : toast XP et
 * rafraîchissement de la page et de la coquille après succès.
 */
import { LoaderCircle, RotateCw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getInvoiceEmailDefaults,
  sendClientInvoiceByEmail,
} from "@/app/(app)/factures-clients/actions";
import { xpToast } from "@/components/arena/celebrate";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
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
import { XP_RULES } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

interface SendInvoiceButtonProps {
  invoiceId: string;
  invoiceNumero: string;
  clientName: string;
  clientEmail: string | null;
  /** Facture déjà envoyée : le bouton devient « Renvoyer ». */
  alreadySent?: boolean;
  /** Renvoi : affiche aussi le libellé « Renvoyer » (sinon icône seule). */
  showLabel?: boolean;
  className?: string;
}

export function SendInvoiceButton({
  invoiceId,
  invoiceNumero,
  clientName,
  clientEmail,
  alreadySent = false,
  showLabel = false,
  className,
}: SendInvoiceButtonProps) {
  const actionLabel = alreadySent ? "Renvoyer" : "Envoyer";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState(clientEmail ?? "");
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);

  // Charge les valeurs par défaut à l'ouverture du dialog (dans le
  // gestionnaire d'ouverture, pas dans un effet).
  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    setOpen(next);
    if (!next) return;
    setAttachments([]);
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
  };

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
        attachments.map((a) => ({
          url: a.url,
          filename: a.filename,
          mimeType: a.mimeType,
        })),
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
        xpToast(
          XP_RULES.email,
          alreadySent ? "Facture renvoyée !" : "Facture envoyée !",
          `${invoiceNumero} · ${res.recipient ?? recipient}`,
        );
      }
      setOpen(false);
      router.refresh();
    });
  };

  const disabledReason = clientEmail ? undefined : "Pas d'email sur la fiche client";
  const iconOnly = alreadySent && !showLabel;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        disabled={!clientEmail}
        className={cn(
          "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
          alreadySent
            ? "border border-border-strong bg-card text-foreground hover:bg-navy-50"
            : "bg-navy-700 px-3.5 text-white hover:bg-navy-600",
          alreadySent && (iconOnly ? "w-9" : "px-3"),
          className,
        )}
        title={
          disabledReason ??
          (alreadySent
            ? "Facture déjà envoyée : la renvoyer"
            : "Envoyer la facture par email")
        }
        aria-label={`${actionLabel} la facture ${invoiceNumero}`}
      >
        {alreadySent ? (
          <RotateCw aria-hidden="true" className="size-4" />
        ) : (
          <Send aria-hidden="true" className="size-3.5" />
        )}
        {!iconOnly && actionLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">
            {actionLabel} la facture {invoiceNumero}
            {alreadySent && (
              <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 align-middle font-sans text-[11px] font-bold text-gold-700">
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
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Chargement...
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`recipient-${invoiceId}`}>Destinataire</Label>
              <Input
                id={`recipient-${invoiceId}`}
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`subject-${invoiceId}`}>Sujet</Label>
              <Input
                id={`subject-${invoiceId}`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`body-${invoiceId}`}>Corps du mail</Label>
              <textarea
                id={`body-${invoiceId}`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-[12px] border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring/30 focus:outline-none"
                disabled={pending}
                required
              />
              <p className="text-xs text-muted-foreground">
                Texte brut. Une copie sera archivée dans la fiche du client
                (timeline d&apos;activités + boîte mail).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Pièces jointes supplémentaires</Label>
              <AttachmentPicker
                value={attachments}
                onChange={setAttachments}
                disabled={pending}
                pathPrefix={`invoice-attachments/${invoiceNumero}`}
                label="Joindre un justificatif"
              />
              <p className="text-xs text-muted-foreground">
                Le PDF de la facture est déjà joint. Ajoute ici d&apos;éventuels
                justificatifs (ex. tickets de frais de déplacement).
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleSend}
            disabled={pending || loading}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {pending ? "Envoi..." : "Envoyer maintenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
