"use client";

import { AlertTriangle, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateExpense } from "@/app/(app)/charges/actions";
import { FormField } from "@/components/common/form-field";
import {
  CHECKBOX_CLASS,
  FIELD_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { value: "LOYER", label: "Loyer" },
  { value: "SOFTWARE_SAAS", label: "Software / SaaS" },
  { value: "MARKETING", label: "Marketing" },
  { value: "PUBLICITE", label: "Publicité (Ads)" },
  { value: "DEPLACEMENTS", label: "Déplacements" },
  { value: "RESTAURATION", label: "Restauration / Café" },
  { value: "MATERIEL_BUREAU", label: "Matériel / Fournitures" },
  { value: "ASSURANCES", label: "Assurances" },
  { value: "TELECOM", label: "Télécom" },
  { value: "FORMATION", label: "Formation" },
  { value: "HONORAIRES", label: "Honoraires" },
  { value: "IMPOTS", label: "Impôts" },
  { value: "BANQUE_FRAIS", label: "Frais bancaires" },
  { value: "AUTRE", label: "Autre" },
];

const METHODES = [
  { value: "CARTE_BANCAIRE", label: "Carte bancaire" },
  { value: "VIREMENT", label: "Virement" },
  { value: "ESPECES", label: "Espèces" },
  { value: "TWINT", label: "Twint" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "PRELEVEMENT", label: "Prélèvement" },
  { value: "AUTRE", label: "Autre" },
];

const STATUTS = [
  { value: "EN_ATTENTE", label: "En attente de débit" },
  { value: "PAYE", label: "Payé (débit confirmé)" },
  { value: "LITIGE", label: "Litige" },
  { value: "REMBOURSE", label: "Remboursé" },
];

interface ExpenseInitial {
  id: string;
  date: string;
  dateReglement: string;
  statutPaiement: string;
  categorie: string;
  fournisseur: string;
  description: string;
  reference: string;
  montantHT: number;
  tauxTVA: number;
  montantTVA: number;
  montantTTC: number;
  tvaRecuperable: boolean;
  methodPaiement: string;
  prospectId: string;
}

/**
 * Si statutPaiement = PAYE et pas de dateReglement, suggère aujourd'hui.
 * Même règle que l'ancien effet, appliquée à chaque mise à jour du
 * formulaire (et à l'initialisation) au lieu d'un useEffect.
 */
function withPaidDefault(s: ExpenseInitial): ExpenseInitial {
  if (s.statutPaiement === "PAYE" && !s.dateReglement) {
    return { ...s, dateReglement: new Date().toISOString().slice(0, 10) };
  }
  return s;
}

export function ExpenseEditForm({
  expense,
  prospects,
  disableProspectIfAllocated,
}: {
  expense: ExpenseInitial;
  prospects: { id: string; raisonSociale: string; statut: string }[];
  disableProspectIfAllocated?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setFRaw] = useState(() => withPaidDefault(expense));
  const setF = (next: ExpenseInitial) => setFRaw(withPaidDefault(next));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateExpense({
        id: f.id,
        date: new Date(f.date),
        dateReglement: f.dateReglement ? new Date(f.dateReglement) : null,
        statutPaiement: f.statutPaiement,
        categorie: f.categorie,
        fournisseur: f.fournisseur || null,
        description: f.description || null,
        reference: f.reference || null,
        montantHT: f.montantHT,
        tauxTVA: f.tauxTVA,
        montantTVA: f.montantTVA,
        montantTTC: f.montantTTC,
        tvaRecuperable: f.tvaRecuperable,
        methodPaiement: f.methodPaiement,
        prospectId: f.prospectId || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur");
        return;
      }
      toast.success("Charge mise à jour.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date du ticket" required>
          <Input
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
            required
            className={FIELD_CLASS}
          />
        </FormField>
        <FormField label="Catégorie" required>
          <select
            value={f.categorie}
            onChange={(e) => setF({ ...f, categorie: e.target.value })}
            className={SELECT_CLASS}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Statut paiement">
          <select
            value={f.statutPaiement}
            onChange={(e) => setF({ ...f, statutPaiement: e.target.value })}
            className={SELECT_CLASS}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Date de règlement">
          <Input
            type="date"
            value={f.dateReglement}
            onChange={(e) => setF({ ...f, dateReglement: e.target.value })}
            className={FIELD_CLASS}
          />
        </FormField>
        <FormField label="Fournisseur" className="sm:col-span-2">
          <Input
            value={f.fournisseur}
            onChange={(e) => setF({ ...f, fournisseur: e.target.value })}
            className={FIELD_CLASS}
          />
        </FormField>
        <FormField label="N° ticket / facture">
          <Input
            value={f.reference}
            onChange={(e) => setF({ ...f, reference: e.target.value })}
            className={FIELD_CLASS}
          />
        </FormField>
        <FormField label="Mode de paiement">
          <select
            value={f.methodPaiement}
            onChange={(e) => setF({ ...f, methodPaiement: e.target.value })}
            className={SELECT_CLASS}
          >
            {METHODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Client rattaché"
          className="sm:col-span-2"
          hint={
            disableProspectIfAllocated ? (
              <span className="inline-flex items-start gap-1.5 font-semibold text-gold-700">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                Cette charge a des allocations multi-clients : retire-les
                d&apos;abord si tu veux changer le client direct.
              </span>
            ) : undefined
          }
        >
          <select
            value={f.prospectId}
            onChange={(e) => setF({ ...f, prospectId: e.target.value })}
            disabled={disableProspectIfAllocated}
            className={SELECT_CLASS}
          >
            <option value="">Aucun (interne / multi-clients)</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.raisonSociale}{" "}
                {p.statut !== "SIGNE" ? `(${p.statut})` : ""}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Description" className="sm:col-span-2">
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </div>

      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="HT" required>
          <Input
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            value={f.montantHT}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              const tva = Math.round(v * f.tauxTVA * 100) / 100;
              setF({ ...f, montantHT: v, montantTVA: tva, montantTTC: v + tva });
            }}
            required
            className={`${FIELD_CLASS} tabular-nums`}
          />
        </FormField>
        <FormField label="Taux TVA">
          <select
            value={f.tauxTVA}
            onChange={(e) => {
              const t = Number(e.target.value);
              const tva = Math.round(f.montantHT * t * 100) / 100;
              setF({
                ...f,
                tauxTVA: t,
                montantTVA: tva,
                montantTTC: f.montantHT + tva,
              });
            }}
            className={SELECT_CLASS}
          >
            <option value={0.077}>7.7 %</option>
            <option value={0.025}>2.5 %</option>
            <option value={0.038}>3.8 %</option>
            <option value={0.081}>8.1 % (nouveau)</option>
            <option value={0}>0 %</option>
          </select>
        </FormField>
        <FormField label="TVA">
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={f.montantTVA}
            onChange={(e) =>
              setF({ ...f, montantTVA: Number(e.target.value) || 0 })
            }
            className={`${FIELD_CLASS} tabular-nums`}
          />
        </FormField>
        <FormField label="TTC" required>
          <Input
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            value={f.montantTTC}
            onChange={(e) =>
              setF({ ...f, montantTTC: Number(e.target.value) || 0 })
            }
            required
            className={`${FIELD_CLASS} tabular-nums`}
          />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.tvaRecuperable}
            onChange={(e) =>
              setF({ ...f, tvaRecuperable: e.target.checked })
            }
            className={CHECKBOX_CLASS}
          />
          TVA récupérable
        </label>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {pending ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>
    </form>
  );
}
