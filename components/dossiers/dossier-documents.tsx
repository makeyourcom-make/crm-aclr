"use client";

/**
 * Documents d'un projet : dépôt, liste, suppression (MYC Arena).
 *
 * Le fichier part DIRECTEMENT du navigateur vers Vercel Blob (même route signée
 * que les pièces jointes email) : il ne traverse jamais une fonction serverless,
 * ce qui évite la limite dure de 4.5 MB sur le corps des requêtes. Seule la
 * référence est ensuite persistée via `addDossierAttachment`.
 *
 * Contrairement aux PJ email (gardées en mémoire jusqu'à l'envoi), un document
 * de projet est enregistré IMMÉDIATEMENT : il n'y a pas d'action « envoyer » qui
 * viendrait le valider plus tard.
 */
import { upload } from "@vercel/blob/client";
import { Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addDossierAttachment,
  deleteDossierAttachment,
} from "@/app/(app)/dossiers/actions";
import { uploadEmailAttachment } from "@/app/(app)/emails/attachments-actions";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";

export interface DossierDocument {
  id: string;
  nom: string;
  taille: number;
  mimeType: string;
  url: string;
  createdAt: string;
  ajoutePar: { name: string };
}

const MAX_MB = 20;

function iconFor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "FileText";
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return "FileSpreadsheet";
  return "Download";
}

export function DossierDocuments({
  dossierId,
  documents,
  onChanged,
}: {
  dossierId: string;
  documents: DossierDocument[];
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const tropGros = list.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tropGros) {
      toast.error(`${tropGros.name} dépasse ${MAX_MB} MB.`);
      return;
    }

    startTransition(async () => {
      let ok = 0;
      for (const file of list) {
        let url: string | null = null;
        try {
          // Voie principale (prod) : navigateur → Blob, sans passer par le serveur.
          const blob = await upload(`dossier-documents/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/emails/attachments/upload",
            contentType: file.type || undefined,
          });
          url = blob.url;
        } catch {
          // Repli (dev local / Blob non configuré) : upload via server action.
          const fd = new FormData();
          fd.append("file", file);
          const up = await uploadEmailAttachment(fd);
          if (!up.ok || !up.url) {
            toast.error(`${file.name} : ${up.error ?? "upload impossible."}`);
            continue;
          }
          url = up.url;
        }

        const res = await addDossierAttachment({
          dossierId,
          url,
          nom: file.name,
          mimeType: file.type || "application/octet-stream",
          taille: file.size,
        });
        if (!res.ok) {
          toast.error(`${file.name} : ${res.error ?? "enregistrement échoué."}`);
          continue;
        }
        ok++;
      }
      if (ok > 0) {
        toast.success(ok > 1 ? `${ok} documents ajoutés.` : "Document ajouté.");
        onChanged();
      }
    });
  };

  const remove = (doc: DossierDocument) => {
    if (!confirm(`Retirer « ${doc.nom} » du projet ?`)) return;
    startTransition(async () => {
      const res = await deleteDossierAttachment(doc.id);
      if (!res.ok) {
        toast.error(res.error ?? "Suppression impossible.");
        return;
      }
      toast.success("Document retiré.");
      onChanged();
    });
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        Documents ({documents.length})
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={pending}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <button
        type="button"
        disabled={pending}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-dashed px-3 py-4 text-center text-xs font-semibold transition-colors disabled:cursor-wait",
          dragOver
            ? "border-lvl-500 bg-lvl-50 text-lvl-700"
            : "border-border-strong bg-ground text-muted-foreground hover:bg-navy-50",
        )}
      >
        {pending ? (
          "Envoi en cours..."
        ) : (
          <>
            <Upload aria-hidden="true" className="size-4" />
            Glisse un fichier ici ou clique pour parcourir ({MAX_MB} MB max)
          </>
        )}
      </button>

      {documents.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-2.5 py-1.5"
            >
              <Icon name={iconFor(doc.mimeType)} className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-xs font-semibold hover:underline"
                title={doc.nom}
              >
                {doc.nom}
              </a>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatFileSize(doc.taille)} · {doc.ajoutePar.name.split(" ")[0]}
              </span>
              <button
                type="button"
                onClick={() => remove(doc)}
                disabled={pending}
                aria-label={`Retirer « ${doc.nom} » du projet`}
                title="Retirer du projet"
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
