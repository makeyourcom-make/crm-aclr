"use client";

/**
 * Formulaire de template email (création / modification), charte Make Your Com.
 *
 * - Identité (nom interne, type), statut actif (proposé à l'envoi ou non)
 * - Contenu (objet + corps) avec insertion de variables
 * - Aperçu « mail » avec un prospect fictif, variables remplies
 * - En modification : suppression (bloquée si le template a déjà servi,
 *   on le désactive alors plutôt)
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, FileText, Save, Trash2, Wand2 } from "lucide-react";

import {
  createTemplate,
  deleteTemplate,
  updateTemplate,
} from "@/app/(app)/templates-emails/actions";
import { SectionCard } from "@/components/arena/section-card";
import { FIELD_CLASS, uiText } from "@/components/emails/mail-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { EmailTemplate, EmailTemplateType } from "@prisma/client";

const TYPE_OPTIONS: { value: EmailTemplateType; label: string }[] = [
  { value: "COLD_1", label: "Cold mail #1 - premier contact" },
  { value: "COLD_2_RELANCE", label: "Cold mail #2 - relance" },
  { value: "COLD_3_RELANCE", label: "Cold mail #3 - relance" },
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

const SAMPLE_BASE = {
  prenomContact: "Hans",
  nomContact: "Müller",
  raisonSociale: "Boulangerie du Léman SA",
  ville: "Ecublens",
};

function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
}

interface TemplateFormProps {
  initial?: EmailTemplate;
  /** Nom de la commerciale utilisé dans l'aperçu (défaut : utilisateur connecté). */
  sampleCommerciale?: string;
  /** Nombre de mails déjà envoyés avec ce template (modification). */
  usageCount?: number;
}

