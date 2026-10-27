"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createRecurrence } from "@/app/(app)/charges/recurrences/actions";
import { FormField } from "@/components/common/form-field";
import { FIELD_CLASS, SELECT_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { value: "LOYER", label: "Loyer" },
  { value: "SOFTWARE_SAAS", label: "Software / SaaS" },
  { value: "MARKETING", label: "Marketing" },
  { value: "PUBLICITE", label: "Publicité" },
  { value: "DEPLACEMENTS", label: "Déplacements" },
  { value: "RESTAURATION", label: "Restauration" },
  { value: "MATERIEL_BUREAU", label: "Matériel" },
  { value: "ASSURANCES", label: "Assurances" },
  { value: "TELECOM", label: "Télécom" },
  { value: "FORMATION", label: "Formation" },
  { value: "HONORAIRES", label: "Honoraires" },
  { value: "IMPOTS", label: "Impôts" },
  { value: "BANQUE_FRAIS", label: "Frais bancaires" },
  { value: "AUTRE", label: "Autre" },
];

const FREQUENCES = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "BIMESTRIEL", label: "Bi-mensuel (tous les 2 mois)" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "SEMESTRIEL", label: "Semestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

interface Props {
  prospects: { id: string; raisonSociale: string; statut: string }[];
}

export function RecurrenceForm({ prospects }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [categorie, setCategorie] = useState("SOFTWARE_SAAS");
  const [fournisseur, setFournisseur] = useState("");
  const [montantEstime, setMontantEstime] = useState(0);
  const [tauxTVA, setTauxTVA] = useState(0.077);
  const [frequence, setFrequence] = useState("MENSUEL");
  const [jourMois, setJourMois] = useState(1);
  const [prospectId, setProspectId] = useState("");
  const [dateFin, setDateFin] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || montantEstime <= 0) {
      toast.error("Libellé et montant requis.");
      return;
    }
    start(async () => {
      const res = await createRecurrence({
        label,
        categorie,
        fournisseur: fournisseur || null,
        montantEstime,
        tauxTVA,
        frequence,
        jourMois,
        prospectId: prospectId || null,
        actif: true,
        dateFin: dateFin || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur");
        return;
      }
      toast.success("Récurrence créée.");
      setLabel("");
      setFournisseur("");
      setMontantEstime(0);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Libellé" required className="lg:col-span-2">
        <Input
          placeholder="Sunrise mobile + internet, Workspace Business..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          className={FIELD_CLASS}
        />
      </FormField>
      <FormField label="Catégorie" required>
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          className={SELECT_CLASS}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Fournisseur">
        <Input
          value={fournisseur}
          onChange={(e) => setFournisseur(e.target.value)}
          className={FIELD_CLASS}
        />
      </FormField>
      <FormField label="Montant TTC estimé" required>
        <Input
          type="number"
          step="0.01"
          min={0}
          inputMode="decimal"
          value={montantEstime}
          onChange={(e) => setMontantEstime(Number(e.target.value) || 0)}
          required
          className={`${FIELD_CLASS} tabular-nums`}
        />
      </FormField>
      <FormField label="Taux TVA">
        <select
          value={tauxTVA}
          onChange={(e) => setTauxTVA(Number(e.target.value))}
          className={SELECT_CLASS}
        >
          <option value={0.077}>7.7 %</option>
          <option value={0.025}>2.5 %</option>
          <option value={0.038}>3.8 %</option>
          <option value={0}>0 %</option>
        </select>
      </FormField>
      <FormField label="Fréquence">
        <select
          value={frequence}
          onChange={(e) => setFrequence(e.target.value)}
          className={SELECT_CLASS}
        >
          {FREQUENCES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Jour du mois">
        <Input
          type="number"
          min={1}
          max={28}
          inputMode="numeric"
          value={jourMois}
          onChange={(e) => setJourMois(Number(e.target.value) || 1)}
          className={`${FIELD_CLASS} tabular-nums`}
        />
      </FormField>
      <FormField label="Client rattaché">
        <select
          value={prospectId}
          onChange={(e) => setProspectId(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Interne</option>
          {prospects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.raisonSociale}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Date de fin (optionnel)">
        <Input
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
          className={FIELD_CLASS}
        />
      </FormField>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {pending ? "Création…" : "Créer la récurrence"}
        </Button>
      </div>
    </form>
  );
}
