"use client";

/**
 * Wizard de création de contrat — 4 étapes en cartes empilées.
 *
 * Étape 1 : sélection prospect (pré-rempli si ?prospectId= ou ?dealId=)
 * Étape 2 : lignes de produits (multi-add, quantité, override prix)
 * Étape 3 : modalité paiement + dates
 * Étape 4 : récap commission + bouton Créer
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createCustomProduct } from "@/app/(app)/catalogue/actions";
import {
  createContractFromDeal,
  updateContract,
} from "@/app/(app)/contrats/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icon";
import { ProspectCombobox } from "@/components/prospects/prospect-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ModalitePaiement } from "@prisma/client";

const CATEGORIE_LABELS: Record<string, string> = {
  SITE: "Sites web",
  RS: "Réseaux sociaux",
  SEO: "SEO",
  ADS: "Google Ads",
  CMO: "CMO",
  METRICOOL: "Outils",
  PACK: "Packs",
};

interface ProductOption {
  id: string;
  nom: string;
  description?: string | null;
  categorie?: string;
  type: string;
  prixOneShot: string | null;
  prixMensuel: string | null;
  prixVariable?: boolean;
  engagementMois?: number | null;
}

interface DealOption {
  id: string;
  titre: string;
  montantPrevu: string;
  prospectId: string;
}

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

/** Valeurs initiales pour le mode édition (contrat existant non signé). */
interface ContractEditInitial {
  contractId: string;
  numero: string;
  prospectId: string;
  dealId: string;
  dateSignature: string; // ISO yyyy-mm-dd
  dateDebut: string;
  dureeMois: string;
  modalitePaiement: ModalitePaiement;
  devise?: "CHF" | "EUR";
  lines: LineState[];
}

interface ContractWizardProps {
  prospects: ProspectOption[];
  deals: DealOption[];
  products: ProductOption[];
  tauxCommission: number;
  /** Si fourni → mode édition (met à jour le contrat au lieu d'en créer un). */
  initial?: ContractEditInitial;
}

