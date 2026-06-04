"use client";

/**
 * Vue détaillée d'un mail unique (page /emails/[id]).
 *
 * Affiche le corps HTML/texte, les pièces jointes téléchargeables, et
 * propose les actions Archiver / Désarchiver / Supprimer / Répondre.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteEmail,
  replyToEmail,
  setEmailArchive,
} from "@/app/(app)/emails/actions";
import {
  AttachmentPicker,
  type PickedAttachment,
} from "@/components/emails/attachment-picker";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

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
  prospect: { id: string; raisonSociale: string } | null;
  user: { name: string } | null;
  attachments: EmailAttachment[];
}

export function EmailDetailView({ email }: { email: EmailDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<PickedAttachment[]>(
    [],
  );

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
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(next ? "Archivé." : "Remis dans la boîte.");
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Supprimer définitivement ce mail ? Action irréversible.")) return;
    startTransition(async () => {
      const res = await deleteEmail(email.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Mail supprimé.");
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
      );
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(res.dryRun ? "Réponse enregistrée (dry-run)." : "Réponse envoyée ✓");
      setReplyContent("");
      setReplyAttachments([]);
      setShowReply(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p>
              <strong>De :</strong>{" "}
              {email.expediteurNom
                ? `${email.expediteurNom} <${email.expediteurEmail}>`
                : email.expediteurEmail}
            </p>
            <p>
              <strong>À :</strong> {email.destinataireEmail}
            </p>
            {email.prospect && (
              <p className="text-xs text-muted-foreground">
                Client :{" "}
                <Link
                  href={`/prospects/${email.prospect.id}`}
                  className="text-primary hover:underline"
                >
                  {email.prospect.raisonSociale}
                </Link>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(email.envoyeLe ?? email.createdAt).toLocaleString(
                "fr-CH",
                {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
              title={email.archive ? "Désarchiver" : "Archiver"}
            >
              <Icon name="Inbox" className="h-3.5 w-3.5" />
              {email.archive ? "Désarchiver" : "Archiver"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Supprimer définitivement"
            >
              <Icon name="Trash2" className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="rounded-lg border border-border bg-card p-4">
        {email.contenuHtml ? (
          <iframe
            srcDoc={email.contenuHtml}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="h-[500px] sm:h-[700px] w-full rounded border border-border bg-white"
            title={email.objet}
          />
        ) : email.contenuTexte ? (
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {email.contenuTexte}
          </pre>
        ) : (
          <p className="italic text-xs text-muted-foreground">
            (Contenu vide)
          </p>
        )}

        {email.attachments.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {email.attachments.length} pièce
              {email.attachments.length > 1 ? "s" : ""} jointe
              {email.attachments.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
                  title={`${a.mimeType} · ${formatSize(a.taille)}`}
                >
                  <Icon
                    name={
                      a.mimeType.startsWith("image/")
                        ? "Image"
                        : a.mimeType === "application/pdf"
                          ? "FileText"
                          : "Download"
                    }
                    className="h-3 w-3"
                  />
                  <span className="max-w-[200px] truncate">{a.nom}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({formatSize(a.taille)})
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Réponse */}
      <div className="rounded-lg border border-border bg-card p-4">
        {!showReply ? (
          <Button
            type="button"
            onClick={() => setShowReply(true)}
            variant="outline"
            className="w-full"
          >
            <Icon name="MailPlus" className="mr-2 h-3.5 w-3.5" />
            Répondre
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Répondre à{" "}
              <strong>
                {email.direction === "ENTRANT"
                  ? email.expediteurEmail
                  : email.destinataireEmail}
              </strong>
            </p>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={6}
              placeholder="Tape ta réponse…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <AttachmentPicker
              value={replyAttachments}
              onChange={setReplyAttachments}
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowReply(false);
                  setReplyContent("");
                  setReplyAttachments([]);
                }}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleReply} disabled={pending}>
                {pending ? "Envoi…" : "Envoyer la réponse"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
