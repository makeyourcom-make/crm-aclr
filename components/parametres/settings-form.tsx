"use client";

import {
  Building2,
  Landmark,
  Loader2,
  MapPin,
  Percent,
  Receipt,
  Save,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateSettings } from "@/app/(app)/parametres/actions";
import { SectionCard } from "@/components/arena/section-card";
import { FormField } from "@/components/common/form-field";
import { CHECKBOX_CLASS, FIELD_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionCard title="Identité ACLR" icon={Building2} tone="navy">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Raison sociale" required>
            <Input
              value={state.raisonSociale}
              onChange={(e) => set("raisonSociale", e.target.value)}
              required
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Marque commerciale">
            <Input
              value={state.marque}
              onChange={(e) => set("marque", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Coordonnées" icon={MapPin} tone="blue">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Adresse" className="sm:col-span-2">
            <Input
              value={state.adresse}
              onChange={(e) => set("adresse", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Code postal">
            <Input
              value={state.codePostal}
              onChange={(e) => set("codePostal", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Ville">
            <Input
              value={state.ville}
              onChange={(e) => set("ville", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Pays">
            <Input
              value={state.pays}
              onChange={(e) => set("pays", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Email contact">
            <Input
              type="email"
              value={state.emailContact}
              onChange={(e) => set("emailContact", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Téléphone">
            <Input
              value={state.telephone}
              onChange={(e) => set("telephone", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Site web">
            <Input
              value={state.siteWeb}
              onChange={(e) => set("siteWeb", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Identifiants et banque" icon={Landmark} tone="violet">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="N° IDE">
            <Input
              value={state.numeroIDE}
              onChange={(e) => set("numeroIDE", e.target.value)}
              placeholder="CHE-XXX.XXX.XXX"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="N° TVA">
            <Input
              value={state.numeroTVA}
              onChange={(e) => set("numeroTVA", e.target.value)}
              placeholder="CHE-XXX.XXX.XXX TVA"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="IBAN">
            <Input
              value={state.iban}
              onChange={(e) => set("iban", e.target.value)}
              placeholder="CH00 0000 0000 0000 0000 0"
              className={`${FIELD_CLASS} font-mono`}
            />
          </FormField>
          <FormField label="BIC / SWIFT">
            <Input
              value={state.bicSwift}
              onChange={(e) => set("bicSwift", e.target.value)}
              className={`${FIELD_CLASS} font-mono`}
            />
          </FormField>
          <FormField label="Nom banque">
            <Input
              value={state.nomBanque}
              onChange={(e) => set("nomBanque", e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Paramètres financiers par défaut"
        description="Appliqués aux nouvelles commerciales et aux nouveaux contrats"
        icon={Percent}
        tone="green"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Taux commission signature (0.25 = 25 %)">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              inputMode="decimal"
              value={state.tauxCommissionSignatureDefault}
              onChange={(e) =>
                set("tauxCommissionSignatureDefault", e.target.value)
              }
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Taux commission renouvellement (0.10 = 10 %)">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              inputMode="decimal"
              value={state.tauxCommissionRenouvellementDefault}
              onChange={(e) =>
                set("tauxCommissionRenouvellementDefault", e.target.value)
              }
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Garantie mensuelle (CHF)">
            <Input
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={state.garantieMensuelleDefault}
              onChange={(e) =>
                set("garantieMensuelleDefault", e.target.value)
              }
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Forfait frais mensuel (CHF)">
            <Input
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={state.forfaitFraisDefault}
              onChange={(e) => set("forfaitFraisDefault", e.target.value)}
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="TVA" icon={Receipt} tone="gold">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={state.tvaActive}
              onChange={(e) => set("tvaActive", e.target.checked)}
              className={`${CHECKBOX_CLASS} mt-0.5`}
            />
            <span className="text-sm font-semibold">
              ACLR est assujetti à la TVA (active la TVA sur toutes les factures)
            </span>
          </label>
          <FormField label="Taux TVA (0.081 = 8.1 %)" className="sm:max-w-xs">
            <Input
              type="number"
              step="0.001"
              min={0}
              max={1}
              inputMode="decimal"
              value={state.tauxTVA}
              onChange={(e) => set("tauxTVA", e.target.value)}
              disabled={!state.tvaActive}
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {pending ? "Enregistrement…" : "Enregistrer les paramètres ACLR"}
        </Button>
      </div>
    </form>
  );
}
