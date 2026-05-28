"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateSettings } from "@/app/(app)/parametres/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Setting } from "@prisma/client";

export function SettingsForm({ setting }: { setting: Setting | null }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    raisonSociale: setting?.raisonSociale ?? "ACLR Sàrl",
    marque: setting?.marque ?? "Make Your Com",
    adresse: setting?.adresse ?? "",
    codePostal: setting?.codePostal ?? "",
    ville: setting?.ville ?? "",
    pays: setting?.pays ?? "Suisse",
    numeroIDE: setting?.numeroIDE ?? "",
    numeroTVA: setting?.numeroTVA ?? "",
    iban: setting?.iban ?? "",
    bicSwift: setting?.bicSwift ?? "",
    nomBanque: setting?.nomBanque ?? "",
    emailContact: setting?.emailContact ?? "",
    telephone: setting?.telephone ?? "",
    siteWeb: setting?.siteWeb ?? "",
    tvaActive: setting?.tvaActive ?? false,
    tauxTVA: String(setting?.tauxTVA ?? "0.081"),
    garantieMensuelleDefault: String(setting?.garantieMensuelleDefault ?? "2500"),
    forfaitFraisDefault: String(setting?.forfaitFraisDefault ?? "250"),
    tauxCommissionSignatureDefault: String(
      setting?.tauxCommissionSignatureDefault ?? "0.25",
    ),
    tauxCommissionRenouvellementDefault: String(
      setting?.tauxCommissionRenouvellementDefault ?? "0.10",
    ),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSettings(state);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Paramètres ACLR mis à jour.");
    });
  };

  const set = (k: keyof typeof state, v: string | boolean) =>
    setState((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité ACLR</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" required>
            <Input
              value={state.raisonSociale}
              onChange={(e) => set("raisonSociale", e.target.value)}
              required
            />
          </Field>
          <Field label="Marque commerciale">
            <Input
              value={state.marque}
              onChange={(e) => set("marque", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Adresse" className="sm:col-span-2">
            <Input
              value={state.adresse}
              onChange={(e) => set("adresse", e.target.value)}
            />
          </Field>
          <Field label="Code postal">
            <Input
              value={state.codePostal}
              onChange={(e) => set("codePostal", e.target.value)}
            />
          </Field>
          <Field label="Ville">
            <Input
              value={state.ville}
              onChange={(e) => set("ville", e.target.value)}
            />
          </Field>
          <Field label="Pays">
            <Input
              value={state.pays}
              onChange={(e) => set("pays", e.target.value)}
            />
          </Field>
          <Field label="Email contact">
            <Input
              type="email"
              value={state.emailContact}
              onChange={(e) => set("emailContact", e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={state.telephone}
              onChange={(e) => set("telephone", e.target.value)}
            />
          </Field>
          <Field label="Site web">
            <Input
              value={state.siteWeb}
              onChange={(e) => set("siteWeb", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identifiants & banque</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="N° IDE">
            <Input
              value={state.numeroIDE}
              onChange={(e) => set("numeroIDE", e.target.value)}
              placeholder="CHE-XXX.XXX.XXX"
            />
          </Field>
          <Field label="N° TVA">
            <Input
              value={state.numeroTVA}
              onChange={(e) => set("numeroTVA", e.target.value)}
              placeholder="CHE-XXX.XXX.XXX TVA"
            />
          </Field>
          <Field label="IBAN">
            <Input
              value={state.iban}
              onChange={(e) => set("iban", e.target.value)}
              placeholder="CH00 0000 0000 0000 0000 0"
            />
          </Field>
          <Field label="BIC / SWIFT">
            <Input
              value={state.bicSwift}
              onChange={(e) => set("bicSwift", e.target.value)}
            />
          </Field>
          <Field label="Nom banque">
            <Input
              value={state.nomBanque}
              onChange={(e) => set("nomBanque", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Paramètres financiers par défaut
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Taux commission signature (0.25 = 25%)">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={state.tauxCommissionSignatureDefault}
              onChange={(e) =>
                set("tauxCommissionSignatureDefault", e.target.value)
              }
            />
          </Field>
          <Field label="Taux commission renouvellement (0.10 = 10%)">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={state.tauxCommissionRenouvellementDefault}
              onChange={(e) =>
                set("tauxCommissionRenouvellementDefault", e.target.value)
              }
            />
          </Field>
          <Field label="Garantie mensuelle (CHF)">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={state.garantieMensuelleDefault}
              onChange={(e) =>
                set("garantieMensuelleDefault", e.target.value)
              }
            />
          </Field>
          <Field label="Forfait frais mensuel (CHF)">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={state.forfaitFraisDefault}
              onChange={(e) => set("forfaitFraisDefault", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TVA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.tvaActive}
              onChange={(e) => set("tvaActive", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">
              ACLR est assujetti à la TVA (active la TVA sur toutes les factures)
            </span>
          </label>
          <Field label="Taux TVA (0.081 = 8.1%)">
            <Input
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={state.tauxTVA}
              onChange={(e) => set("tauxTVA", e.target.value)}
              disabled={!state.tvaActive}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les paramètres ACLR"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