export function TemplateForm({
  initial,
  sampleCommerciale = "Lucille Bouin",
  usageCount = 0,
}: TemplateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [type, setType] = useState<EmailTemplateType>(initial?.type ?? "COLD_1");
  const [objet, setObjet] = useState(initial?.objet ?? "");
  const [contenu, setContenu] = useState(initial?.contenu ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [target, setTarget] = useState<"objet" | "contenu">("contenu");

  const sample = useMemo(
    () => ({ ...SAMPLE_BASE, commerciale: sampleCommerciale }),
    [sampleCommerciale],
  );

  const apercu = useMemo(
    () => ({
      objet: applyVars(objet, sample),
      contenu: applyVars(contenu, sample),
    }),
    [objet, contenu, sample],
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
        isActive,
      };
      const res = initial
        ? await updateTemplate(initial.id, payload)
        : await createTemplate(payload);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec."));
        return;
      }
      toast.success(initial ? "Template mis à jour." : "Template créé.");
      router.push("/templates-emails");
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!initial) return;
    if (!confirm(`Supprimer le template « ${initial.nom} » ? Action irréversible.`)) return;
    startTransition(async () => {
      const res = await deleteTemplate(initial.id);
      if (!res.ok) {
        toast.error(uiText(res.error, "Échec de la suppression."));
        return;
      }
      toast.success("Template supprimé.");
      router.push("/templates-emails");
      router.refresh();
    });
  };

  const insertVar = (v: string) => {
    if (target === "objet") setObjet(objet + v);
    else setContenu(contenu + v);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-2">
      {/* Édition */}
      <div className="flex min-w-0 flex-col gap-5">
        <SectionCard title="Identité" icon={FileText} tone="teal">
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nom" className="text-xs font-bold text-muted-foreground">
                Nom interne{" "}
                <span className="text-alert-700" aria-hidden="true">
                  *
                </span>
              </Label>
              <input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Cold 1 - Resto/Hôtel printemps 2026"
                required
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs font-bold text-muted-foreground">
                Type
              </Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as EmailTemplateType)}
                className={cn(FIELD_CLASS, "font-semibold")}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-ground px-3.5 py-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-navy-700"
              />
              <span className="flex flex-col">
                <span className="text-sm font-bold text-foreground">Template actif</span>
                <span className="text-xs text-muted-foreground">
                  Proposé dans la liste des modèles à l&apos;envoi d&apos;un mail depuis la
                  fiche d&apos;une entreprise.
                </span>
              </span>
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Contenu"
          icon={Wand2}
          tone="violet"
          description="Clique une variable pour l'insérer à la fin du champ choisi."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <div
                role="group"
                aria-label="Champ où insérer la variable"
                className="mr-1 flex gap-0.5 rounded-[10px] bg-navy-50 p-[3px]"
              >
                {(["objet", "contenu"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTarget(k)}
                    aria-pressed={target === k}
                    className={cn(
                      "h-7 rounded-[8px] px-2.5 text-xs font-bold text-foreground",
                      target === k ? "bg-card shadow-[0_1px_3px_rgba(14,25,54,0.14)]" : "hover:bg-navy-100",
                    )}
                  >
                    {k === "objet" ? "Objet" : "Corps"}
                  </button>
                ))}
              </div>
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  aria-label={`Insérer ${v} dans ${target === "objet" ? "l'objet" : "le corps"}`}
                  className="h-7 rounded-[8px] border border-border bg-card px-2 font-mono text-[11px] font-bold text-lvl-700 transition-colors hover:border-lvl-500 hover:bg-lvl-50"
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="objet" className="text-xs font-bold text-muted-foreground">
                Objet{" "}
                <span className="text-alert-700" aria-hidden="true">
                  *
                </span>
              </Label>
              <input
                id="objet"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                onFocus={() => setTarget("objet")}
                placeholder="Bonjour {{prenomContact}}, idée pour {{raisonSociale}}"
                required
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-contenu" className="text-xs font-bold text-muted-foreground">
                Corps de l&apos;email{" "}
                <span className="text-alert-700" aria-hidden="true">
                  *
                </span>
              </Label>
              <textarea
                id="template-contenu"
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                onFocus={() => setTarget("contenu")}
                rows={14}
                className="w-full rounded-[14px] border border-border-strong bg-card px-4 py-3 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25"
                placeholder={`Bonjour {{prenomContact}},\n\n…`}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Aperçu */}
      <div className="flex min-w-0 flex-col gap-4">
        <SectionCard
          title="Aperçu · variables remplies"
          icon={Eye}
          tone="teal"
          className="lg:sticky lg:top-20"
        >
          <div className="overflow-hidden rounded-[14px] border border-border">
            <div className="flex flex-col gap-1 border-b border-border bg-ground px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold">À :</span> {sample.prenomContact} {sample.nomContact} ·{" "}
                {sample.raisonSociale}
              </p>
              <p className="text-sm font-extrabold break-words text-foreground">
                {apercu.objet || "Objet vide"}
              </p>
            </div>
            <pre className="min-h-[160px] px-4 py-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {apercu.contenu || "Corps vide : écris ton message à gauche."}
            </pre>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Aperçu avec un prospect fictif : {sample.prenomContact} {sample.nomContact} chez{" "}
            {sample.raisonSociale} à {sample.ville}, signé par {sample.commerciale}.
          </p>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            <Save aria-hidden="true" />
            {pending
              ? "Enregistrement…"
              : initial
                ? "Enregistrer"
                : "Créer le template"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            disabled={pending}
          >
            Annuler
          </Button>
          {initial && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleDelete}
              disabled={pending || usageCount > 0}
              title={
                usageCount > 0
                  ? "Déjà utilisé pour des envois : désactive-le plutôt."
                  : "Supprimer le template"
              }
              className="ml-auto text-alert-700 hover:bg-alert-50 hover:text-alert-700"
            >
              <Trash2 aria-hidden="true" />
              Supprimer
            </Button>
          )}
        </div>
        {initial && usageCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Ce template a déjà servi à {usageCount} envoi{usageCount > 1 ? "s" : ""} : il ne
            peut pas être supprimé, décoche « Template actif » pour le retirer des modèles.
          </p>
        )}
      </div>
    </form>
  );
}
