"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateEmployee } from "@/app/(app)/rh/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function EmployeeForm({ initial }: EmployeeFormProps) {
  const [pending, startTransition] = useTransition();

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet *">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email *">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Email de récupération (externe)">
            <Input
              type="email"
              value={emailRecuperation}
              onChange={(e) => setEmailRecuperation(e.target.value)}
              placeholder="ex. prenom@gmail.com"
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
          </Field>
          <Field label="Date de naissance">
            <Input
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
            />
          </Field>
          <Field label="Adresse postale" full>
            <Input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Rue, NPA, ville"
            />
          </Field>
          <Field label="N° AVS">
            <Input
              value={numeroAVS}
              onChange={(e) => setNumeroAVS(e.target.value)}
              placeholder="756.XXXX.XXXX.XX"
            />
          </Field>
          <Field label="IBAN">
            <Input
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="CH..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* Contrat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contrat de travail</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de contrat">
            <select
              value={typeContrat}
              onChange={(e) => setTypeContrat(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="">—</option>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="MANDAT">Mandat</option>
              <option value="STAGE">Stage</option>
              <option value="ESSAI">Période d&apos;essai</option>
            </select>
          </Field>
          <Field label="% d'activité">
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={pourcentageActivite}
              onChange={(e) =>
                setPourcentageActivite(Number(e.target.value) || 0)
              }
            />
          </Field>
          <Field label="Date d'entrée">
            <Input
              type="date"
              value={dateEntree}
              onChange={(e) => setDateEntree(e.target.value)}
            />
          </Field>
          <Field label="Date de sortie">
            <Input
              type="date"
              value={dateSortie}
              onChange={(e) => setDateSortie(e.target.value)}
            />
          </Field>
          <Field label="Salaire de base (CHF / mois)" full>
            <Input
              type="number"
              min={0}
              step="100"
              value={salaireBase}
              onChange={(e) => setSalaireBase(Number(e.target.value) || 0)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Rémunération commerciale */}
      {isCommercial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rémunération commerciale
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Garantie mensuelle (CHF)">
              <Input
                type="number"
                step="50"
                value={Number(garantieMensuelle)}
                onChange={(e) =>
                  setGarantieMensuelle(Number(e.target.value) || 0)
                }
              />
            </Field>
            <Field label="Forfait frais (CHF)">
              <Input
                type="number"
                step="10"
                value={Number(forfaitFrais)}
                onChange={(e) => setForfaitFrais(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Taux commission signature (0–1)">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={Number(tauxCommissionSignature)}
                onChange={(e) =>
                  setTauxCommissionSignature(Number(e.target.value) || 0)
                }
              />
            </Field>
            <Field label="Taux commission renouvellement (0–1)">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={Number(tauxCommissionRenouvellement)}
                onChange={(e) =>
                  setTauxCommissionRenouvellement(Number(e.target.value) || 0)
                }
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Contact d'urgence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact d&apos;urgence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet">
            <Input
              value={contactUrgenceNom}
              onChange={(e) => setContactUrgenceNom(e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={contactUrgenceTel}
              onChange={(e) => setContactUrgenceTel(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes internes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notesRH}
            onChange={(e) => setNotesRH(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Évaluations, points discutés en entretien, etc."
          />
        </CardContent>
      </Card>

      {/* Statut */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statut</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            Compte actif (peut se connecter)
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
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
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
