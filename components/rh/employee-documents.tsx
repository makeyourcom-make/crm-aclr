"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteEmployeeDocument,
  uploadEmployeeDocument,
} from "@/app/(app)/rh/actions";
import { SectionCard } from "@/components/arena/section-card";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateCH } from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

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
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();

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
    <SectionCard
      title={`Documents (${documents.length})`}
      icon={FileText}
      tone="navy"
      contentClassName="flex flex-col gap-4"
    >
      {documents.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Aucun document pour ce collaborateur.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-border px-3 py-2.5"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0 text-subtle" />
              <div className="min-w-0 flex-[1_1_140px]">
                <p className="truncate text-[13px] font-bold text-foreground">{d.titre}</p>
                <p className="text-xs text-muted-foreground">
                  {DOC_TYPES.find((t) => t.value === d.type)?.label ?? d.type}
                  {" · "}
                  {formatDateCH(d.createdAt)}
                  {d.fileSize ? ` · ${Math.round(d.fileSize / 1024)} KB` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <DocumentPreviewButton
                  url={d.fileUrl}
                  filename={d.titre}
                  label="Voir"
                  icon="Eye"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={pending}
                  aria-label={`Supprimer le document ${d.titre}`}
                  className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-alert-500/30 bg-alert-50 px-2.5 text-xs font-bold text-alert-700 hover:bg-alert-50/70 disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Upload */}
      <div className="flex flex-col gap-3 rounded-[14px] border border-dashed border-border-strong p-4">
        <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Ajouter un document
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-type`} className="text-[13px]">Type</Label>
            <select
              id={`${uid}-type`}
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-input bg-card px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${uid}-titre`} className="text-[13px]">Titre</Label>
            <Input
              id={`${uid}-titre`}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Contrat de travail signé 2026"
              className="h-11 rounded-[12px] border-border bg-card px-3 text-[15px] md:text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed px-4 py-5 text-center transition-colors",
            dragOver ? "border-info-500 bg-info-50" : "border-border bg-ground hover:bg-navy-50",
          )}
        >
          <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
          {fileName ? (
            <span className="mt-2 text-sm font-bold text-foreground">{fileName}</span>
          ) : (
            <>
              <span className="mt-2 text-sm font-semibold text-foreground">
                Glisse le fichier ici ou clique pour parcourir
              </span>
              <span className="text-xs text-muted-foreground">PDF, image, max 6 MB</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <Button
          type="button"
          size="lg"
          onClick={handleUpload}
          disabled={pending || !fileDataUrl}
          className="self-start"
        >
          <Upload aria-hidden="true" />
          {pending ? "Ajout…" : "Ajouter"}
        </Button>
      </div>
    </SectionCard>
  );
}
