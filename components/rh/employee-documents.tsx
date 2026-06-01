"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteEmployeeDocument,
  uploadEmployeeDocument,
} from "@/app/(app)/rh/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/icon";
import { formatDate } from "@/lib/format";

interface DocItem {
  id: string;
  type: string;
  titre: string;
  fileUrl: string;
  fileSize: number | null;
  createdAt: Date;
}

interface EmployeeDocumentsProps {
  userId: string;
  documents: DocItem[];
}

const DOC_TYPES = [
  { value: "CONTRAT_TRAVAIL", label: "Contrat de travail" },
  { value: "AVENANT", label: "Avenant" },
  { value: "FICHE_SALAIRE", label: "Fiche de salaire" },
  { value: "CERTIFICAT_TRAVAIL", label: "Certificat de travail" },
  { value: "DIPLOME", label: "Diplôme" },
  { value: "PIECE_IDENTITE", label: "Pièce d'identité" },
  { value: "AUTRE", label: "Autre" },
];

export function EmployeeDocuments({
  userId,
  documents,
}: EmployeeDocumentsProps) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState("CONTRAT_TRAVAIL");
  const [titre, setTitre] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 6 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
      setFileName(f.name);
      if (!titre) setTitre(f.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(f);
  };

  const handleUpload = () => {
    if (!fileDataUrl || !fileName) {
      toast.error("Choisis un fichier.");
      return;
    }
    if (!titre.trim()) {
      toast.error("Donne un titre au document.");
      return;
    }
    startTransition(async () => {
      const res = await uploadEmployeeDocument({
        userId,
        type,
        titre: titre.trim(),
        fileDataUrl,
        fileName,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Document ajouté.");
      setFileDataUrl(null);
      setFileName(null);
      setTitre("");
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    startTransition(async () => {
      const res = await deleteEmployeeDocument(id);
      if (!res.ok) toast.error(res.error ?? "Échec.");
      else toast.success("Document supprimé.");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Documents ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Liste existante */}
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun document pour ce collaborateur.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 px-3 py-2"
              >
                <Icon name="FileText" className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.titre}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {DOC_TYPES.find((t) => t.value === d.type)?.label ??
                      d.type}{" "}
                    · {formatDate(d.createdAt)}
                    {d.fileSize && (
                      <>
                        {" · "}
                        {Math.round(d.fileSize / 1024)} KB
                      </>
                    )}
                  </p>
                </div>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted"
                >
                  Ouvrir
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={pending}
                  className="inline-flex h-7 items-center rounded-md border border-red-200 bg-red-50 px-2 text-[11px] text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Upload */}
        <div className="rounded-md border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ajouter un document
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Titre</Label>
              <Input
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Contrat de travail signé 2026"
                className="mt-1"
              />
            </div>
          </div>

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
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center hover:bg-muted/50"
          >
            <Icon name="Upload" className="h-5 w-5 text-muted-foreground" />
            {fileName ? (
              <p className="mt-2 text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <p className="mt-2 text-sm">
                  Glisse le fichier ici ou clique pour parcourir
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PDF, image, max 6 MB
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={pending || !fileDataUrl}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Icon name="Upload" className="h-4 w-4" />
            {pending ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
