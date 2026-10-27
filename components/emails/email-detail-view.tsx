"use client";

/**
 * Vue détaillée d'un mail unique (page /emails/[id]).
 *
 * Affiche le corps HTML/texte, les pièces jointes téléchargeables, et
 * propose les actions Archiver / Désarchiver / Corbeille / Répondre.
 * Une réponse dans un fil lié à un client rapporte +3 XP (activité
 * EMAIL_ENVOYE) : toast XP + rafraîchissement de la coquille.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Download,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Reply,
  Send,
  Trash2,
} from "lucide-react";

import {
  deleteEmail,
  refetchEmailBody,
  replyToEmail,
  setEmailArchive,
} from "@/app/(app)/emails/actions";
import { xpToast } from "@/components/arena/celebrate";
import { StatusPill, XpPill } from "@/components/arena/pills";
import type { Tone } from "@/components/arena/tones";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
import { EmailHtmlFrame } from "@/components/emails/email-html-frame";
import {
  CAPS_CLASS,
  initialsFrom,
  mailDateTime,
  uiText,
} from "@/components/emails/mail-ui";
import { RecipientInput } from "@/components/emails/recipient-input";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { XP_RULES } from "@/lib/gamification/rules";

interface EmailAttachment {
  id: string;
  nom: string;
  taille: number;
  mimeType: string;
  url: string;
}

interface EmailDetail {
  id: string;
  direction: "SORTANT" | "ENTRANT";
  expediteurEmail: string;
  expediteurNom: string | null;
  destinataireEmail: string;
  objet: string;
  contenuHtml: string;
  contenuTexte: string;
  statut: string;
  envoyeLe: string | null;
  createdAt: string;
  archive: boolean;
  resendInboundId: string | null;
  prospect: { id: string; raisonSociale: string } | null;
  user: { name: string } | null;
  attachments: EmailAttachment[];
}

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  LIVRE: "Livré",
  OUVERT: "Ouvert",
  CLIQUE: "Cliqué",
  REPONDU: "Répondu",
  REBOND: "Rebond",
  ERREUR: "Erreur",
};

const STATUT_TONE: Record<string, Tone> = {
  BROUILLON: "navy",
  ENVOYE: "navy",
  LIVRE: "blue",
  OUVERT: "teal",
  CLIQUE: "green",
  REPONDU: "violet",
  REBOND: "red",
  ERREUR: "red",
};

export function EmailDetailView({ email }: { email: EmailDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<PickedAttachment[]>(
    [],
  );
  const [showReplyCc, setShowReplyCc] = useState(false);
  const [replyCc, setReplyCc] = useState("");
  const [replyBcc, setReplyBcc] = useState("");

  const handleRefetch = () => {
    startTransition(async () => {
      const res = await refetchEmailBody(email.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la récupération."));
        return;
      }
      toast.success("Contenu récupéré.");
      router.refresh();
    });
  };

  const handleArchiveToggle = () => {
    const next = !email.archive;
    const msg = next
      ? email.prospect
        ? `Archiver ce mail ? Il sera retiré de la boîte de réception mais restera visible sur la fiche ${email.prospect.raisonSociale}.`
        : "Archiver ce mail ?"
      : "Désarchiver ce mail et le remettre dans la boîte de réception ?";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await setEmailArchive(email.id, next);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(next ? "Archivé." : "Remis dans la boîte.");
      router.refresh();
    });
  };

  // deleteEmail = mise à la corbeille (restaurable depuis la boîte).
  const handleDelete = () => {
    if (!confirm("Mettre ce mail à la corbeille ? Il restera restaurable depuis la Corbeille de la boîte.")) return;
    startTransition(async () => {
      const res = await deleteEmail(email.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success("Mail mis à la corbeille.");
      router.push(email.prospect ? `/prospects/${email.prospect.id}` : "/emails");
    });
  };

  const handleReply = () => {
    if (!replyContent.trim()) {
      toast.error("Écris un contenu.");
      return;
    }
    startTransition(async () => {
      const res = await replyToEmail(
        email.id,
        replyContent.trim(),
        undefined,
        replyAttachments.length > 0 ? replyAttachments : undefined,
        undefined,
        replyCc.trim() || undefined,
        replyBcc.trim() || undefined,
      );
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      if (email.prospect) {
        xpToast(
          XP_RULES.email,
          res.dryRun ? "Réponse enregistrée (dry-run)" : "Réponse envoyée !",
          `à ${email.prospect.raisonSociale}`,
        );
      } else {
        toast.success(res.dryRun ? "Réponse enregistrée (dry-run)." : "Réponse envoyée.");
      }
      setReplyContent("");
      setReplyAttachments([]);
      setReplyCc("");
      setReplyBcc("");
      setShowReplyCc(false);
      setShowReply(false);
      router.refresh();
    });
  };

  const fromLabel = email.expediteurNom
    ? `${email.expediteurNom} <${email.expediteurEmail}>`
    : email.expediteurEmail;
  const replyTarget =
    email.direction === "ENTRANT" ? email.expediteurEmail : email.destinataireEmail;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mail-50 text-[13px] font-extrabold text-mail-700"
            >
              {initialsFrom(email.expediteurNom || email.expediteurEmail)}
            </span>
            <div className="min-w-0 space-y-1 text-sm">
              <p className="break-words">
                <span className="font-bold text-muted-foreground">De : </span>
                <span className="font-semibold text-foreground">{fromLabel}</span>
              </p>
              <p className="break-words">
                <span className="font-bold text-muted-foreground">À : </span>
                <span className="font-semibold text-foreground">{email.destinataireEmail}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {mailDateTime(email.envoyeLe ?? email.createdAt)}
                {email.user?.name ? ` · boîte de ${email.user.name}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <StatusPill tone={STATUT_TONE[email.statut] ?? "navy"}>
                  {STATUT_LABEL[email.statut] ?? email.statut}
                </StatusPill>
                {email.prospect && (
                  <Link
                    href={`/prospects/${email.prospect.id}`}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-info-50 px-2.5 text-xs font-bold text-info-700 hover:underline"
                  >
                    <Building2 className="size-3.5" aria-hidden="true" />
                    {email.prospect.raisonSociale}
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleArchiveToggle}
              disabled={pending}
              title={email.archive ? "Désarchiver" : "Archiver"}
            >
              {email.archive ? (
                <ArchiveRestore aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
              {email.archive ? "Désarchiver" : "Archiver"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={pending}
              className="text-alert-700 hover:bg-alert-50 hover:text-alert-700"
              title="Mettre à la corbeille"
            >
              <Trash2 aria-hidden="true" />
              Corbeille
            </Button>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5">
        {email.contenuHtml ? (
          <EmailHtmlFrame
            html={email.contenuHtml}
            title={email.objet}
            className="w-full rounded-[12px] border border-border bg-white"
          />
        ) : email.contenuTexte ? (
          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {email.contenuTexte}
          </pre>
        ) : email.direction === "ENTRANT" ? (
          <div className="rounded-[12px] bg-gold-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-gold-700">
              Le contenu n&apos;a pas pu être récupéré à la réception (API Resend
              momentanément indisponible). Le message existe toujours côté
              Resend.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefetch}
              disabled={pending}
              className="mt-2"
            >
              <Download aria-hidden="true" />
              {pending ? "Récupération…" : "Récupérer le contenu"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            (Contenu vide : le mail reçu n&apos;avait pas de corps)
          </p>
        )}

        {email.direction === "ENTRANT" &&
          /<img\b[^>]*\bsrc\s*=\s*["'](?!\s*(?:https?:|data:))/i.test(
            email.contenuHtml,
          ) &&
          !email.attachments.some((a) => a.mimeType.startsWith("image/")) && (
            <div className="mt-3 rounded-[12px] bg-gold-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-gold-700">
                Une image de ce mail n&apos;a pas pu être chargée à la réception.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefetch}
                disabled={pending}
                className="mt-2"
              >
                <Download aria-hidden="true" />
                {pending ? "Récupération…" : "Récupérer l'image"}
              </Button>
            </div>
          )}

        {email.attachments.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={CAPS_CLASS}>
                {email.attachments.length} pièce
                {email.attachments.length > 1 ? "s" : ""} jointe
                {email.attachments.length > 1 ? "s" : ""}
              </p>
              {email.attachments.length > 1 && (
                <a
                  href={`/api/emails/${email.id}/attachments/zip`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-xs font-bold text-info-700 transition-colors hover:bg-info-50"
                  title="Télécharger toutes les pièces jointes dans un .zip"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Tout télécharger (.zip)
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((a) => {
                const AttIcon = a.mimeType.startsWith("image/")
                  ? ImageIcon
                  : a.mimeType === "application/pdf"
                    ? FileText
                    : FileIcon;
                return (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-[12px] border border-border-strong bg-card px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-navy-50"
                    title={`${a.mimeType} · ${formatFileSize(a.taille)}`}
                  >
                    <AttIcon className="size-4 shrink-0 text-mail-700" aria-hidden="true" />
                    <span className="max-w-[200px] truncate font-bold">{a.nom}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(a.taille)}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Réponse */}
      <div className="rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5">
        {!showReply ? (
          <div className="space-y-2">
            <Button
              type="button"
              onClick={() => setShowReply(true)}
              variant="outline"
              size="lg"
              className="w-full"
            >
              <Reply aria-hidden="true" />
              Répondre
            </Button>
            {email.prospect && (
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <XpPill xp={XP_RULES.email} /> à l&apos;envoi de ta réponse
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-foreground">
                Répondre à {replyTarget}
              </h2>
              {email.prospect && <XpPill xp={XP_RULES.email} label="à l'envoi" />}
            </div>
            {!showReplyCc ? (
              <button
                type="button"
                onClick={() => setShowReplyCc(true)}
                className="inline-flex h-8 items-center rounded-[10px] bg-navy-50 px-2.5 text-xs font-bold text-navy-600 hover:bg-navy-100"
              >
                + Cc / Cci
              </button>
            ) : (
              <div className="space-y-2 rounded-[14px] border border-border bg-ground p-3">
                <label htmlFor="detail-cc" className="text-xs font-bold text-muted-foreground">
                  Cc
                </label>
                <RecipientInput
                  id="detail-cc"
                  value={replyCc}
                  onChange={setReplyCc}
                  placeholder="copie@exemple.ch, autre@exemple.ch"
                  disabled={pending}
                />
                <label htmlFor="detail-bcc" className="text-xs font-bold text-muted-foreground">
                  Cci
                </label>
                <RecipientInput
                  id="detail-bcc"
                  value={replyBcc}
                  onChange={setReplyBcc}
                  placeholder="copie.cachee@exemple.ch"
                  disabled={pending}
                />
              </div>
            )}
            <label htmlFor="detail-reply" className="sr-only">
              Réponse
            </label>
            <textarea
              id="detail-reply"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={7}
              placeholder="Tape ta réponse…"
              className="w-full rounded-[14px] border border-border-strong bg-card px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25"
            />
            <AttachmentPicker
              value={replyAttachments}
              onChange={setReplyAttachments}
              disabled={pending}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="hero" onClick={handleReply} disabled={pending}>
                <Send aria-hidden="true" />
                {pending ? "Envoi…" : "Envoyer la réponse"}
                {email.prospect && (
                  <XpPill xp={XP_RULES.email} variant="solid" className="text-shadow-none" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  setShowReply(false);
                  setReplyContent("");
                  setReplyAttachments([]);
                }}
                disabled={pending}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
