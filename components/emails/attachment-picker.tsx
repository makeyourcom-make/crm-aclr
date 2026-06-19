"use client";

/**
 * Sélecteur de pièces jointes pour les formulaires email.
 *
 * - Bouton "Joindre un fichier" + drop zone
 * - Upload vers Vercel Blob via uploadEmailAttachment()
 * - État local de la liste pour affichage / retrait
 * - Notifie le parent via onChange à chaque mise à jour
 */
import { upload } from "@vercel/blob/client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadEmailAttachment } from "@/app/(app)/emails/attachments-actions";
import { Icon } from "@/components/icon";

export interface PickedAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface AttachmentPickerProps {
  value: PickedAttachment[];
  onChange: (next: PickedAttachment[]) => void;
  /** Limite globale en MB (Resend max 40MB) */
  maxTotalMb?: number;
  disabled?: boolean;
}

export function AttachmentPicker({
  value,
  onChange,
  maxTotalMb = 25,
  disabled = false,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const totalBytes = value.reduce((s, a) => s + a.size, 0);
  const maxBytes = maxTotalMb * 1024 * 1024;
  const remaining = maxBytes - totalBytes;

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    let cumulative = 0;
    for (const f of list) {
      cumulative += f.size;
      if (cumulative > remaining) {
        toast.error(
          `Limite ${maxTotalMb} MB dépassée — retire des fichiers ou réduis-les.`,
        );
        return;
      }
    }

    startTransition(async () => {
      const added: PickedAttachment[] = [];
      for (const file of list) {
        // 1) Voie principale (prod) : upload DIRECT navigateur → Vercel Blob.
        //    Contourne la limite 4.5 MB des fonctions serverless (cause des
        //    crashs sur les fichiers volumineux).
        try {
          const blob = await upload(`email-attachments/${file.name}`, file, {
            access: "public",
            handleUploadUrl: "/api/emails/attachments/upload",
            contentType: file.type || undefined,
          });
          added.push({
            url: blob.url,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          });
          continue;
        } catch {
          // 2) Repli (dev local / Blob non configuré) : via server action.
          const formData = new FormData();
          formData.append("file", file);
          const res = await uploadEmailAttachment(formData);
          if (!res.ok || !res.url) {
            toast.error(
              `${file.name}: ${res.error ?? "Stockage des pièces jointes non configuré (Vercel Blob)."}`,
            );
            continue;
          }
          added.push({
            url: res.url,
            filename: res.filename ?? file.name,
            mimeType: res.mimeType ?? file.type,
            size: res.size ?? file.size,
          });
        }
      }
      if (added.length > 0) {
        onChange([...value, ...added]);
        toast.success(`${added.length} fichier(s) joint(s) ✓`);
      }
    });
  };

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/zip,text/*"
        className="hidden"
        disabled={disabled || pending}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          // Reset pour pouvoir re-uploader le même fichier
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !pending) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || pending) return;
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-wrap items-center gap-2 rounded-md border-2 border-dashed p-2 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20"
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || pending}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          <Icon name="Upload" className="h-3 w-3" />
          {pending ? "Upload…" : "Joindre un fichier"}
        </button>
        <span className="text-[10px] text-muted-foreground">
          ou glisse-dépose ici — {Math.round((remaining / 1024 / 1024) * 10) / 10}{" "}
          MB restants
        </span>
      </div>

      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a, idx) => (
            <li
              key={`${a.url}-${idx}`}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <Icon
                name={
                  a.mimeType.startsWith("image/")
                    ? "Image"
                    : a.mimeType === "application/pdf"
                      ? "FileText"
                      : "Download"
                }
                className="h-3 w-3 shrink-0 text-muted-foreground"
              />
              <span className="flex-1 truncate font-medium">{a.filename}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatBytes(a.size)}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                disabled={disabled || pending}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                title="Retirer"
              >
                <Icon name="X" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
