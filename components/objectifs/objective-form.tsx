"use client";

import {
  CalendarCheck,
  Coins,
  FileCheck,
  Mail,
  Phone,
  Send,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createObjective } from "@/app/(app)/objectifs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

const FIELD =
  "h-11 rounded-[12px] border-border bg-card px-3 text-[15px] md:text-sm";
const SELECT =
  "h-11 w-full rounded-[12px] border border-input bg-card px-3 text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

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
  const [notes, setNotes] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<keyof typeof TEMPLATES | null>(null);
  const daily = periode === "QUOTIDIEN";

  const applyTemplate = (key: keyof typeof TEMPLATES) => {
    const t = TEMPLATES[key];
    setNbAppels(String(t.nbAppels));
    setNbRdv(String(t.nbRdv));
    setNbSignatures(String(t.nbSignatures));
    setCa(String(t.ca));
    setCommission(String(Math.round(t.ca * 0.25)));
    setActiveTemplate(key);
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
        notes: notes || undefined,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Templates */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          <Sparkles aria-hidden="true" className="size-3.5 text-gold-500" />
          Partir d&apos;un modèle
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>).map((k) => {
            const t = TEMPLATES[k];
            const on = activeTemplate === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => applyTemplate(k)}
                aria-pressed={on}
                className={cn(
                  "flex min-h-11 flex-col items-start gap-0.5 rounded-[12px] border-2 px-3.5 py-2 text-left transition-colors",
                  on ? "border-coral-500 bg-coral-50" : "border-border bg-card hover:border-border-strong",
                )}
              >
                <span className="text-[13px] font-extrabold text-foreground">{t.label}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {t.nbAppels} appels · {t.nbRdv} RDV · {t.nbSignatures} contrats
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration */}
      <fieldset className="grid gap-4 rounded-[14px] bg-ground p-4 sm:grid-cols-2">
        <legend className="sr-only">Configuration</legend>
        {users.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obj-user">Pour</Label>
            <select
              id="obj-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={SELECT}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obj-periode">Période</Label>
          <select
            id="obj-periode"
            value={periode}
            onChange={(e) => setPeriode(e.target.value as ObjectivePeriode)}
            className={SELECT}
          >
            <option value="QUOTIDIEN">Quotidien (par jour)</option>
            <option value="HEBDOMADAIRE">Hebdomadaire</option>
            <option value="MENSUEL">Mensuel</option>
            <option value="TRIMESTRIEL">Trimestriel</option>
            <option value="ANNUEL">Annuel</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obj-debut">Date début</Label>
          <Input
            id="obj-debut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            required
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obj-fin">Date fin</Label>
          <Input
            id="obj-fin"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            required
            className={FIELD}
          />
        </div>
      </fieldset>

      {/* Cibles */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Cibles chiffrées (laisser vide = non suivie)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumField id="obj-appels" icon={Phone} tone="text-coral-600 bg-coral-50" label="Nb appels" hint={daily ? "Objectif du jour et série" : undefined} value={nbAppels} onChange={setNbAppels} />
          <NumField id="obj-emails" icon={Mail} tone="text-mail-700 bg-mail-50" label="Nb emails" hint={daily ? undefined : "Comptés avec LinkedIn et SMS"} value={nbEmails} onChange={setNbEmails} />
          <NumField id="obj-rdv" icon={CalendarCheck} tone="text-gold-700 bg-gold-50" label="Nb RDV" hint={daily ? "RDV pris (objectif du jour)" : "RDV effectués"} value={nbRdv} onChange={setNbRdv} />
          <NumField id="obj-prop" icon={Send} tone="text-lvl-700 bg-lvl-50" label="Nb propositions" hint={daily ? "Objectif du jour" : undefined} value={nbPropositions} onChange={setNbPropositions} />
          <NumField id="obj-sig" icon={FileCheck} tone="text-navy-700 bg-navy-100" label="Nb signatures" value={nbSignatures} onChange={setNbSignatures} />
          <NumField id="obj-ca" icon={Trophy} tone="text-win-700 bg-win-50" label="CA visé (CHF)" value={ca} onChange={setCa} />
          <NumField
            id="obj-commission"
            icon={Coins}
            tone="text-gold-700 bg-gold-50"
            label="Commission visée (CHF)"
            value={commission}
            onChange={setCommission}
            className="sm:col-span-2 lg:col-span-3"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="obj-notes">Notes (optionnel)</Label>
        <textarea
          id="obj-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-[12px] border border-input bg-card px-3 py-2 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          placeholder="Contexte, priorités du mois, points discutés…"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Création…" : "Créer l'objectif"}
        </Button>
      </div>
    </form>
  );
}

function NumField({
  id,
  label,
  hint,
  value,
  onChange,
  icon: Icon,
  tone,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  icon: LucideIcon;
  tone: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-[14px] border border-border bg-card p-3", className)}>
      <Label htmlFor={id} className="flex items-center gap-2">
        <span aria-hidden="true" className={cn("flex size-7 items-center justify-center rounded-[9px]", tone)}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <span>{label}</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
      {hint && <span className="text-xs font-medium text-muted-foreground">{hint}</span>}
    </div>
  );
}
