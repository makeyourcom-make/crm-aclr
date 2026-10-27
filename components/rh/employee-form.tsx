"use client";

import {
  Briefcase,
  Coins,
  Power,
  Siren,
  StickyNote,
  UserRound,
} from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateEmployee } from "@/app/(app)/rh/actions";
import { SectionCard } from "@/components/arena/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface EmployeeFormProps {
  initial: {
    id: string;
    name: string;
    email: string;
    emailRecuperation: string | null;
    role: string;
    isActive: boolean;
    telephone: string | null;
    adresse: string | null;
    iban: string | null;
    dateNaissance: Date | null;
    numeroAVS: string | null;
    contactUrgenceNom: string | null;
    contactUrgenceTel: string | null;
    typeContrat: string | null;
    dateEntree: Date | null;
    dateSortie: Date | null;
    pourcentageActivite: number | null;
    salaireBase: number | null;
    garantieMensuelle: number;
    forfaitFrais: number;
    tauxCommissionSignature: number;
    tauxCommissionRenouvellement: number;
    notesRH: string | null;
  };
}

const dateToIso = (d: Date | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

const FIELD = "h-11 rounded-[12px] border-border bg-card px-3 text-[15px] md:text-sm";

export function EmployeeForm({ initial }: EmployeeFormProps) {
  const [pending, startTransition] = useTransition();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [emailRecuperation, setEmailRecuperation] = useState(
    initial.emailRecuperation ?? "",
  );
  const [telephone, setTelephone] = useState(initial.telephone ?? "");
  const [adresse, setAdresse] = useState(initial.adresse ?? "");
  const [iban, setIban] = useState(initial.iban ?? "");
  const [isActive, setIsActive] = useState(initial.isActive);

  // RH
  const [dateNaissance, setDateNaissance] = useState(
    dateToIso(initial.dateNaissance),
  );
  const [numeroAVS, setNumeroAVS] = useState(initial.numeroAVS ?? "");
  const [contactUrgenceNom, setContactUrgenceNom] = useState(
    initial.contactUrgenceNom ?? "",
  );
  const [contactUrgenceTel, setContactUrgenceTel] = useState(
    initial.contactUrgenceTel ?? "",
  );
  const [typeContrat, setTypeContrat] = useState(initial.typeContrat ?? "");
  const [dateEntree, setDateEntree] = useState(dateToIso(initial.dateEntree));
  const [dateSortie, setDateSortie] = useState(dateToIso(initial.dateSortie));
  const [pourcentageActivite, setPourcentageActivite] = useState(
    initial.pourcentageActivite ?? 100,
  );
  const [salaireBase, setSalaireBase] = useState(initial.salaireBase ?? 0);
  const [notesRH, setNotesRH] = useState(initial.notesRH ?? "");

  // Rémunération commerciale
  const [garantieMensuelle, setGarantieMensuelle] = useState(
    initial.garantieMensuelle,
  );
  const [forfaitFrais, setForfaitFrais] = useState(initial.forfaitFrais);
  const [tauxCommissionSignature, setTauxCommissionSignature] = useState(
    initial.tauxCommissionSignature,
  );
  const [tauxCommissionRenouvellement, setTauxCommissionRenouvellement] =
    useState(initial.tauxCommissionRenouvellement);

  const isCommercial = initial.role === "COMMERCIAL";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateEmployee({
        id: initial.id,
        name,
        email,
        emailRecuperation: emailRecuperation || null,
        telephone: telephone || null,
        adresse: adresse || null,
        iban: iban || null,
        isActive,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        numeroAVS: numeroAVS || null,
        contactUrgenceNom: contactUrgenceNom || null,
        contactUrgenceTel: contactUrgenceTel || null,
        typeContrat: typeContrat || null,
        dateEntree: dateEntree ? new Date(dateEntree) : null,
        dateSortie: dateSortie ? new Date(dateSortie) : null,
        pourcentageActivite,
        salaireBase: salaireBase || null,
        notesRH: notesRH || null,
        ...(isCommercial
          ? {
              garantieMensuelle,
              forfaitFrais,
              tauxCommissionSignature,
              tauxCommissionRenouvellement,
            }
          : {}),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Fiche mise à jour.");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Identité */}
      <SectionCard title="Identité" icon={UserRound} tone="blue" contentClassName="grid gap-4 sm:grid-cols-2">
        <Field id={fid("name")} label="Nom complet *">
          <Input id={fid("name")} value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </Field>
        <Field id={fid("email")} label="Email *">
          <Input
            id={fid("email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field id={fid("recup")} label="Email de récupération (externe)">
          <Input
            id={fid("recup")}
            type="email"
            value={emailRecuperation}
            onChange={(e) => setEmailRecuperation(e.target.value)}
            placeholder="ex. prenom@gmail.com"
            className={FIELD}
          />
        </Field>
        <Field id={fid("tel")} label="Téléphone">
          <Input
            id={fid("tel")}
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field id={fid("naissance")} label="Date de naissance">
          <Input
            id={fid("naissance")}
            type="date"
            value={dateNaissance}
            onChange={(e) => setDateNaissance(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field id={fid("adresse")} label="Adresse postale" full>
          <Input
            id={fid("adresse")}
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Rue, NPA, ville"
            className={FIELD}
          />
        </Field>
        <Field id={fid("avs")} label="N° AVS">
          <Input
            id={fid("avs")}
            value={numeroAVS}
            onChange={(e) => setNumeroAVS(e.target.value)}
            placeholder="756.XXXX.XXXX.XX"
            className={FIELD}
          />
        </Field>
        <Field id={fid("iban")} label="IBAN">
          <Input
            id={fid("iban")}
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="CH..."
            className={FIELD}
          />
        </Field>
      </SectionCard>

      {/* Contrat */}
      <SectionCard title="Contrat de travail" icon={Briefcase} tone="navy" contentClassName="grid gap-4 sm:grid-cols-2">
        <Field id={fid("contrat")} label="Type de contrat">
          <select
            id={fid("contrat")}
            value={typeContrat}
            onChange={(e) => setTypeContrat(e.target.value)}
            className="h-11 w-full rounded-[12px] border border-input bg-card px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="">Non renseigné</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="MANDAT">Mandat</option>
            <option value="STAGE">Stage</option>
            <option value="ESSAI">Période d&apos;essai</option>
          </select>
        </Field>
        <Field id={fid("activite")} label="% d'activité">
          <Input
            id={fid("activite")}
            type="number"
            min={0}
            max={100}
            step={5}
            value={pourcentageActivite}
            onChange={(e) =>
              setPourcentageActivite(Number(e.target.value) || 0)
            }
            className={FIELD}
          />
        </Field>
        <Field id={fid("entree")} label="Date d'entrée">
          <Input
            id={fid("entree")}
            type="date"
            value={dateEntree}
            onChange={(e) => setDateEntree(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field id={fid("sortie")} label="Date de sortie">
          <Input
            id={fid("sortie")}
            type="date"
            value={dateSortie}
            onChange={(e) => setDateSortie(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field id={fid("salaire")} label="Salaire de base (CHF / mois)" full>
          <Input
            id={fid("salaire")}
            type="number"
            min={0}
            step="100"
            value={salaireBase}
            onChange={(e) => setSalaireBase(Number(e.target.value) || 0)}
            className={FIELD}
          />
        </Field>
      </SectionCard>

      {/* Rémunération commerciale */}
      {isCommercial && (
        <SectionCard
          title="Rémunération commerciale"
          icon={Coins}
          tone="gold"
          description="Ces taux alimentent les commissions et le simulateur de gains de la commerciale."
          contentClassName="grid gap-4 sm:grid-cols-2"
        >
          <Field id={fid("garantie")} label="Garantie mensuelle (CHF)">
            <Input
              id={fid("garantie")}
              type="number"
              step="50"
              value={Number(garantieMensuelle)}
              onChange={(e) =>
                setGarantieMensuelle(Number(e.target.value) || 0)
              }
              className={FIELD}
            />
          </Field>
          <Field id={fid("frais")} label="Forfait frais (CHF)">
            <Input
              id={fid("frais")}
              type="number"
              step="10"
              value={Number(forfaitFrais)}
              onChange={(e) => setForfaitFrais(Number(e.target.value) || 0)}
              className={FIELD}
            />
          </Field>
          <Field id={fid("taux-sig")} label="Taux commission signature (0 à 1, ex. 0.25)">
            <Input
              id={fid("taux-sig")}
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={Number(tauxCommissionSignature)}
              onChange={(e) =>
                setTauxCommissionSignature(Number(e.target.value) || 0)
              }
              className={FIELD}
            />
          </Field>
          <Field id={fid("taux-ren")} label="Taux commission renouvellement (0 à 1, ex. 0.10)">
            <Input
              id={fid("taux-ren")}
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={Number(tauxCommissionRenouvellement)}
              onChange={(e) =>
                setTauxCommissionRenouvellement(Number(e.target.value) || 0)
              }
              className={FIELD}
            />
          </Field>
        </SectionCard>
      )}

      {/* Contact d'urgence */}
      <SectionCard title="Contact d'urgence" icon={Siren} tone="red" contentClassName="grid gap-4 sm:grid-cols-2">
        <Field id={fid("urg-nom")} label="Nom complet">
          <Input
            id={fid("urg-nom")}
            value={contactUrgenceNom}
            onChange={(e) => setContactUrgenceNom(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field id={fid("urg-tel")} label="Téléphone">
          <Input
            id={fid("urg-tel")}
            type="tel"
            value={contactUrgenceTel}
            onChange={(e) => setContactUrgenceTel(e.target.value)}
            className={FIELD}
          />
        </Field>
      </SectionCard>

      {/* Notes */}
      <SectionCard title="Notes internes" icon={StickyNote} tone="violet">
        <Label htmlFor={fid("notes")} className="sr-only">
          Notes internes
        </Label>
        <textarea
          id={fid("notes")}
          value={notesRH}
          onChange={(e) => setNotesRH(e.target.value)}
          rows={4}
          className="w-full rounded-[12px] border border-input bg-card px-3 py-2.5 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          placeholder="Évaluations, points discutés en entretien, etc."
        />
      </SectionCard>

      {/* Statut */}
      <SectionCard title="Statut" icon={Power} tone={isActive ? "green" : "red"}>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-5 accent-navy-700"
          />
          Compte actif (peut se connecter)
        </label>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  children,
  full,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", full && "sm:col-span-2")}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
      </Label>
      {children}
    </div>
  );
}
