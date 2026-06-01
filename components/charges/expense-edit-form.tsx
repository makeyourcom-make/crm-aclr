"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateExpense } from "@/app/(app)/charges/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  { value: "EN_ATTENTE", label: "🟡 En attente de débit" },
  { value: "PAYE", label: "✓ Payé (débit confirmé)" },
  { value: "LITIGE", label: "⚠ Litige" },
  { value: "REMBOURSE", label: "↩ Remboursé" },
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
  const [f, setF] = useState(expense);

  // Si statutPaiement = PAYE et pas de dateReglement, suggère aujourd'hui
  useEffect(() => {
    if (f.statutPaiement === "PAYE" && !f.dateReglement) {
      setF((s) => ({ ...s, dateReglement: new Date().toISOString().slice(0, 10) }));
    }
  }, [f.statutPaiement, f.dateReglement]);

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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date du ticket *">
          <Input
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
            required
          />
        </Field>
        <Field label="Catégorie *">
          <select
            value={f.categorie}
            onChange={(e) => setF({ ...f, categorie: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Statut paiement">
          <select
            value={f.statutPaiement}
            onChange={(e) => setF({ ...f, statutPaiement: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date de règlement">
          <Input
            type="date"
            value={f.dateReglement}
            onChange={(e) => setF({ ...f, dateReglement: e.target.value })}
          />
        </Field>
        <Field label="Fournisseur" full>
          <Input
            value={f.fournisseur}
            onChange={(e) => setF({ ...f, fournisseur: e.target.value })}
          />
        </Field>
        <Field label="N° ticket / facture">
          <Input
            value={f.reference}
            onChange={(e) => setF({ ...f, reference: e.target.value })}
          />
        </Field>
        <Field label="Mode de paiement">
          <select
            value={f.methodPaiement}
            onChange={(e) => setF({ ...f, methodPaiement: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          >
            {METHODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client rattaché" full>
          <select
            value={f.prospectId}
            onChange={(e) => setF({ ...f, prospectId: e.target.value })}
            disabled={disableProspectIfAllocated}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:opacity-50"
          >
            <option value="">— Aucun (interne / multi-clients) —</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.raisonSociale}{" "}
                {p.statut !== "SIGNE" ? `(${p.statut})` : ""}
              </option>
            ))}
          </select>
          {disableProspectIfAllocated && (
            <p className="mt-1 text-[11px] text-amber-700">
              ⚠ Cette charge a des allocations multi-clients : retire-les
              d'abord si tu veux changer le client direct.
            </p>
          )}
        </Field>
        <Field label="Description" full>
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
        <Field label="HT *">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={f.montantHT}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              const tva = Math.round(v * f.tauxTVA * 100) / 100;
              setF({ ...f, montantHT: v, montantTVA: tva, montantTTC: v + tva });
            }}
            required
          />
        </Field>
        <Field label="Taux TVA">
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
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value={0.077}>7.7 %</option>
            <option value={0.025}>2.5 %</option>
            <option value={0.038}>3.8 %</option>
            <option value={0.081}>8.1 % (nouveau)</option>
            <option value={0}>0 %</option>
          </select>
        </Field>
        <Field label="TVA">
          <Input
            type="number"
            step="0.01"
            value={f.montantTVA}
            onChange={(e) =>
              setF({ ...f, montantTVA: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="TTC *">
          <Input
            type="number"
            step="0.01"
            min={0}
            value={f.montantTTC}
            onChange={(e) =>
              setF({ ...f, montantTTC: Number(e.target.value) || 0 })
            }
            required
          />
        </Field>
        <Field full label="">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.tvaRecuperable}
              onChange={(e) =>
                setF({ ...f, tvaRecuperable: e.target.checked })
              }
              className="h-4 w-4"
            />
            TVA récupérable
          </label>
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-4" : ""}>
      {label && <Label className="mb-1 block text-xs">{label}</Label>}
      {children}
    </div>
  );
}
