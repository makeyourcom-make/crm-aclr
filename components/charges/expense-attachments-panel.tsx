"use client";

/**
 * Panel des pièces jointes d'une charge :
 *   - Ticket principal (si présent)
 *   - Pièces jointes complémentaires (attachments)
 *   - Bouton upload pour ajouter une PJ
 */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addExpenseAttachment,
  deleteExpenseAttachment,
} from "@/app/(app)/charges/actions";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";

const KIND_OPTIONS = [
  { value: "", label: "— Type —" },
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pièces jointes ({(ticketUrl ? 1 : 0) + attachments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ticket principal */}
        {ticketUrl ? (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
            <Icon name="Image" className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium">
                {ticketName ?? "Ticket principal"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Ticket principal
              </p>
            </div>
            <DocumentPreviewButton
              url={ticketUrl}
              filename={ticketName ?? undefined}
              label="Voir"
              icon="Eye"
            />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Aucun ticket principal. Ajoute-en un via le bouton ci-dessous (le
            premier fichier ajouté ici reste juste une PJ ; pour définir le
            ticket principal, supprime la charge et recrée-la avec photo).
          </p>
        )}

        {/* Attachments complémentaires */}
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2"
          >
            <Icon name="FileText" className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium">{a.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
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
              className="rounded p-1 text-rose-600 hover:bg-rose-50"
              title="Supprimer"
            >
              <Icon name="Trash" className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Upload */}
        <div className="space-y-2 border-t border-border pt-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
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
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="w-full"
          >
            <Icon name="Upload" className="mr-1.5 h-4 w-4" />
            {pending && uploadingName
              ? `Upload ${uploadingName}…`
              : "Ajouter une pièce jointe"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
