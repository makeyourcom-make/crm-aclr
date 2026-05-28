"use client";

/**
 * Wizard d'import CSV de prospects.
 *
 * 3 étapes :
 *   1. Upload du fichier CSV
 *   2. Mapping des colonnes (auto-détection + override manuel) + aperçu
 *   3. Résultat de l'import (X importés, Y erreurs)
 */
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { guessFieldFromHeader } from "@/lib/schemas/prospect";
import { cn } from "@/lib/utils";

import { importProspects } from "@/app/(app)/prospects/actions";

// ---------------------------------------------------------------------------
// Configuration des champs cibles disponibles dans le mapping
// ---------------------------------------------------------------------------

const TARGET_FIELDS: { value: string; label: string; required?: boolean }[] = [
  { value: "raisonSociale", label: "Raison sociale", required: true },
  { value: "contactPrenom", label: "Prénom contact" },
  { value: "contactNom", label: "Nom contact" },
  { value: "contactFonction", label: "Fonction" },
  { value: "email", label: "Email" },
  { value: "telephone", label: "Téléphone fixe" },
  { value: "telephoneMobile", label: "Téléphone mobile" },
  { value: "adresse", label: "Adresse" },
  { value: "codePostal", label: "Code postal" },
  { value: "ville", label: "Ville" },
  { value: "canton", label: "Canton" },
  { value: "pays", label: "Pays" },
  { value: "siteWeb", label: "Site web" },
  { value: "linkedIn", label: "LinkedIn" },
  { value: "secteur", label: "Secteur (texte libre)" },
  { value: "effectif", label: "Effectif" },
  { value: "noga", label: "Code NOGA" },
  { value: "notesGenerales", label: "Notes" },
  { value: "__ignore", label: "— Ignorer cette colonne —" },
];

