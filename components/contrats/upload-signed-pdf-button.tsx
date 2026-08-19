"use client";

/**
 * Bouton "Joindre le PDF signé" sur la fiche contrat.
 *
 * Workflow papier :
 *   1. Sophie a envoyé le PDF au client (par email ou main propre)
 *   2. Le client signe à la main, scanne le doc, renvoie le PDF signé
 *   3. Sophie / Arthur clique ce bouton, sélectionne le PDF reçu,
 *      tape le nom du signataire, et confirme
 *   4. Le PDF est archivé, la signature passe en SIGNEE_CLIENT type=MANUEL,
 *      le deal bascule en SIGNE, le prospect aussi.
 */
import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";

import { uploadSignedContract } from "@/app/(app)/contrats/actions";
import { Icon } from "@/components/icon";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface UploadSignedPdfButtonProps {
  contractId: string;
}

export function UploadSignedPdfButton({ contractId }: UploadSignedPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nomClient, setNomClient] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setNomClient("");
    setFileName(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const ACCEPTED = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Le fichier doit être un PDF ou une image (scan/photo).");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 20 MB).");
      return;
    }
    // On garde le File tel quel : il sera envoyé DIRECTEMENT à Vercel Blob au
    // moment de valider (pas de base64 à travers le Server Action → pas de
    // limite ~4.5 MB, un scan de 8+ pages passe sans souci).
    setFile(f);
    setFileName(f.name);
  };

  const handleSubmit = () => {
    if (!file) {
      toast.error("Sélectionne d'abord le PDF signé.");
      return;
    }
    if (nomClient.trim().length < 2) {
      toast.error("Saisis le nom du signataire (audit légal).");
      return;
    }
    startTransition(async () => {
      // 1. Upload direct navigateur → Vercel Blob (via /api/blob/upload).
      let fileUrl: string;
      try {
        const blob = await upload(
          `signed-contracts/${contractId}/${file.name}`,
          file,
          {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            contentType: file.type,
          },
        );
        fileUrl = blob.url;
      } catch {
        toast.error("Échec de l'envoi du fichier. Réessaie.");
        return;
      }
      // 2. Le Server Action enregistre l'URL + marque le contrat signé.
      const res = await uploadSignedContract({
        contractId,
        fileUrl,
        fileName: fileName ?? undefined,
        nomClient: nomClient.trim(),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        "Contrat marqué signé manuellement. Tu peux maintenant contre-signer.",
      );
      reset();
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        <Icon name="Upload" className="h-4 w-4" />
        Joindre le contrat signé
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
            <DialogTitle>Contrat signé reçu</DialogTitle>
            <DialogDescription>
              Le client a renvoyé le contrat signé en PDF ? Joins-le ici. Il
              sera archivé et le contrat passera en signé. Tu pourras ensuite
              contre-signer pour valider définitivement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drop / Pick zone */}
            <div>
              <Label htmlFor="pdf" className="text-xs">
                Contrat signé — PDF ou image (scan / photo)
              </Label>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFile(e.dataTransfer.files[0]);
                }}
                className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted/50 transition-colors"
              >
                <Icon
                  name="Upload"
                  className="h-6 w-6 text-muted-foreground"
                />
                {fileName ? (
                  <>
                    <p className="mt-2 text-sm font-medium">{fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Clique pour remplacer
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm">
                      Glisse le fichier ici ou clique pour parcourir
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      PDF ou image (JPG, PNG), max 20 MB
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  id="pdf"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </div>

            {/* Nom du signataire */}
            <div>
              <Label htmlFor="nomClient" className="text-xs">
                Nom complet du signataire (côté client)
              </Label>
              <Input
                id="nomClient"
                value={nomClient}
                onChange={(e) => setNomClient(e.target.value)}
                placeholder="Hans Müller"
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tel qu&apos;il apparaît sur le PDF signé. Sera enregistré
                pour la traçabilité légale.
              </p>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              ⚠ En joignant le PDF signé, tu confirmes qu&apos;il s&apos;agit
              bien d&apos;un document retourné par le client.
            </div>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <button
                  type="button"
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Annuler
                </button>
              }
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !file || nomClient.trim().length < 2}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Icon name="Check" className="h-4 w-4" />
              {pending ? "Enregistrement…" : "Marquer signé"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
