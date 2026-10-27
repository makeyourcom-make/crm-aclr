"use client";

/**
 * Formulaire de création / édition de prospect.
 *
 * Validation : Zod côté client (react-hook-form + zodResolver) ET côté serveur
 * (re-validation dans la Server Action) — défense en profondeur.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CANTONS_SUISSES,
  PROSPECT_SECTEUR_OPTIONS,
  PROSPECT_SOURCE_OPTIONS,
  PROSPECT_STATUT_OPTIONS,
} from "@/lib/labels";
import { ProspectCreateSchema } from "@/lib/schemas/prospect";
import { cn } from "@/lib/utils";

const INPUT = "h-11 rounded-[12px] border-border-strong bg-card";

// Le type INPUT du schéma : c'est ce que l'utilisateur tape, AVANT que les
// defaults Zod (pays="Suisse", statut="NOUVEAU"…) et transforms soient
// appliqués. C'est ce que react-hook-form manipule en mémoire.
type ProspectFormValues = z.input<typeof ProspectCreateSchema>;

interface ProspectFormProps {
  /** Pré-remplit le formulaire pour l'édition. */
  initialValues?: Partial<ProspectFormValues>;
  /** Action serveur appelée à la soumission. */
  action: (input: ProspectFormValues) => Promise<{
    ok: boolean;
    prospectId?: string;
    error?: string;
    fieldErrors?: Record<string, string>;
  }>;
  /** Texte du bouton primaire. */
  submitLabel?: string;
  /** Si fourni, navigue après succès (default : /prospects/{newId}). */
  onSuccess?: (prospectId: string) => void;
  /** Liste des collaborateurs pour le champ "Assignée à" — admin uniquement. */
  teamUsers?: Array<{ id: string; name: string }>;
  /** Si true, affiche le champ "Assignée à". */
  isAdmin?: boolean;
}

