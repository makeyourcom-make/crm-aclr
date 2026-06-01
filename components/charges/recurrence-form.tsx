"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createRecurrence } from "@/app/(app)/charges/recurrences/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <Label className="mb-1 block text-xs">Libellé *</Label>
        <Input
          placeholder="Sunrise mobile + internet, Workspace Business..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Catégorie *</Label>
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Fournisseur</Label>
        <Input
          value={fournisseur}
          onChange={(e) => setFournisseur(e.target.value)}
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Montant TTC estimé *</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={montantEstime}
          onChange={(e) => setMontantEstime(Number(e.target.value) || 0)}
          required
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Taux TVA</Label>
        <select
          value={tauxTVA}
          onChange={(e) => setTauxTVA(Number(e.target.value))}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value={0.077}>7.7 %</option>
          <option value={0.025}>2.5 %</option>
          <option value={0.038}>3.8 %</option>
          <option value={0}>0 %</option>
        </select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Fréquence</Label>
        <select
          value={frequence}
          onChange={(e) => setFrequence(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
        >
          {FREQUENCES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Jour du mois</Label>
        <Input
          type="number"
          min={1}
          max={28}
          value={jourMois}
          onChange={(e) => setJourMois(Number(e.target.value) || 1)}
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Client rattaché</Label>
        <select
          value={prospectId}
          onChange={(e) => setProspectId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value="">— Interne —</option>
          {prospects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.raisonSociale}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Date de fin (optionnel)</Label>
        <Input
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
        />
      </div>
      <div className="flex items-end lg:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer la récurrence"}
        </Button>
      </div>
    </form>
  );
}
