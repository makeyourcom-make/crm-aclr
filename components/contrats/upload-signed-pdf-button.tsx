"use client";

/**
 * Bouton "Joindre le PDF signé" sur la fiche contrat.
 *
 * Workflow papier :
 *   1. Sophie a envoyé le PDF au client (par email ou main propre)
 *   2. Le client signe à la main, scanne le doc, renvoie le PDF signé
 *   3. Sophie / Arthur clique ce bouton, sélectionne le PDF reçu,
 *      tape le nom du signataire, et confirme
 *   4. Le PDF est archivé, la signature est COMPLÉTÉE (client + contre-signature
 *      ACLR fusionnées en un geste), le deal + prospect basculent en SIGNE, et le
 *      contrat part directement en validation admin (ATTENTE_VALIDATION_ADMIN).
 */
import { Check, LoaderCircle, ShieldAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";

import { uploadSignedContract } from "@/app/(app)/contrats/actions";
import { Button } from "@/components/ui/button";
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
  /** Appelé après un enregistrement réussi (ex. confettis + refresh). */
  onSuccess?: () => void;
  /** Libellé du bouton déclencheur (défaut : « Joindre le contrat signé »). */
  triggerLabel?: string;
  /** Taille du déclencheur (défaut 36 px). */
  size?: "default" | "lg";
  className?: string;
}

export function UploadSignedPdfButton({
  contractId,
  onSuccess,
  triggerLabel = "Joindre le contrat signé",
  size = "default",
  className,
}: UploadSignedPdfButtonProps) {
  const router = useRouter();
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
        "Contrat signé enregistré et contre-signé. Envoyé pour validation admin.",
      );
      reset();
      setOpen(false);
      router.refresh();
      onSuccess?.();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Upload aria-hidden="true" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) reset();
          setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold">
              Contrat signé reçu
            </DialogTitle>
            <DialogDescription>
              Le client a renvoyé le contrat signé ? Joins-le ici. En un geste,
              il est archivé, contre-signé de ta part, et envoyé à l&apos;admin
              pour la validation finale. Pas d&apos;étape supplémentaire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drop / Pick zone */}
            <div>
              <Label htmlFor={`pdf-${contractId}`} className="text-xs">
                Contrat signé : PDF ou image (scan / photo)
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
                className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[16px] border-2 border-dashed border-border-strong bg-ground px-4 py-6 text-center transition-colors hover:bg-navy-50"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-[14px] bg-navy-100 text-navy-700"
                >
                  <Upload className="size-5" />
                </span>
                {fileName ? (
                  <>
                    <p className="mt-2 text-sm font-bold">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      Clique pour remplacer
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-bold">
                      Glisse le fichier ici ou clique pour parcourir
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF ou image (JPG, PNG), max 20 MB
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  id={`pdf-${contractId}`}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </div>

            {/* Nom du signataire */}
            <div>
              <Label htmlFor={`nomClient-${contractId}`} className="text-xs">
                Nom complet du signataire (côté client)
              </Label>
              <Input
                id={`nomClient-${contractId}`}
                value={nomClient}
                onChange={(e) => setNomClient(e.target.value)}
                placeholder="Hans Müller"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tel qu&apos;il apparaît sur le PDF signé. Sera enregistré
                pour la traçabilité légale.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-[14px] border border-gold-500/50 bg-gold-50 p-3 text-xs font-semibold text-gold-700">
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                En joignant le PDF signé, tu confirmes qu&apos;il s&apos;agit
                bien d&apos;un document retourné par le client.
              </span>
            </div>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" size="lg" disabled={pending}>
                  Annuler
                </Button>
              }
            />
            <Button
              type="button"
              size="lg"
              onClick={handleSubmit}
              disabled={pending || !file || nomClient.trim().length < 2}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {pending ? "Enregistrement..." : "Enregistrer et contre-signer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