export function ProspectForm({
  initialValues,
  action,
  submitLabel = "Créer l'entreprise",
  onSuccess,
  teamUsers = [],
  isAdmin = false,
}: ProspectFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(ProspectCreateSchema),
    defaultValues: {
      pays: "Suisse",
      statut: "NOUVEAU",
      // Toutes les fiches proviennent du CRM par défaut ; requalifiable ensuite.
      source: "CRM",
      ...initialValues,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = form;

  // Email de facturation : par défaut identique à l'email de l'entreprise.
  // On n'écrit rien en base tant que l'admin ne saisit pas une adresse dédiée —
  // le champ vide signifie « utiliser l'email de l'entreprise » (le serveur
  // applique le repli emailFacturation ?? email). On reflète donc l'email
  // général comme placeholder vivant pour que ce comportement soit explicite.
  const emailValue = watch("email");

  const onSubmit = async (data: ProspectFormValues) => {
    setServerError(null);
    const res = await action(data);
    if (!res.ok) {
      setServerError(res.error ?? "Erreur lors de l'enregistrement.");
      if (res.fieldErrors) {
        for (const [field, msg] of Object.entries(res.fieldErrors)) {
          setError(field as keyof ProspectFormValues, { message: msg });
        }
      }
      toast.error(res.error ?? "Échec de l'enregistrement.");
      return;
    }
    toast.success("Entreprise enregistrée.");
    if (res.prospectId && onSuccess) {
      onSuccess(res.prospectId);
    } else if (res.prospectId) {
      router.push(`/prospects/${res.prospectId}`);
    } else {
      router.push("/prospects");
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-extrabold tracking-[-0.01em]">Identité</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Raison sociale"
            required
            error={errors.raisonSociale?.message}
            className="md:col-span-2"
          >
            <Input
              className={INPUT}
              {...register("raisonSociale")}
              placeholder="ex. Boulangerie du Léman SA"
            />
          </Field>

          <Field label="Prénom contact" error={errors.contactPrenom?.message}>
            <Input className={INPUT} {...register("contactPrenom")} placeholder="Hans" />
          </Field>

          <Field label="Nom contact" error={errors.contactNom?.message}>
            <Input className={INPUT} {...register("contactNom")} placeholder="Müller" />
          </Field>

          <Field
            label="Fonction"
            error={errors.contactFonction?.message}
            className="md:col-span-2"
          >
            <Input
              className={INPUT}
              {...register("contactFonction")}
              placeholder="Patron, Directrice marketing, …"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-extrabold tracking-[-0.01em]">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Email" error={errors.email?.message}>
            <Input
              className={INPUT}
              {...register("email")}
              type="email"
              placeholder="contact@entreprise.ch"
            />
          </Field>

          <Field
            label="Email de facturation"
            error={errors.emailFacturation?.message}
            hint="Par défaut, identique à l'email de l'entreprise. Renseigne une adresse dédiée seulement si les factures doivent partir ailleurs (ex. boîte compta/Odoo du client)."
          >
            <Input
              className={INPUT}
              {...register("emailFacturation")}
              type="email"
              placeholder={
                emailValue?.trim()
                  ? `Par défaut : ${emailValue.trim()}`
                  : "factures@entreprise.ch"
              }
            />
          </Field>

          <Field label="Téléphone fixe" error={errors.telephone?.message}>
            <Input
              className={INPUT}
              {...register("telephone")}
              type="tel"
              placeholder="+41 21 000 00 00"
            />
          </Field>

          <Field label="Téléphone mobile" error={errors.telephoneMobile?.message}>
            <Input
              className={INPUT}
              {...register("telephoneMobile")}
              type="tel"
              placeholder="+41 79 000 00 00"
            />
          </Field>

          <Field label="Site web" error={errors.siteWeb?.message}>
            <Input
              className={INPUT}
              {...register("siteWeb")}
              type="url"
              placeholder="https://exemple.ch"
            />
          </Field>

          <Field label="LinkedIn" error={errors.linkedIn?.message}>
            <Input
              className={INPUT}
              {...register("linkedIn")}
              type="url"
              placeholder="https://linkedin.com/in/…"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Localisation */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-extrabold tracking-[-0.01em]">Localisation</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Adresse"
            error={errors.adresse?.message}
            className="md:col-span-2"
          >
            <Input
              className={INPUT}
              {...register("adresse")}
              placeholder="Route Cantonale 12"
            />
          </Field>

          <Field label="Code postal" error={errors.codePostal?.message}>
            <Input className={INPUT} {...register("codePostal")} placeholder="1024" />
          </Field>

          <Field label="Ville" error={errors.ville?.message}>
            <Input className={INPUT} {...register("ville")} placeholder="Ecublens" />
          </Field>

          <Field label="Canton" error={errors.canton?.message}>
            <NativeSelect {...register("canton")}>
              <option value="">Sélectionner</option>
              {CANTONS_SUISSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Pays" error={errors.pays?.message}>
            <Input className={INPUT} {...register("pays")} placeholder="Suisse" />
          </Field>

          <Field label="N° IDE / SIRET" error={errors.numeroIDE?.message}>
            <Input
              className={INPUT}
              {...register("numeroIDE")}
              placeholder="CHE-XXX.XXX.XXX (Suisse) ou SIRET (FR)"
            />
          </Field>

          <Field label="N° TVA" error={errors.numeroTVA?.message}>
            <Input
              className={INPUT}
              {...register("numeroTVA")}
              placeholder="CHE-XXX.XXX.XXX TVA ou FR-XX-XXXXXXXXX"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Qualification */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-extrabold tracking-[-0.01em]">Qualification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Secteur" error={errors.secteur?.message}>
            <NativeSelect {...register("secteur")}>
              <option value="">Sélectionner</option>
              {PROSPECT_SECTEUR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Effectif" error={errors.effectif?.message}>
            <Input
              className={INPUT}
              {...register("effectif")}
              type="number"
              min={0}
              placeholder="12"
            />
          </Field>

          <Field label="Source" error={errors.source?.message}>
            <NativeSelect {...register("source")}>
              <option value="">Sélectionner</option>
              {PROSPECT_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Statut" error={errors.statut?.message}>
            <NativeSelect {...register("statut")}>
              {PROSPECT_STATUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {isAdmin && teamUsers.length > 0 && (
            <Field
              label="Assignée à (commerciale)"
              error={errors.assigneAId?.message}
            >
              <NativeSelect {...register("assigneAId")}>
                <option value="">Non assignée</option>
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          <Field
            label="Notes générales"
            error={errors.notesGenerales?.message}
            className="md:col-span-2"
          >
            <textarea
              {...register("notesGenerales")}
              rows={4}
              className="w-full rounded-[12px] border border-border-strong bg-card px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Contexte, opportunités, mots-clés…"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Erreur globale */}
      {serverError && (
        <div role="alert" className="rounded-[14px] bg-alert-50 px-4 py-3 text-sm font-semibold text-alert-700">
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({
  label,
  required,
  error,
  className,
  hint,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[13px] font-bold">
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-coral-600">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs font-semibold text-alert-700">{error}</p>}
    </div>
  );
}

const NativeSelect = ({
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={cn(
      "h-11 w-full rounded-[12px] border border-border-strong bg-card px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
      className,
    )}
  >
    {children}
  </select>
);
