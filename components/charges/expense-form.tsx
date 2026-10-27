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
import {
  Calculator,
  Camera,
  CreditCard,
  FileText,
  Loader2,
  Sparkles,
  Tag,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  analyzeReceiptOcr,
  createExpense,
} from "@/app/(app)/charges/actions";
import { SectionCard } from "@/components/arena/section-card";
import { StatusPill } from "@/components/arena/pills";
import { FormField } from "@/components/common/form-field";
import {
  CHECKBOX_CLASS,
  FIELD_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/format";

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

/** TVA arrondie au centime (même calcul que l'ancien effet de recalcul). */
function tvaOf(ht: number, taux: number): number {
  return Math.round(ht * taux * 100) / 100;
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
  const [dragOver, setDragOver] = useState(false);

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

  // Recalcul TVA/TTC quand l'utilisateur change le HT ou le taux. Fait dans
  // les gestionnaires (et non dans un effet) : la saisie manuelle désactive
  // l'état « pré-rempli par l'IA », exactement comme avant.
  const changeHT = (v: number) => {
    setOcrUtilise(false);
    setMontantHT(v);
    const tva = tvaOf(v, tauxTVA);
    setMontantTVA(tva);
    setMontantTTC(v + tva);
  };
  const changeTaux = (t: number) => {
    setOcrUtilise(false);
    setTauxTVA(t);
    const tva = tvaOf(montantHT, t);
    setMontantTVA(tva);
    setMontantTTC(montantHT + tva);
  };

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

  const isImage = !!ticketDataUrl && ticketDataUrl.startsWith("data:image/");

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo du ticket + OCR */}
      <SectionCard
        title="Ticket / justificatif"
        description="Photo (JPEG/PNG) ou PDF, max 6 MB"
        icon={Camera}
        tone="violet"
        action={
          ocrUtilise ? (
            <StatusPill tone="violet" icon={Sparkles}>
              Pré-rempli par l&apos;IA
            </StatusPill>
          ) : undefined
        }
      >
        <label
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed px-4 py-7 text-center transition-colors focus-within:border-navy-700 focus-within:ring-4 focus-within:ring-navy-100 ${
            dragOver
              ? "border-lvl-500 bg-lvl-50"
              : "border-border-strong bg-ground hover:bg-navy-50"
          }`}
        >
          {isImage && ticketDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticketDataUrl}
              alt="Aperçu du ticket"
              className="max-h-64 rounded-[12px] border border-border"
            />
          ) : ticketName ? (
            <>
              <FileText aria-hidden="true" className="size-7 text-lvl-700" />
              <span className="mt-2 text-sm font-bold">{ticketName}</span>
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-[14px] bg-card text-lvl-700 shadow-arena"
              >
                <Upload className="size-5" />
              </span>
              <span className="mt-3 text-sm font-bold">
                Glisse le ticket ici ou clique pour parcourir
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Photo (JPEG/PNG) ou PDF, max 6 MB
              </span>
            </>
          )}
          <span className="sr-only">Choisir le fichier du ticket</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {isImage && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleOcr}
              disabled={ocrRunning}
            >
              {ocrRunning ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" className="text-lvl-700" />
              )}
              {ocrRunning
                ? "Lecture du ticket…"
                : "Analyser le ticket (IA)"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Pré-remplit automatiquement date, fournisseur, montant et TVA.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Identification */}
      <SectionCard title="Identification" icon={Tag} tone="navy">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" required>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
          <FormField label="Fournisseur" className="sm:col-span-2">
            <Input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Migros, Café du Commerce, Google Workspace…"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="N° ticket / facture">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Mode de paiement">
            <select
              value={methodPaiement}
              onChange={(e) => setMethodPaiement(e.target.value)}
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
              <>
                Si la charge est 100 % attribuable à UN client (hébergement,
                sous-traitance dédiée…). Pour les charges multi-clients (Google
                Ads, freelance partagé), laisse vide et utilise le bloc
                « Allocations » après création.
              </>
            }
          >
            <select
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Aucun (charge interne / frais généraux)</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale} {p.statut !== "SIGNE" ? `(${p.statut})` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={TEXTAREA_CLASS}
              placeholder="Détails libres…"
            />
          </FormField>
        </div>
      </SectionCard>

      {/* Paiement */}
      <SectionCard title="Paiement et réconciliation" icon={CreditCard} tone="gold">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Statut paiement">
            <select
              value={statutPaiement}
              onChange={(e) => setStatutPaiement(e.target.value)}
              className={SELECT_CLASS}
            >
              {STATUTS_PAIEMENT.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Date de règlement (débit)"
            hint="Date à laquelle le montant a été débité du compte (visible sur le relevé). Laisser vide si pas encore payé."
          >
            <Input
              type="date"
              value={dateReglement}
              onChange={(e) => setDateReglement(e.target.value)}
              placeholder="JJ/MM/AAAA"
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
      </SectionCard>

      {/* Montants */}
      <SectionCard
        title="Montants (CHF)"
        icon={Calculator}
        tone="green"
        action={
          <span className="text-sm font-semibold text-muted-foreground">
            TTC{" "}
            <strong className="font-display text-lg font-extrabold text-foreground tabular-nums">
              {formatCHF(montantTTC)}
            </strong>
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Montant HT" required>
            <Input
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={montantHT}
              onChange={(e) => changeHT(Number(e.target.value) || 0)}
              required
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Taux TVA">
            <select
              value={tauxTVA}
              onChange={(e) => changeTaux(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              <option value={0.077}>7.7 % (standard)</option>
              <option value={0.025}>2.5 % (alimentation)</option>
              <option value={0.038}>3.8 % (hôtellerie)</option>
              <option value={0}>0 % (exonéré)</option>
            </select>
          </FormField>
          <FormField label="Montant TVA">
            <Input
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={montantTVA}
              onChange={(e) => setMontantTVA(Number(e.target.value) || 0)}
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
          <FormField label="Montant TTC" required>
            <Input
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={montantTTC}
              onChange={(e) => setMontantTTC(Number(e.target.value) || 0)}
              required
              className={`${FIELD_CLASS} tabular-nums`}
            />
          </FormField>
        </div>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={tvaRecuperable}
            onChange={(e) => setTvaRecuperable(e.target.checked)}
            className={CHECKBOX_CLASS}
          />
          TVA récupérable
        </label>
      </SectionCard>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
        >
          Annuler
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {pending ? "Enregistrement…" : "Enregistrer la charge"}
        </Button>
      </div>
    </form>
  );
}
