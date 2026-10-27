"use client";

/**
 * Panel des pièces jointes d'une charge :
 *   - Ticket principal (si présent)
 *   - Pièces jointes complémentaires (attachments)
 *   - Bouton upload pour ajouter une PJ
 */
import { FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addExpenseAttachment,
  deleteExpenseAttachment,
} from "@/app/(app)/charges/actions";
import { SectionCard } from "@/components/arena/section-card";
import { Callout } from "@/components/common/callout";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { SELECT_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";

const KIND_OPTIONS = [
  { value: "", label: "Type de pièce (optionnel)" },
  { value: "FACTURE", label: "Facture" },
  { value: "RECU_CARTE", label: "Reçu carte" },
  { value: "PREUVE_VIREMENT", label: "Preuve virement" },
  { value: "LITIGE_DOUBLON", label: "Litige / doublon" },
  { value: "FACTURE_PARTAGEE", label: "Facture partagée" },
  { value: "AUTRE", label: "Autre" },
];

interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  kind: string | null;
}

export function ExpenseAttachmentsPanel({
  expenseId,
  ticketUrl,
  ticketName,
  attachments,
}: {
  expenseId: string;
  ticketUrl: string | null;
  ticketName: string | null;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [kind, setKind] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 6 MB).");
      return;
    }
    setUploadingName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      start(async () => {
        const res = await addExpenseAttachment({
          expenseId,
          fileDataUrl: reader.result as string,
          fileName: file.name,
          kind: kind || null,
        });
        setUploadingName(null);
        if (!res.ok) {
          toast.error(res.error ?? "Erreur");
          return;
        }
        toast.success("Pièce jointe ajoutée.");
        setKind("");
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  };

  const del = (id: string) => {
    if (!confirm("Supprimer cette pièce jointe ?")) return;
    start(async () => {
      const res = await deleteExpenseAttachment(id);
      if (!res.ok) {
        toast.error("error" in res ? res.error : "Erreur");
        return;
      }
      toast.success("Pièce jointe supprimée.");
      router.refresh();
    });
  };

  const count = (ticketUrl ? 1 : 0) + attachments.length;

  return (
    <SectionCard
      title="Pièces jointes"
      description={`${count} fichier${count > 1 ? "s" : ""}`}
      icon={Paperclip}
      tone="violet"
    >
      <div className="space-y-2.5">
        {/* Ticket principal */}
        {ticketUrl ? (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-lvl-500/25 bg-lvl-50 p-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-lvl-700"
            >
              <ImageIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">
                {ticketName ?? "Ticket principal"}
              </p>
              <p className="text-xs text-muted-foreground">Ticket principal</p>
            </div>
            <DocumentPreviewButton
              url={ticketUrl}
              filename={ticketName ?? undefined}
              label="Voir"
              icon="Eye"
            />
          </div>
        ) : (
          <Callout tone="gold">
            Aucun ticket principal. Ajoute-en un via le bouton ci-dessous (le
            premier fichier ajouté ici reste juste une PJ ; pour définir le
            ticket principal, supprime la charge et recrée-la avec photo).
          </Callout>
        )}

        {/* Pièces jointes complémentaires */}
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2.5 rounded-[14px] border border-border bg-ground p-2.5"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-muted-foreground"
            >
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">{a.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {a.kind ?? "PJ"}
                {a.fileSize ? ` · ${Math.round(a.fileSize / 1024)} KB` : ""}
              </p>
            </div>
            <DocumentPreviewButton
              url={a.fileUrl}
              filename={a.fileName}
              label="Voir"
              icon="Eye"
            />
            <button
              type="button"
              onClick={() => del(a.id)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-alert-50 hover:text-alert-700"
              title="Supprimer"
              aria-label={`Supprimer la pièce jointe ${a.fileName}`}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}

        {/* Upload */}
        <div className="space-y-2 border-t border-border pt-3.5">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Type de pièce jointe"
            className={SELECT_CLASS}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="w-full"
          >
            {pending && uploadingName ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            <span className="truncate">
              {pending && uploadingName
                ? `Envoi de ${uploadingName}…`
                : "Ajouter une pièce jointe"}
            </span>
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
