"use client";

/**
 * Modal pour composer + envoyer un email à un prospect (fiche entreprise).
 *
 * - Sélection optionnelle d'un template (charge sujet + contenu)
 * - Variables substituées côté serveur ({{prenomContact}}, {{raisonSociale}}, …)
 * - Envoi réel via Resend si EMAIL_MODE=live, sinon dry-run (enregistré en
 *   base avec statut BROUILLON sans envoi réseau)
 * - MYC Arena : l'envoi crée l'activité EMAIL_ENVOYE → toast « +3 XP » puis
 *   rafraîchissement de la coquille (pilules XP / série).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Save, Send } from "lucide-react";

import { saveEmailDraft, sendEmailToProspect } from "@/app/(app)/emails/actions";
import { xpToast } from "@/components/arena/celebrate";
import { XpPill } from "@/components/arena/pills";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
import { FIELD_CLASS, uiText } from "@/components/emails/mail-ui";
import { RecipientInput } from "@/components/emails/recipient-input";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { htmlToPlainText } from "@/lib/email-html";
import { XP_RULES } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

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

const MAIL_VARIABLES = [
  "{{prenomContact}}",
  "{{nomContact}}",
  "{{raisonSociale}}",
  "{{ville}}",
  "{{commerciale}}",
];

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
  // template) : surtout PAS la valeur live, sinon le curseur sauterait à chaque
  // frappe. Le remontage est déclenché par `editorKey`.
  const [editorInitial, setEditorInitial] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  // Signature par défaut, affichée en aperçu (ajoutée automatiquement à l'envoi).
  const defaultSigHtml = signatures.find((s) => s.isDefault)?.html ?? "";
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
        attachments: attachments.length > 0 ? attachments : undefined,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'envoi."));
        return;
      }
      // Activité EMAIL_ENVOYE créée à chaque envoi (même en dry-run).
      xpToast(
        XP_RULES.email,
        res.dryRun ? "Email enregistré (dry-run)" : "Mail envoyé !",
        `à ${prospectName}`,
      );
      resetAndClose();
    });
  };

  const resetAndClose = () => {
    setTemplateId("");
    setObjet("");
    setContenuHtml("");
    setEditorInitial("");
    setEditorKey((k) => k + 1);
    setAttachments([]);
    setCc("");
    setBcc("");
    setShowCc(false);
    setOpen(false);
    router.refresh();
  };

  /** Prépare le mail pour plus tard : il part dans « Brouillons » de la boîte. */
  const handleSaveDraft = () => {
    if (!objet.trim() && !contenuTexte.trim()) {
      toast.error("Rien à enregistrer (sujet et contenu vides).");
      return;
    }
    startTransition(async () => {
      const res = await saveEmailDraft({
        prospectId,
        objet: objet.trim(),
        contenu: contenuTexte.trim(),
        contenuHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
        cc: cc.trim(),
        bcc: bcc.trim(),
      });
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de l'enregistrement."));
        return;
      }
      toast.success("Brouillon enregistré : retrouve-le dans Emails › Brouillons.");
      resetAndClose();
    });
  };

  const triggerClass =
    triggerVariant === "compact"
      ? buttonVariants({ variant: "outline", size: "sm" })
      : triggerVariant === "outline"
        ? buttonVariants({ variant: "outline" })
        : buttonVariants({ variant: "default" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClass} disabled={!prospectEmail}>
        <Mail aria-hidden="true" />
        Envoyer un email
      </DialogTrigger>
      <DialogContent className="rounded-[20px] p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="pr-8 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
            Email à {prospectName}
          </DialogTitle>
          <DialogDescription>
            {prospectEmail ? (
              <>
                Destinataire : <strong className="font-bold text-foreground">{prospectEmail}</strong>
              </>
            ) : (
              <span className="font-semibold text-alert-700">
                Pas d&apos;email connu pour ce prospect : renseigne-le d&apos;abord.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CC / CCI : repliés par défaut (comme Gmail). */}
          <div className="space-y-1.5">
            {!showCc ? (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="inline-flex h-8 items-center rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-navy-600 hover:bg-navy-100"
              >
                + Cc / Cci
              </button>
            ) : (
              <div className="space-y-2 rounded-[14px] border border-border bg-ground p-3">
                <Label htmlFor="cc" className="text-xs font-bold text-muted-foreground">
                  Cc
                </Label>
                <RecipientInput id="cc" value={cc} onChange={setCc} placeholder="copie@exemple.ch, autre@exemple.ch" />
                <Label htmlFor="bcc" className="text-xs font-bold text-muted-foreground">
                  Cci (copie cachée)
                </Label>
                <RecipientInput id="bcc" value={bcc} onChange={setBcc} placeholder="copie.cachee@exemple.ch" />
                <p className="text-xs text-muted-foreground">
                  Plusieurs adresses séparées par une virgule ou un
                  point-virgule.
                </p>
              </div>
            )}
          </div>

          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="template" className="text-xs font-bold text-muted-foreground">
                Modèle (optionnel)
              </Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className={cn(FIELD_CLASS, "font-semibold")}
              >
                <option value="">Rédiger sans modèle</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Les variables comme <code className="font-mono">{`{{prenomContact}}`}</code> seront
                remplacées automatiquement.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="objet" className="text-xs font-bold text-muted-foreground">
              Objet{" "}
              <span className="text-alert-700" aria-hidden="true">
                *
              </span>
            </Label>
            <input
              id="objet"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Ex. Démo Pack Web Complet"
              required
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">
              Message{" "}
              <span className="text-alert-700" aria-hidden="true">
                *
              </span>
            </p>
            <RichTextEditor
              key={editorKey}
              initialHtml={editorInitial}
              onChange={setContenuHtml}
              disabled={pending}
              placeholder="Bonjour {{prenomContact}}, …"
              variables={MAIL_VARIABLES}
              footer={
                defaultSigHtml ? (
                  <div className="border-t border-dashed border-border bg-ground px-4 py-2.5">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Signature ajoutée automatiquement à l&apos;envoi
                    </p>
                    <div className="text-xs" dangerouslySetInnerHTML={{ __html: defaultSigHtml }} />
                  </div>
                ) : undefined
              }
            />
            <p className="text-xs text-muted-foreground">
              Tu recevras automatiquement une copie sur ton Gmail.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">Pièces jointes</p>
            <AttachmentPicker
              value={attachments}
              onChange={setAttachments}
              disabled={pending}
              pathPrefix={`email-attachments/${prospectId}`}
            />
          </div>

          <DialogFooter className="-mx-5 -mb-5 flex-row flex-wrap rounded-b-[20px] bg-ground px-5 sm:-mx-6 sm:-mb-6 sm:justify-start sm:px-6">
            <Button type="submit" variant="hero" disabled={pending || !prospectEmail}>
              <Send aria-hidden="true" />
              {pending ? "Envoi…" : "Envoyer l'email"}
              <XpPill xp={XP_RULES.email} variant="solid" className="text-shadow-none" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleSaveDraft}
              disabled={pending}
            >
              <Save aria-hidden="true" />
              Enregistrer en brouillon
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
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
