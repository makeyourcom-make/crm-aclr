"use client";

/**
 * Bouton « Ajouter un document » (réservé à l'admin).
 *
 * Le fichier est envoyé DIRECTEMENT au Vercel Blob (via /api/blob/upload),
 * pour ne pas buter sur la limite ~4.5 MB des Server Actions. Seule l'URL
 * repart ensuite vers le Server Action `createDocument`.
 */
import { upload } from "@vercel/blob/client";
import { FileCheck2, Loader2, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createDocument } from "@/app/(app)/documents/actions";
import {
  FIELD_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/components/common/form-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Categorie = "FORMATION" | "VENTE" | "SUIVI";

const CAT_LABEL: Record<Categorie, string> = {
  FORMATION: "Formation",
  VENTE: "Vente",
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
  const [dragOver, setDragOver] = useState(false);
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
          triggerClassName ?? buttonVariants({ variant: "default", size: "lg" })
        }
      >
        <Plus aria-hidden="true" className="size-4" />
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

          <div className="space-y-4 py-1">
            <div>
              <span className={LABEL_CLASS}>
                Fichier (PDF, Word, Excel, PowerPoint, image, vidéo · max 50 MB)
              </span>
              <label
                htmlFor="doc-file"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[14px] border-2 border-dashed px-3.5 py-4 text-sm transition-colors focus-within:border-navy-700 focus-within:ring-4 focus-within:ring-navy-100",
                  dragOver
                    ? "border-info-500 bg-info-50"
                    : file
                      ? "border-win-500/50 bg-win-50"
                      : "border-border-strong bg-ground hover:bg-navy-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card shadow-arena",
                    file ? "text-win-700" : "text-info-700",
                  )}
                >
                  {file ? <FileCheck2 className="size-4" /> : <Upload className="size-4" />}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate font-semibold",
                    file ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {file ? file.name : "Clique ou dépose un fichier ici"}
                </span>
                <input
                  ref={inputRef}
                  id="doc-file"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.mov,image/*"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
            </div>

            <div>
              <label htmlFor="doc-titre" className={LABEL_CLASS}>
                Titre
              </label>
              <Input
                id="doc-titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Script d'appel - prise de RDV"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label htmlFor="doc-cat" className={LABEL_CLASS}>
                Rubrique
              </label>
              <select
                id="doc-cat"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value as Categorie)}
                className={SELECT_CLASS}
              >
                {(Object.keys(CAT_LABEL) as Categorie[]).map((c) => (
                  <option key={c} value={c}>
                    {CAT_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="doc-desc" className={LABEL_CLASS}>
                Description (optionnel)
              </label>
              <textarea
                id="doc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="À quoi sert ce document ?"
                className={TEXTAREA_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" size="lg" onClick={submit} disabled={pending}>
              {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
              {pending ? "Envoi…" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