interface LineState {
  id: string; // identifiant local
  productId: string;
  quantite: number;
  prixOneShot: string; // string pour input
  prixMensuel: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function todayLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ContractWizard({
  prospects,
  deals,
  products,
  tauxCommission,
  initial,
}: ContractWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const isEdit = !!initial;

  const initialDealId = initial?.dealId ?? searchParams.get("dealId") ?? "";
  const initialDeal = deals.find((d) => d.id === initialDealId);
  const initialProspectId =
    initial?.prospectId ??
    initialDeal?.prospectId ??
    searchParams.get("prospectId") ??
    "";

  // ---- État du wizard ----
  const [prospectId, setProspectId] = useState(initialProspectId);
  const [dealId, setDealId] = useState(initialDealId);

  const [lines, setLines] = useState<LineState[]>(initial?.lines ?? []);

  const [dateSignature, setDateSignature] = useState(
    initial?.dateSignature ?? todayLocalIso(),
  );
  const [dateDebut, setDateDebut] = useState(
    initial?.dateDebut ?? todayLocalIso(),
  );
  const [dureeMois, setDureeMois] = useState(initial?.dureeMois ?? "12");
  // En édition, la durée vient du contrat → on bloque la suggestion auto.
  const [dureeMoisManuallyEdited, setDureeMoisManuallyEdited] =
    useState(isEdit);
  const [modalitePaiement, setModalitePaiement] = useState<ModalitePaiement>(
    initial?.modalitePaiement ?? "CINQUANTE_CINQUANTE",
  );
  // Devise : AUTO = détection selon le pays du client (Suisse → CHF, sinon EUR)
  const [devise, setDevise] = useState<"AUTO" | "CHF" | "EUR">(
    initial?.devise ?? "AUTO",
  );
  // Formate les montants du contrat dans la devise choisie (AUTO → CHF à
  // l'affichage ; la devise réelle sera déterminée côté serveur).
  const fmt = (n: number) => formatMoney(n, devise === "EUR" ? "EUR" : "CHF");

  // Produits "sur-mesure" créés à la volée pendant le wizard
  const [localCustomProducts, setLocalCustomProducts] = useState<
    ProductOption[]
  >([]);
  // Dédup par id : sur Next.js 16, `revalidatePath("/catalogue")` peut
  // invalider les caches React qui touchent prisma.product.findMany — un
  // re-render serveur ramène alors le custom dans `products`, ET il est
  // déjà dans `localCustomProducts` → doublon dans les totaux. La dédup
  // par id empêche que le même produit soit comptabilisé deux fois.
  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    const result: ProductOption[] = [];
    for (const p of [...products, ...localCustomProducts]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    }
    return result;
  }, [products, localCustomProducts]);

  // Auto-suggère la durée du contrat = MAX des engagements minimum des
  // produits sélectionnés. Logique : si une ligne est engagée 24 mois et
  // une autre 12 mois, le contrat doit courir au moins 24 mois (sinon on
  // viole l'engagement du produit le plus long). L'utilisateur peut
  // toujours modifier — `dureeMoisManuallyEdited` désactive la suggestion.
  useEffect(() => {
    if (dureeMoisManuallyEdited) return;
    let maxEngagement = 0;
    for (const l of lines) {
      const prod = allProducts.find((p) => p.id === l.productId);
      if (prod?.engagementMois && prod.engagementMois > maxEngagement) {
        maxEngagement = prod.engagementMois;
      }
    }
    if (maxEngagement > 0) {
      setDureeMois(String(maxEngagement));
    }
  }, [lines, allProducts, dureeMoisManuallyEdited]);

  // Si on change le deal, on synchronise le prospect
  useEffect(() => {
    if (dealId) {
      const d = deals.find((dd) => dd.id === dealId);
      if (d && d.prospectId !== prospectId) {
        setProspectId(d.prospectId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // ---- Calculs live (étape 4 récap) ----
  const calc = useMemo(() => {
    let oneShot = 0;
    let mensuel = 0;
    for (const l of lines) {
      const prod = allProducts.find((p) => p.id === l.productId);
      if (!prod) continue;
      const po =
        l.prixOneShot !== ""
          ? Number(l.prixOneShot)
          : prod.prixOneShot
            ? Number(prod.prixOneShot)
            : 0;
      const pm =
        l.prixMensuel !== ""
          ? Number(l.prixMensuel)
          : prod.prixMensuel
            ? Number(prod.prixMensuel)
            : 0;
      oneShot += po * l.quantite;
      mensuel += pm * l.quantite;
    }
    // Valeur an 1 affichée = formule historique (× 12), indépendante de
    // la catégorie. Reflète la colonne DB `contract.valeurAn1`.
    const valeurAn1 = oneShot + mensuel * 12;

    // Assiette COMMISSION = règle hybride par ligne (cohérente avec
    // computeAssietteCommissionContrat côté serveur) :
    //   - Ligne ADS    → oneShot + mensuel × dureeMois (sans cap)
    //   - Ligne autres → oneShot + mensuel × 12        (cap an 1)
    const dureeMoisNum = Math.max(Number(dureeMois) || 12, 1);
    let assietteCommission = 0;
    let hasAdsLine = false;
    let hasNonAdsLine = false;
    for (const l of lines) {
      const prod = allProducts.find((p) => p.id === l.productId);
      if (!prod) continue;
      const po =
        l.prixOneShot !== ""
          ? Number(l.prixOneShot)
          : prod.prixOneShot
            ? Number(prod.prixOneShot)
            : 0;
      const pm =
        l.prixMensuel !== ""
          ? Number(l.prixMensuel)
          : prod.prixMensuel
            ? Number(prod.prixMensuel)
            : 0;
      const lineOneShot = po * l.quantite;
      const lineMensuel = pm * l.quantite;
      if (prod.categorie === "ADS") {
        assietteCommission += lineOneShot + lineMensuel * dureeMoisNum;
        hasAdsLine = true;
      } else {
        assietteCommission += lineOneShot + lineMensuel * 12;
        hasNonAdsLine = true;
      }
    }

    const commissionTotale = assietteCommission * tauxCommission;
    const commissionPart1 = commissionTotale / 2;
    const commissionPart2 = commissionTotale / 2;
    return {
      oneShot,
      mensuel,
      valeurAn1,
      assietteCommission,
      hasAdsLine,
      hasNonAdsLine,
      dureeMoisNum,
      commissionTotale,
      commissionPart1,
      commissionPart2,
    };
  }, [lines, allProducts, tauxCommission, dureeMois]);

  // ---- Mutations ----
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: uid(), productId: "", quantite: 1, prixOneShot: "", prixMensuel: "" },
    ]);
  };

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const updateLine = (id: string, patch: Partial<LineState>) =>
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );

  const canSubmit =
    prospectId !== "" &&
    lines.length > 0 &&
    lines.every((l) => l.productId !== "") &&
    Number(dureeMois) > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error("Complète les sections en rouge.");
      return;
    }
    const payload = {
      prospectId,
      dealId: dealId || undefined,
      dateSignature: new Date(dateSignature),
      dateDebut: new Date(dateDebut),
      dureeMois: Number(dureeMois),
      modalitePaiement,
      devise: devise === "AUTO" ? undefined : devise,
      lines: lines.map((l) => ({
        productId: l.productId,
        quantite: l.quantite,
        prixOneShot: l.prixOneShot ? Number(l.prixOneShot) : undefined,
        prixMensuel: l.prixMensuel ? Number(l.prixMensuel) : undefined,
      })),
    };
    startTransition(async () => {
      const res = initial
        ? await updateContract(initial.contractId, payload)
        : await createContractFromDeal(payload);
      if (!res.ok) {
        toast.error(
          res.error ?? (initial ? "Échec de l'enregistrement." : "Échec de la création."),
        );
        return;
      }
      toast.success(
        initial ? `Contrat ${res.numero} mis à jour !` : `Contrat ${res.numero} créé !`,
      );
      router.push(`/contrats/${res.contractId}`);
      router.refresh();
    });
  };

  // ---- Filtre deals visibles selon prospect ----
  const dealsForProspect = prospectId
    ? deals.filter((d) => d.prospectId === prospectId)
    : deals;

  return (
    <div className="space-y-6">
      {/* ÉTAPE 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <StepBadge n={1} done={prospectId !== ""} /> Prospect & deal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prospectId">
              Prospect <span className="text-red-500">*</span>
            </Label>
            <ProspectCombobox
              id="prospectId"
              value={prospectId}
              initialLabel={(() => {
                const p = prospects.find((x) => x.id === prospectId);
                return p
                  ? `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}`
                  : "";
              })()}
              onSelect={(pid) => {
                setProspectId(pid);
                setDealId("");
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dealId">Deal d&apos;origine (optionnel)</Label>
            <select
              id="dealId"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              disabled={!prospectId}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:opacity-50"
            >
              <option value="">— Sans deal —</option>
              {dealsForProspect.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.titre} · {formatCHF(Number(d.montantPrevu))}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Si fourni, le deal passera automatiquement en stage Signé.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ÉTAPE 2 */}
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            <StepBadge n={2} done={lines.length > 0 && lines.every((l) => l.productId)} />
            {" "}Lignes du contrat
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <CustomProductButtonContract
              onCreated={(newProduct) => {
                // Anti-doublon : ne pas pousser deux fois le même id si
                // onCreated est rappelé (double-click, retry, etc.).
                setLocalCustomProducts((prev) =>
                  prev.some((p) => p.id === newProduct.id)
                    ? prev
                    : [...prev, newProduct],
                );
                // Crée une ligne pré-sélectionnée seulement si aucune
                // ligne existante ne référence déjà ce produit.
                setLines((prev) =>
                  prev.some((l) => l.productId === newProduct.id)
                    ? prev
                    : [
                        ...prev,
                        {
                          id: uid(),
                          productId: newProduct.id,
                          quantite: 1,
                          prixOneShot: "",
                          prixMensuel: "",
                        },
                      ],
                );
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              + Ajouter une ligne
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Ajoute au moins une ligne (produit ou pack du catalogue, ou crée
              un produit sur-mesure).
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  products={allProducts}
                  onChange={(patch) => updateLine(line.id, patch)}
                  onRemove={() => removeLine(line.id)}
                />
              ))}
              <div className="flex justify-end pt-2 text-xs text-muted-foreground tabular-nums">
                Sous-total : {fmt(calc.oneShot)} one-shot ·{" "}
                {fmt(calc.mensuel)}/mois
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ÉTAPE 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <StepBadge n={3} done={true} /> Modalités
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Modalité de paiement</Label>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {(
                [
                  {
                    value: "CINQUANTE_CINQUANTE",
                    label: "50 / 50",
                    desc: "Acompte signature + solde livraison",
                  },
                  {
                    value: "CENT_AU_SIGNING",
                    label: "100 % signature",
                    desc: "Tout réglé à la signature",
                  },
                  {
                    value: "MENSUEL",
                    label: "Mensuel",
                    desc: "12 mensualités successives",
                  },
                ] as { value: ModalitePaiement; label: string; desc: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModalitePaiement(opt.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm",
                    modalitePaiement === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Devise</Label>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {(
                [
                  {
                    value: "AUTO",
                    label: "Auto",
                    desc: "Selon le pays du client (Suisse → CHF, sinon EUR)",
                  },
                  { value: "CHF", label: "CHF", desc: "Franc suisse" },
                  { value: "EUR", label: "€ EUR", desc: "Euro" },
                ] as { value: "AUTO" | "CHF" | "EUR"; label: string; desc: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDevise(opt.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm",
                    devise === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateSignature">Date de signature</Label>
              <Input
                id="dateSignature"
                type="date"
                value={dateSignature}
                onChange={(e) => setDateSignature(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateDebut">Date de début</Label>
              <Input
                id="dateDebut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dureeMois">Durée (mois)</Label>
              <Input
                id="dureeMois"
                type="number"
                min={1}
                max={60}
                value={dureeMois}
                onChange={(e) => {
                  setDureeMois(e.target.value);
                  setDureeMoisManuallyEdited(true);
                }}
              />
              {!dureeMoisManuallyEdited && lines.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Suggéré automatiquement depuis l&apos;engagement minimum du produit.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ÉTAPE 4 — Récap */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">
            <StepBadge n={4} done={canSubmit} /> Récap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <RecapLine
              label="One-shot"
              value={fmt(calc.oneShot)}
            />
            <RecapLine
              label="Récurrent mensuel"
              value={`${fmt(calc.mensuel)} / mois`}
            />
            <RecapLine
              label="Valeur an 1"
              value={fmt(calc.valeurAn1)}
              big
            />
            <RecapLine
              label={`Commission totale (${(tauxCommission * 100).toFixed(0)} %)`}
              value={fmt(calc.commissionTotale)}
              big
            />
          </div>

          {calc.hasAdsLine && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <strong>Règle ADS appliquée</strong> — les lignes Google Ads /
              Meta Ads commissionnent sur le revenu réel ACLR pendant la
              durée du contrat ({calc.dureeMoisNum} mois), sans extrapolation
              sur 12 mois.
              {calc.hasNonAdsLine ? (
                <>
                  {" "}
                  Les autres lignes restent sur l&apos;assiette an 1
                  classique (× 12 mois).
                </>
              ) : null}
              {" "}Assiette commission : <strong>{fmt(calc.assietteCommission)}</strong>.
            </p>
          )}

          <div className="mt-4 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">
              Cascade automatique à la création :
            </p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li>
                Numéro contrat séquentiel (ex. <code className="rounded bg-muted px-1">ACLR-{new Date().getFullYear()}-XXXX</code>)
              </li>
              <li>
                Commission {fmt(calc.commissionTotale)} en{" "}
                <strong>2 parts</strong> : {fmt(calc.commissionPart1)} à la
                signature + {fmt(calc.commissionPart2)} étalé sur 11 mois
              </li>
              <li>
                Factures clients (selon modalité {modalitePaiement.replace(/_/g, " ")})
              </li>
              <li>Prospect → statut <strong>Signé</strong></li>
              {dealId && <li>Deal → stage <strong>Signé</strong></li>}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || pending}
            >
              {pending
                ? isEdit
                  ? "Enregistrement…"
                  : "Création…"
                : isEdit
                  ? `Enregistrer les modifications (${fmt(calc.valeurAn1)})`
                  : `Créer le contrat (${fmt(calc.valeurAn1)})`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        "mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
        done
          ? "bg-emerald-500 text-white"
          : "bg-slate-200 text-slate-600",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}

function LineRow({
  line,
  products,
  onChange,
  onRemove,
}: {
  line: LineState;
  products: ProductOption[];
  onChange: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}) {
  const prod = products.find((p) => p.id === line.productId);
  const defaultOneShot = prod?.prixOneShot ? Number(prod.prixOneShot) : 0;
  const defaultMensuel = prod?.prixMensuel ? Number(prod.prixMensuel) : 0;

  // Groupement par catégorie dans le select (pour catalogue large)
  const productsByCat = useMemo(() => {
    return products.reduce<Record<string, ProductOption[]>>((acc, p) => {
      const cat = p.categorie || "AUTRE";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [products]);

  return (
    <div className="grid grid-cols-12 gap-2 rounded-md border border-border bg-card px-3 py-2">
      <div className="col-span-12 md:col-span-5">
        <select
          value={line.productId}
          onChange={(e) => onChange({ productId: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value="">— Choisir un produit —</option>
          {Object.entries(productsByCat).map(([cat, list]) => (
            <optgroup key={cat} label={CATEGORIE_LABELS[cat] ?? cat}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                  {p.prixVariable ? " (prix sur-mesure)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {prod && (
          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
            {prod.engagementMois ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0 font-medium text-blue-800">
                Engagement {prod.engagementMois} mois
              </span>
            ) : null}
            {prod.prixVariable ? (
              <span
                className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0 font-medium text-amber-800"
                title="Prix de base éditable — ajuste-le à droite selon le périmètre négocié."
              >
                ✏️ Prix sur-mesure
              </span>
            ) : null}
            {prod.description && (
              <p className="w-full text-[10px] text-muted-foreground line-clamp-2">
                {prod.description}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="col-span-3 md:col-span-1">
        <Input
          type="number"
          min={0.01}
          step="0.5"
          value={line.quantite}
          onChange={(e) =>
            onChange({ quantite: Number(e.target.value) || 1 })
          }
          className="text-center"
        />
      </div>

      <div className="col-span-4 md:col-span-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={line.prixOneShot}
          onChange={(e) => onChange({ prixOneShot: e.target.value })}
          placeholder={`${defaultOneShot}`}
          className="text-right tabular-nums"
        />
      </div>

      <div className="col-span-4 md:col-span-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={line.prixMensuel}
          onChange={(e) => onChange({ prixMensuel: e.target.value })}
          placeholder={`${defaultMensuel}`}
          className="text-right tabular-nums"
        />
      </div>

      <div className="col-span-1 flex items-center justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          aria-label="Supprimer la ligne"
          title="Supprimer"
        >
          <Icon name="LogOut" className="h-4 w-4 rotate-180" />
        </button>
      </div>

      {line.productId === "" && (
        <p className="col-span-12 text-[11px] text-red-600">
          Sélectionne un produit.
        </p>
      )}
    </div>
  );
}

// ===========================================================================
// CustomProductButtonContract — réplique de celui du DealForm
// ===========================================================================

interface CustomProductButtonContractProps {
  onCreated: (p: ProductOption) => void;
}

function CustomProductButtonContract({
  onCreated,
}: CustomProductButtonContractProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [prixOneShot, setPrixOneShot] = useState("");
  const [prixMensuel, setPrixMensuel] = useState("");
  const [categorie, setCategorie] = useState<
    "SITE" | "RS" | "SEO" | "ADS" | "CMO" | "METRICOOL" | "PACK"
  >("SITE");

  const reset = () => {
    setNom("");
    setDescription("");
    setPrixOneShot("");
    setPrixMensuel("");
    setCategorie("SITE");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error("Donne un nom au produit.");
      return;
    }
    const one = prixOneShot ? Number(prixOneShot) : undefined;
    const mens = prixMensuel ? Number(prixMensuel) : undefined;
    if (!one && !mens) {
      toast.error("Renseigne au moins un prix.");
      return;
    }
    startTransition(async () => {
      const res = await createCustomProduct({
        nom: nom.trim(),
        description: description.trim() || undefined,
        prixOneShot: one,
        prixMensuel: mens,
        categorie,
      });
      if (!res.ok || !res.productId) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`"${nom.trim()}" ajouté au contrat ✓`);
      onCreated({
        id: res.productId,
        nom: nom.trim(),
        description: description.trim()
          ? `[Custom] ${description.trim()}`
          : "[Custom] Produit sur-mesure créé depuis un contrat.",
        categorie,
        type: mens && !one ? "RECURRENT_MENSUEL" : "ONE_SHOT",
        prixOneShot: one ? String(one) : null,
        prixMensuel: mens ? String(mens) : null,
        prixVariable: false,
        engagementMois: null,
      });
      reset();
      setOpen(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border bg-background px-2.5 text-xs font-medium hover:border-primary hover:bg-primary/5 hover:text-primary">
        <Icon name="Plus" className="h-3.5 w-3.5" />
        Produit sur-mesure
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Produit sur-mesure</DialogTitle>
          <DialogDescription>
            Crée un produit non présent au catalogue. Il sera ajouté comme
            ligne du contrat et persisté pour pouvoir être réutilisé.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cpc-nom">
              Nom <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cpc-nom"
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Refonte branding + charte graphique"
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cpc-categorie">Catégorie</Label>
            <select
              id="cpc-categorie"
              value={categorie}
              onChange={(e) =>
                setCategorie(e.target.value as typeof categorie)
              }
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="SITE">Sites web</option>
              <option value="RS">Réseaux sociaux</option>
              <option value="SEO">SEO</option>
              <option value="ADS">Google Ads</option>
              <option value="CMO">CMO externalisé</option>
              <option value="PACK">Pack</option>
              <option value="METRICOOL">Outils / Autre</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpc-oneshot">Prix one-shot (CHF)</Label>
              <Input
                id="cpc-oneshot"
                type="number"
                min={0}
                step="0.01"
                value={prixOneShot}
                onChange={(e) => setPrixOneShot(e.target.value)}
                placeholder="0"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpc-mensuel">Prix mensuel (CHF)</Label>
              <Input
                id="cpc-mensuel"
                type="number"
                min={0}
                step="0.01"
                value={prixMensuel}
                onChange={(e) => setPrixMensuel(e.target.value)}
                placeholder="0"
                disabled={pending}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Au moins un des deux prix est obligatoire.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="cpc-description">Description (optionnelle)</Label>
            <textarea
              id="cpc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Détails du périmètre, livrables…"
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Ajouter au contrat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecapLine({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 tabular-nums",
          big ? "text-xl font-semibold" : "text-sm",
        )}
      >
        {value}
      </p>
    </div>
  );
}
