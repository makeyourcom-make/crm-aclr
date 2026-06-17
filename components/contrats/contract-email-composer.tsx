"use client";

/**
 * Éditeur d'email d'envoi du contrat au client : on rédige le message, et on
 * choisit d'inclure le lien de signature en ligne et/ou le PDF (à imprimer /
 * signer à la main). Ouvert après l'enregistrement depuis le wizard.
 */
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { sendContractEmailCustom } from "@/app/(app)/contrats/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContractEmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  to: string;
  defaultSubject: string;
  defaultBody: string;
  /** Appelé après envoi réussi (ex. navigation vers la fiche contrat). */
  onSent: () => void;
}

export function ContractEmailComposer({
  open,
  onOpenChange,
  contractId,
  to,
  defaultSubject,
  defaultBody,
  onSent,
}: ContractEmailComposerProps) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [includeSignLink, setIncludeSignLink] = useState(true);
  const [includePdf, setIncludePdf] = useState(true);

  // Re-synchronise quand on rouvre avec un autre contrat.
  useEffect(() => {
    setSubject(defaultSubject);
    setBody(defaultBody);
    setIncludeSignLink(true);
    setIncludePdf(true);
  }, [defaultSubject, defaultBody, contractId]);

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Objet et message requis.");
      return;
    }
    startTransition(async () => {
      const res = await sendContractEmailCustom({
        contractId,
        subject: subject.trim(),
        body: body.trim(),
        includeSignLink,
        includePdf,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      toast.success(
        res.dryRun
          ? "Email préparé (mode test) — visible dans Emails."
          : "Email envoyé au client ✉️",
      );
      onOpenChange(false);
      onSent();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Envoyer le contrat par email</DialogTitle>
          <DialogDescription>
            Rédige ton message et choisis ce que le client reçoit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Destinataire</Label>
            <Input value={to} disabled className="bg-muted/40" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ce-subject" className="text-xs">
              Objet
            </Label>
            <Input
              id="ce-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ce-body" className="text-xs">
              Message
            </Label>
            <textarea
              id="ce-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">
              À inclure dans l&apos;email :
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeSignLink}
                onChange={(e) => setIncludeSignLink(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <strong>Lien de signature en ligne</strong> — le client signe
                directement à l&apos;écran (bouton « Signer le contrat »).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includePdf}
                onChange={(e) => setIncludePdf(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <strong>PDF du contrat</strong> — à télécharger, imprimer,
                signer à la main et renvoyer scanné.
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSend} disabled={pending}>
            {pending ? "Envoi…" : "Envoyer l'email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
