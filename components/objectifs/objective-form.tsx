"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createObjective } from "@/app/(app)/objectifs/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ObjectivePeriode } from "@prisma/client";

interface ObjectiveFormProps {
  users: Array<{ id: string; name: string }>;
  defaultUserId: string;
}

const TEMPLATES = {
  demarrage: {
    label: "Démarrage (mois 1-3)",
    nbAppels: 200,
    nbRdv: 15,
    nbSignatures: 2,
    ca: 10000,
  },
  croisiere: {
    label: "Croisière (mois 4-9)",
    nbAppels: 250,
    nbRdv: 25,
    nbSignatures: 4,
    ca: 20000,
  },
  performance: {
    label: "Performance (mois 10+)",
    nbAppels: 300,
    nbRdv: 30,
    nbSignatures: 6,
    ca: 35000,
  },
};

function firstOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function lastOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

export function ObjectiveForm({ users, defaultUserId }: ObjectiveFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [userId, setUserId] = useState(defaultUserId);
  const [periode, setPeriode] = useState<ObjectivePeriode>("MENSUEL");
  const [dateDebut, setDateDebut] = useState(firstOfMonth());
  const [dateFin, setDateFin] = useState(lastOfMonth());
  const [nbAppels, setNbAppels] = useState("");
  const [nbEmails, setNbEmails] = useState("");
  const [nbRdv, setNbRdv] = useState("");
  const [nbPropositions, setNbPropositions] = useState("");
  const [nbSignatures, setNbSignatures] = useState("");
  const [ca, setCa] = useState("");
  const [commission, setCommission] = useState("");

  const applyTemplate = (key: keyof typeof TEMPLATES) => {
    const t = TEMPLATES[key];
    setNbAppels(String(t.nbAppels));
    setNbRdv(String(t.nbRdv));
    setNbSignatures(String(t.nbSignatures));
    setCa(String(t.ca));
    setCommission(String(Math.round(t.ca * 0.25)));
    toast.info(`Template « ${t.label} » appliqué.`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createObjective({
        userId,
        periode,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        nbAppelsObjectif: nbAppels || undefined,
        nbEmailsObjectif: nbEmails || undefined,
        nbRdvObjectif: nbRdv || undefined,
        nbPropositionsObjectif: nbPropositions || undefined,
        nbSignaturesObjectif: nbSignatures || undefined,
        caObjectif: ca || undefined,
        commissionObjectif: commission || undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Objectif créé.");
      router.push("/objectifs");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Configuration</CardTitle>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => applyTemplate(k)}
                className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] hover:bg-primary/10"
              >
                {TEMPLATES[k].label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {users.length > 1 && (
            <div className="space-y-1.5">
              <Label>Pour</Label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Période</Label>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value as ObjectivePeriode)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="HEBDOMADAIRE">Hebdomadaire</option>
              <option value="MENSUEL">Mensuel</option>
              <option value="TRIMESTRIEL">Trimestriel</option>
              <option value="ANNUEL">Annuel</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Date début</Label>
            <Input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date fin</Label>
            <Input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cibles chiffrées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <NumField label="Nb appels" value={nbAppels} onChange={setNbAppels} />
          <NumField label="Nb emails" value={nbEmails} onChange={setNbEmails} />
          <NumField label="Nb RDV" value={nbRdv} onChange={setNbRdv} />
          <NumField
            label="Nb propositions"
            value={nbPropositions}
            onChange={setNbPropositions}
          />
          <NumField
            label="Nb signatures"
            value={nbSignatures}
            onChange={setNbSignatures}
          />
          <NumField label="CA visé (CHF)" value={ca} onChange={setCa} />
          <NumField
            label="Commission visée (CHF)"
            value={commission}
            onChange={setCommission}
            className="sm:col-span-3"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'objectif"}
        </Button>
      </div>
    </form>
  );
}

function NumField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
