"use client";

/**
 * Bouton « Ajouter un document » (réservé à l'admin).
 *
 * Le fichier est envoyé DIRECTEMENT au Vercel Blob (via /api/blob/upload),
 * pour ne pas buter sur la limite ~4.5 MB des Server Actions. Seule l'URL
 * repart ensuite vers le Server Action `createDocument`.
 */
import { upload } from "@vercel/blob/client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createDocument } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type Categorie = "FORMATION" | "SUIVI";

const CAT_LABEL: Record<Categorie, string> = {
  FORMATION: "Formation",
  SUIVI: "Suivi",
};

const MAX = 50 * 1024 * 1024; // 50 MB

interface Props {
  defaultCategorie?: Categorie;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function DocumentUploadButton({
  defaultCategorie = "FORMATION",
  triggerLabel = "Ajouter un document",
  triggerClassName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<Categorie>(defaultCategorie);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitre("");
    setDescription("");
    setCategorie(defaultCategorie);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX) {
      toast.error("Fichier trop volumineux (max 50 MB).");
      return;
    }
    setFile(f);
    if (!titre.trim()) setTitre(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = () => {
    if (!file) {
      toast.error("Sélectionne d'abord un fichier.");
      return;
    }
    if (titre.trim().length < 2) {
      toast.error("Donne un titre au document.");
      return;
    }
    startTransition(async () => {
      let fileUrl: string;
      try {
        const blob = await upload(
          `documents/${categorie.toLowerCase()}/${file.name}`,
          file,
          {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            contentType: file.type || undefined,
          },
        );
        fileUrl = blob.url;
      } catch {
        toast.error("Échec de l'envoi du fichier. Réessaie.");
        return;
      }
      const res = await createDocument({
        titre: titre.trim(),
        description: description.trim() || null,
        categorie,
        fileUrl,
        fileName: file.name,
        fileType: file.type || null,
        fileSize: file.size,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success("Document ajouté.");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        }
      >
        <Icon name="Plus" className="h-4 w-4" />
        {triggerLabel}
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) reset();
          setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
            <DialogDescription>
              Formation, vente ou suivi. Visible par toute l&apos;équipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="doc-file" className="text-xs">
                Fichier (PDF, Word, Excel, PowerPoint, image, vidéo - max 50 MB)
              </Label>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  pickFile(e.dataTransfer.files[0]);
                }}
                className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground hover:bg-muted"
              >
                <Icon name="Upload" className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {file ? file.name : "Clique ou dépose un fichier ici"}
                </span>
              </div>
              <input
                ref={inputRef}
                id="doc-file"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.mov,image/*"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>

            <div>
              <Label htmlFor="doc-titre" className="text-xs">
                Titre
              </Label>
              <Input
                id="doc-titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Script d'appel - prise de RDV"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="doc-cat" className="text-xs">
                Rubrique
              </Label>
              <select
                id="doc-cat"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value as Categorie)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {(Object.keys(CAT_LABEL) as Categorie[]).map((c) => (
                  <option key={c} value={c}>
                    {CAT_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="doc-desc" className="text-xs">
                Description (optionnel)
              </Label>
              <textarea
                id="doc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="À quoi sert ce document ?"
                className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Envoi…" : "Ajouter"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
