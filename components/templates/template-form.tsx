"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createTemplate,
  updateTemplate,
} from "@/app/(app)/templates-emails/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { EmailTemplate, EmailTemplateType } from "@prisma/client";

const TYPE_OPTIONS: { value: EmailTemplateType; label: string }[] = [
  { value: "COLD_1", label: "Cold mail #1 — premier contact" },
  { value: "COLD_2_RELANCE", label: "Cold mail #2 — relance" },
  { value: "COLD_3_RELANCE", label: "Cold mail #3 — relance" },
  { value: "POST_RDV", label: "Post-RDV" },
  { value: "POST_PROPOSITION", label: "Envoi proposition" },
  { value: "RELANCE_PROPOSITION", label: "Relance proposition" },
  { value: "RELANCE_FACTURE", label: "Relance facture" },
  { value: "RENOUVELLEMENT", label: "Renouvellement" },
  { value: "AUTRE", label: "Autre" },
];

const VARIABLES = [
  "{{prenomContact}}",
  "{{nomContact}}",
  "{{raisonSociale}}",
  "{{ville}}",
  "{{commerciale}}",
];

const SAMPLE = {
  prenomContact: "Hans",
  nomContact: "Müller",
  raisonSociale: "Boulangerie du Léman SA",
  ville: "Ecublens",
  commerciale: "Sophie Salvan",
};

function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
}

interface TemplateFormProps {
  initial?: EmailTemplate;
}

export function TemplateForm({ initial }: TemplateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [type, setType] = useState<EmailTemplateType>(initial?.type ?? "COLD_1");
  const [objet, setObjet] = useState(initial?.objet ?? "");
  const [contenu, setContenu] = useState(initial?.contenu ?? "");

  const apercu = useMemo(
    () => ({
      objet: applyVars(objet, SAMPLE),
      contenu: applyVars(contenu, SAMPLE),
    }),
    [objet, contenu],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nom.trim().length < 2) {
      toast.error("Nom requis.");
      return;
    }
    startTransition(async () => {
      const payload = {
        nom: nom.trim(),
        type,
        objet: objet.trim(),
        contenu: contenu.trim(),
        isActive: initial?.isActive ?? true,
      };
      const res = initial
        ? await updateTemplate(initial.id, payload)
        : await createTemplate(payload);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(initial ? "Template mis à jour." : "Template créé.");
      router.push("/templates-emails");
      router.refresh();
    });
  };

  const insertVar = (v: string, target: "objet" | "contenu") => {
    if (target === "objet") setObjet(objet + v);
    else setContenu(contenu + v);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
      {/* Édition */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nom">
                Nom interne <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Cold 1 — Resto/Hôtel printemps 2026"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as EmailTemplateType)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Contenu</CardTitle>
            <div className="flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v, "contenu")}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono hover:bg-primary/10"
                >
                  {v}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="objet">
                Objet <span className="text-red-500">*</span>
              </Label>
              <Input
                id="objet"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Bonjour {{prenomContact}}, idée pour {{raisonSociale}}"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contenu">
                Corps de l&apos;email <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="contenu"
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                rows={14}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={`Bonjour {{prenomContact}},\n\n…`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aperçu */}
      <div>
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle className="text-base">
              Aperçu — variables remplies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Objet
              </p>
              <p className="text-sm font-medium">{apercu.objet || "—"}</p>

              <p className="mt-4 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Corps
              </p>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                {apercu.contenu || "—"}
              </pre>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Aperçu avec un prospect fictif — Hans Müller chez Boulangerie du
              Léman SA à Ecublens, signée par Sophie Salvan.
            </p>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Enregistrement…"
              : initial
                ? "Enregistrer"
                : "Créer le template"}
          </Button>
        </div>
      </div>
    </form>
  );
}