type Step = "upload" | "mapping" | "importing" | "done";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ ligne: number; raisonSociale?: string; message: string }>;
}

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function ProspectImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  // ---- ÉTAPE 1 : Upload ----
  const handleFile = (file: File) => {
    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      toast.error("Format non supporté : utilise un fichier .csv ou .tsv.");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        if (res.errors.length > 0 && res.data.length === 0) {
          toast.error(`Erreur de parsing : ${res.errors[0].message}`);
          return;
        }
        if (res.data.length === 0) {
          toast.error("Le fichier semble vide.");
          return;
        }
        const headers = res.meta.fields ?? Object.keys(res.data[0]);
        setCsv({ headers, rows: res.data });

        // Auto-mapping initial
        const initialMapping: Record<string, string> = {};
        for (const h of headers) {
          const guess = guessFieldFromHeader(h);
          initialMapping[h] = guess ?? "__ignore";
        }
        setMapping(initialMapping);

        setStep("mapping");
      },
      error: (err) => {
        toast.error(`Erreur de lecture : ${err.message}`);
      },
    });
  };

  // ---- ÉTAPE 2 : Mapping → Import ----
  const handleImport = async () => {
    if (!csv) return;

    // Vérifie qu'on a bien raisonSociale mappée
    const mappedFields = Object.values(mapping).filter((v) => v !== "__ignore");
    if (!mappedFields.includes("raisonSociale")) {
      toast.error(
        "La colonne 'Raison sociale' est obligatoire — mappe-la d'abord.",
      );
      return;
    }

    setStep("importing");

    // Transforme les lignes selon le mapping
    const transformedRows = csv.rows.map((row) => {
      const out: Record<string, string> = {};
      for (const [csvHeader, targetField] of Object.entries(mapping)) {
        if (targetField === "__ignore") continue;
        const value = row[csvHeader]?.toString().trim();
        if (value) out[targetField] = value;
      }
      return out;
    });

    try {
      const res = await importProspects(transformedRows);
      setResult({
        imported: res.imported,
        skipped: res.skipped,
        errors: res.errors,
      });
      setStep("done");
      if (res.imported > 0) {
        toast.success(`${res.imported} prospect(s) importé(s).`);
      }
      if (!res.ok) {
        toast.error(
          "Import annulé : trop d'erreurs (>50%). Vérifie le mapping.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur serveur lors de l'import.");
      setStep("mapping");
    }
  };

  // ---- ÉTAPE 3 : Téléchargement du rapport d'erreurs ----
  const downloadErrorsCsv = () => {
    if (!result?.errors.length) return;
    const csvContent = [
      "Ligne;Raison sociale;Erreur",
      ...result.errors.map(
        (e) =>
          `${e.ligne};"${(e.raisonSociale ?? "").replace(/"/g, '""')}";"${e.message.replace(
            /"/g,
            '""',
          )}"`,
      ),
    ].join("\n");
    const blob = new Blob(["﻿" + csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erreurs_import_prospects.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  if (step === "upload") {
    return <UploadStep onFile={handleFile} />;
  }

  if (step === "mapping" && csv) {
    return (
      <MappingStep
        csv={csv}
        mapping={mapping}
        onChange={setMapping}
        onImport={handleImport}
        onReset={() => {
          setCsv(null);
          setStep("upload");
        }}
      />
    );
  }

  if (step === "importing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">
            Import en cours, ne ferme pas la page…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === "done" && result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import terminé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-2xl font-semibold text-emerald-700">
                {result.imported}
              </p>
              <p className="text-xs text-emerald-700">prospect(s) importé(s)</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-2xl font-semibold text-amber-700">
                {result.skipped}
              </p>
              <p className="text-xs text-amber-700">ligne(s) en erreur</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <>
              <details className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">
                  Voir le détail des {result.errors.length} erreur(s)
                </summary>
                <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-xs">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i} className="border-b pb-1 last:border-0">
                      <span className="font-medium">Ligne {e.ligne}</span>
                      {e.raisonSociale && ` (${e.raisonSociale})`} :{" "}
                      {e.message}
                    </li>
                  ))}
                  {result.errors.length > 50 && (
                    <li className="italic text-muted-foreground">
                      … et {result.errors.length - 50} autre(s) (voir CSV
                      téléchargeable)
                    </li>
                  )}
                </ul>
              </details>

              <Button onClick={downloadErrorsCsv} variant="outline">
                <Icon name="FileSpreadsheet" className="mr-1.5 h-4 w-4" />
                Télécharger le CSV des erreurs
              </Button>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCsv(null);
                setResult(null);
                setStep("upload");
              }}
            >
              Importer un autre fichier
            </Button>
            <a
              href="/prospects"
              className={buttonVariants({ variant: "default" })}
              onClick={() => router.refresh()}
            >
              Voir les prospects
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function UploadStep({ onFile }: { onFile: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card>
      <CardContent
        className={cn(
          "flex flex-col items-center gap-4 py-12 transition-colors",
          dragOver && "bg-primary/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <Icon
          name="FileSpreadsheet"
          className="h-10 w-10 text-muted-foreground"
        />
        <div className="text-center">
          <p className="text-base font-medium">
            Glisser-déposer ton fichier CSV ici
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ou cliquer ci-dessous pour parcourir. Formats acceptés : .csv, .tsv
          </p>
        </div>
        <label className={buttonVariants({ variant: "default" })}>
          Choisir un fichier
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
        <div className="mt-4 max-w-md text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Format attendu :</p>
          <p className="mt-1">
            Première ligne = en-têtes de colonnes. La colonne{" "}
            <code className="rounded bg-muted px-1">Raison sociale</code> est
            obligatoire. Les autres colonnes (email, téléphone, ville, etc.)
            sont reconnues automatiquement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MappingStep({
  csv,
  mapping,
  onChange,
  onImport,
  onReset,
}: {
  csv: ParsedCsv;
  mapping: Record<string, string>;
  onChange: (m: Record<string, string>) => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const previewRows = csv.rows.slice(0, 5);
  const mappedCount = Object.values(mapping).filter(
    (v) => v !== "__ignore",
  ).length;
  const hasRaisonSociale = Object.values(mapping).includes("raisonSociale");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapping des colonnes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {csv.rows.length} ligne(s) détectée(s) — {mappedCount} colonne(s)
              mappée(s)
            </p>
          </div>
          <Button variant="outline" onClick={onReset}>
            Changer de fichier
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Colonne CSV
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Champ Make Your Com
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Aperçu (1ʳᵉ ligne)
                  </th>
                </tr>
              </thead>
              <tbody>
                {csv.headers.map((header) => (
                  <tr key={header} className="border-b last:border-0">
                    <td className="px-2 py-2 font-medium">{header}</td>
                    <td className="px-2 py-2">
                      <select
                        value={mapping[header] ?? "__ignore"}
                        onChange={(e) =>
                          onChange({ ...mapping, [header]: e.target.value })
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {TARGET_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {previewRows[0]?.[header] || (
                        <span className="italic">vide</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Aperçu des 5 premières lignes après mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aperçu des 5 premières lignes
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left">#</th>
                <th className="px-2 py-1.5 text-left">Raison sociale</th>
                <th className="px-2 py-1.5 text-left">Contact</th>
                <th className="px-2 py-1.5 text-left">Email</th>
                <th className="px-2 py-1.5 text-left">Ville</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => {
                const get = (field: string): string => {
                  const csvCol = Object.entries(mapping).find(
                    ([, target]) => target === field,
                  )?.[0];
                  return csvCol ? row[csvCol] ?? "" : "";
                };
                return (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-1.5 font-medium">
                      {get("raisonSociale") || (
                        <span className="text-red-600 italic">
                          (manquante)
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {[get("contactPrenom"), get("contactNom")]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="px-2 py-1.5">{get("email") || "—"}</td>
                    <td className="px-2 py-1.5">{get("ville") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {!hasRaisonSociale && (
          <p className="text-sm text-red-600">
            ⚠ Mappe la colonne « Raison sociale » avant d&apos;importer.
          </p>
        )}
        <Button onClick={onImport} disabled={!hasRaisonSociale}>
          Importer {csv.rows.length} prospect(s)
        </Button>
      </div>
    </div>
  );
}
