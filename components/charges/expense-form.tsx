"use client";

/**
 * Formulaire de saisie d'une charge.
 *
 * Workflow :
 *   1. Admin uploade une photo du ticket (drag-drop ou clic)
 *   2. Il peut cliquer "Analyser le ticket" → Claude vision pré-remplit
 *      automatiquement date, fournisseur, montant HT/TVA/TTC, catégorie
 *   3. Il corrige si besoin, puis Enregistre
 *
 * S'il n'y a pas de clé Claude configurée, l'OCR est désactivé, mais le
 * reste fonctionne (saisie 100 % manuelle).
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  analyzeReceiptOcr,
  createExpense,
} from "@/app/(app)/charges/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
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

const STATUTS_PAIEMENT = [
  { value: "EN_ATTENTE", label: "En attente de débit" },
  { value: "PAYE", label: "Payé (débit confirmé)" },
  { value: "LITIGE", label: "Litige" },
  { value: "REMBOURSE", label: "Remboursé" },
];

export interface ProspectOption {
  id: string;
  raisonSociale: string;
  statut: string;
}

export function ExpenseForm({
  prospects = [],
}: {
  prospects?: ProspectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ocrRunning, setOcrRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Photo du ticket
  const [ticketDataUrl, setTicketDataUrl] = useState<string | null>(null);
  const [ticketName, setTicketName] = useState<string | null>(null);
  const [ocrRawJson, setOcrRawJson] = useState<string | null>(null);
  const [ocrUtilise, setOcrUtilise] = useState(false);

  // Champs métier
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateReglement, setDateReglement] = useState("");
  const [statutPaiement, setStatutPaiement] = useState("EN_ATTENTE");
  const [categorie, setCategorie] = useState("AUTRE");
  const [fournisseur, setFournisseur] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [montantHT, setMontantHT] = useState(0);
  const [tauxTVA, setTauxTVA] = useState(0.077);
  const [montantTVA, setMontantTVA] = useState(0);
  const [montantTTC, setMontantTTC] = useState(0);
  const [tvaRecuperable, setTvaRecuperable] = useState(true);
  const [methodPaiement, setMethodPaiement] = useState("CARTE_BANCAIRE");
  const [prospectId, setProspectId] = useState<string>("");

  // Recalcul automatique TVA/TTC quand HT ou taux changent (sauf si OCR a tout rempli)
  useEffect(() => {
    if (ocrUtilise) return; // ne pas écraser les valeurs OCR
    const tva = Math.round(montantHT * tauxTVA * 100) / 100;
    setMontantTVA(tva);
    setMontantTTC(montantHT + tva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montantHT, tauxTVA]);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 6 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTicketDataUrl(reader.result as string);
      setTicketName(f.name);
    };
    reader.readAsDataURL(f);
  };

  const handleOcr = async () => {
    if (!ticketDataUrl) {
      toast.error("Charge d'abord une photo de ticket.");
      return;
    }
    setOcrRunning(true);
    try {
      const res = await analyzeReceiptOcr({ imageDataUrl: ticketDataUrl });
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "OCR échoué.");
        return;
      }
      const d = res.data;
      if (d.date) setDate(d.date);
      if (d.fournisseur) setFournisseur(d.fournisseur);
      if (d.description) setDescription(d.description);
      if (d.reference) setReference(d.reference);
      if (typeof d.montantHT === "number") setMontantHT(d.montantHT);
      if (typeof d.montantTVA === "number") setMontantTVA(d.montantTVA);
      if (typeof d.montantTTC === "number") setMontantTTC(d.montantTTC);
      if (typeof d.tauxTVA === "number") setTauxTVA(d.tauxTVA);
      if (d.categorieSuggested) setCategorie(d.categorieSuggested);
      if (d.methodPaiementSuggested) setMethodPaiement(d.methodPaiementSuggested);
      setOcrUtilise(true);
      setOcrRawJson(res.raw ?? null);
      toast.success(
        "Champs pré-remplis. Vérifie avant d'enregistrer.",
      );
    } finally {
      setOcrRunning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (montantTTC <= 0) {
      toast.error("Le montant TTC doit être > 0.");
      return;
    }
    startTransition(async () => {
      const res = await createExpense({
        date: new Date(date),
        dateReglement: dateReglement ? new Date(dateReglement) : null,
        statutPaiement,
        categorie,
        fournisseur: fournisseur || null,
        description: description || null,
        reference: reference || null,
        montantHT,
        tauxTVA,
        montantTVA,
        montantTTC,
        tvaRecuperable,
        methodPaiement,
        prospectId: prospectId || null,
        ticketDataUrl,
        ticketName,
        ocrUtilise,
        ocrRawJson,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Charge enregistrée.");
      router.push("/charges");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo du ticket + OCR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Ticket / Justificatif
            {ocrUtilise && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <Icon name="Sparkles" className="h-3 w-3" />
                pré-rempli par IA
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files[0]);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted/50"
          >
            {ticketDataUrl && ticketDataUrl.startsWith("data:image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ticketDataUrl}
                alt="ticket"
                className="max-h-64 rounded-md border border-border"
              />
            ) : ticketName ? (
              <>
                <Icon name="FileText" className="h-6 w-6" />
                <p className="mt-2 text-sm font-medium">{ticketName}</p>
              </>
            ) : (
              <>
                <Icon
                  name="Upload"
                  className="h-6 w-6 text-muted-foreground"
                />
                <p className="mt-2 text-sm">
                  Glisse le ticket ici ou clique pour parcourir
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Photo (JPEG/PNG) ou PDF, max 6 MB
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {ticketDataUrl && ticketDataUrl.startsWith("data:image/") && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleOcr}
                disabled={ocrRunning}
              >
                <Icon
                  name={ocrRunning ? "Loader" : "Sparkles"}
                  className={`mr-1.5 h-4 w-4 ${ocrRunning ? "animate-spin" : ""}`}
                />
                {ocrRunning
                  ? "Lecture du ticket…"
                  : "Analyser le ticket (IA)"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Pré-remplit automatiquement date, fournisseur, montant et TVA.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Date *">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Catégorie *">
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
          </Field>
          <Field label="Fournisseur" full>
            <Input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Migros, Café du Commerce, Google Workspace…"
            />
          </Field>
          <Field label="N° ticket / facture">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Mode de paiement">
            <select
              value={methodPaiement}
              onChange={(e) => setMethodPaiement(e.target.value)}
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
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="">— Aucun (charge interne / frais généraux) —</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale} {p.statut !== "SIGNE" ? `(${p.statut})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Si la charge est 100 % attribuable à UN client (hébergement, sous-traitance dédiée…).
              Pour les charges multi-clients (Google Ads, freelance partagé), laisse vide
              et utilise l'onglet « Allocations » après création.
            </p>
          </Field>
          <Field label="Description" full>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Détails libres…"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Paiement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paiement & Réconciliation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Statut paiement">
            <select
              value={statutPaiement}
              onChange={(e) => setStatutPaiement(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              {STATUTS_PAIEMENT.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date de règlement (débit)">
            <Input
              type="date"
              value={dateReglement}
              onChange={(e) => setDateReglement(e.target.value)}
              placeholder="JJ/MM/AAAA"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Date à laquelle le montant a été débité du compte (visible sur le relevé).
              Laisser vide si pas encore payé.
            </p>
          </Field>
        </CardContent>
      </Card>

      {/* Montants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Montants (CHF)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Montant HT *">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={montantHT}
              onChange={(e) => {
                setOcrUtilise(false);
                setMontantHT(Number(e.target.value) || 0);
              }}
              required
            />
          </Field>
          <Field label="Taux TVA">
            <select
              value={tauxTVA}
              onChange={(e) => {
                setOcrUtilise(false);
                setTauxTVA(Number(e.target.value));
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value={0.077}>7.7 % (standard)</option>
              <option value={0.025}>2.5 % (alimentation)</option>
              <option value={0.038}>3.8 % (hôtellerie)</option>
              <option value={0}>0 % (exonéré)</option>
            </select>
          </Field>
          <Field label="Montant TVA">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={montantTVA}
              onChange={(e) => setMontantTVA(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Montant TTC *">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={montantTTC}
              onChange={(e) => setMontantTTC(Number(e.target.value) || 0)}
              required
            />
          </Field>

          <Field full label="">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tvaRecuperable}
                onChange={(e) => setTvaRecuperable(e.target.checked)}
                className="h-4 w-4"
              />
              TVA récupérable
            </label>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer la charge"}
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
