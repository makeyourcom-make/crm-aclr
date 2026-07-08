"use client";

/**
 * Modal pour composer + envoyer un email à un prospect.
 *
 * - Sélection optionnelle d'un template (charge sujet + contenu)
 * - Variables substituées côté serveur ({{prenomContact}}, {{raisonSociale}}, …)
 * - Envoi réel via Resend si EMAIL_MODE=live, sinon dry-run (enregistré en
 *   base avec statut BROUILLON sans envoi réseau)
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { sendEmailToProspect } from "@/app/(app)/emails/actions";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { htmlToPlainText } from "@/lib/email-html";
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
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateOption {
  id: string;
  nom: string;
  objet: string;
  contenu: string;
}

interface SignatureOption {
  id: string;
  nom: string;
  html: string;
  isDefault: boolean;
}

interface SendEmailDialogProps {
  prospectId: string;
  prospectEmail: string | null;
  prospectName: string;
  templates?: TemplateOption[];
  signatures?: SignatureOption[];
  /** Variante du bouton déclencheur */
  triggerVariant?: "default" | "outline" | "compact";
}

export function SendEmailDialog({
  prospectId,
  prospectEmail,
  prospectName,
  templates = [],
  signatures = [],
  triggerVariant = "default",
}: SendEmailDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [templateId, setTemplateId] = useState("");
  const [objet, setObjet] = useState("");
  const [contenuHtml, setContenuHtml] = useState("");
  // HTML initial STABLE de l'éditeur (ne change qu'au montage / chargement de
  // template) — surtout PAS la valeur live, sinon le curseur sauterait à chaque
  // frappe. Le remontage est déclenché par `editorKey`.
  const [editorInitial, setEditorInitial] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [signatureId, setSignatureId] = useState(
    signatures.find((s) => s.isDefault)?.id ?? "",
  );
  const selectedSig = signatures.find((s) => s.id === signatureId);
  const contenuTexte = htmlToPlainText(contenuHtml);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setObjet(t.objet);
      // Le template est en texte brut → converti en HTML pour l'éditeur riche.
      const html = plainToHtml(t.contenu);
      setEditorInitial(html);
      setContenuHtml(html);
      setEditorKey((k) => k + 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectEmail) {
      toast.error("Pas d'email connu pour ce prospect.");
      return;
    }
    if (!objet.trim()) {
      toast.error("Donne un sujet.");
      return;
    }
    if (!contenuTexte.trim()) {
      toast.error("Le contenu est vide.");
      return;
    }
    startTransition(async () => {
      const res = await sendEmailToProspect({
        prospectId,
        templateId: templateId || undefined,
        objet: objet.trim(),
        contenu: contenuTexte.trim(),
        contenuHtml,
        signatureId: signatureId || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'envoi.");
        return;
      }
      if (res.dryRun) {
        toast.success("Email enregistré (mode dry-run, pas d'envoi réel).");
      } else {
        toast.success(`Email envoyé à ${prospectName} ✓`);
      }
      // Reset + close
      setTemplateId("");
      setObjet("");
      setContenuHtml("");
      setEditorInitial("");
      setEditorKey((k) => k + 1);
      setOpen(false);
      router.refresh();
    });
  };

  const triggerClass =
    triggerVariant === "compact"
      ? "inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
      : triggerVariant === "outline"
        ? "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
        : "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClass} disabled={!prospectEmail}>
        <Icon name="Mail" className="h-3.5 w-3.5" />
        Envoyer un email
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email à {prospectName}</DialogTitle>
          <DialogDescription>
            {prospectEmail ? (
              <>Destinataire : <strong>{prospectEmail}</strong></>
            ) : (
              "⚠️ Pas d'email connu pour ce prospect — renseigne-le d'abord."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="template">Template (optionnel)</Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value="">— Rédiger sans template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Les variables comme <code>{`{{prenomContact}}`}</code> seront
                remplacées automatiquement.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="objet">
              Sujet <span className="text-red-500">*</span>
            </Label>
            <Input
              id="objet"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Ex. Démo Pack Web Complet"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Contenu <span className="text-red-500">*</span>
            </Label>
            <RichTextEditor
              key={editorKey}
              initialHtml={editorInitial}
              onChange={setContenuHtml}
              disabled={pending}
              placeholder="Bonjour {{prenomContact}}, …"
            />
            <p className="text-[11px] text-muted-foreground">
              Tu recevras automatiquement une copie sur ton Gmail.
            </p>
          </div>

          {signatures.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="signature">Signature</Label>
              <select
                id="signature"
                value={signatureId}
                onChange={(e) => setSignatureId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value="">— Aucune signature —</option>
                {signatures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                    {s.isDefault ? " (par défaut)" : ""}
                  </option>
                ))}
              </select>
              {selectedSig && (
                <div
                  className="mt-1 rounded-md border border-border bg-white p-3"
                  dangerouslySetInnerHTML={{ __html: selectedSig.html }}
                />
              )}
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
            <Button type="submit" disabled={pending || !prospectEmail}>
              {pending ? "Envoi…" : "Envoyer l'email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Convertit un texte brut (template) en HTML simple pour l'éditeur riche. */
function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\r?\n/g, "<br>");
}
