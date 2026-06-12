"use client";

/**
 * Formulaire Deal — création OU édition.
 *
 * Si `dealId` est fourni, mode édition : on appelle updateDeal.
 * Sinon mode création : createDeal.
 *
 * Inclut un picker produits multi-select avec prix affichés — essentiel
 * car la liste des produits du deal alimente directement la création du
 * contrat (cf. signDealInPerson).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createCustomProduct } from "@/app/(app)/catalogue/actions";
import { createDeal, updateDeal } from "@/app/(app)/pipeline/actions";
import { Icon } from "@/components/icon";
import { ProspectCombobox } from "@/components/prospects/prospect-combobox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF } from "@/lib/format";
import { DEAL_STAGE_PROBA_DEFAUT } from "@/lib/labels";
import { cn } from "@/lib/utils";

const CATEGORIE_LABELS: Record<string, string> = {
  SITE: "Sites web",
  RS: "Réseaux sociaux",
  SEO: "Référencement (SEO)",
  ADS: "Google Ads",
  CMO: "CMO externalisé",
  METRICOOL: "Outils",
  PACK: "Packs combinés",
};

import type { DealStage } from "@prisma/client";

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface ProductOption {
  id: string;
  nom: string;
  description?: string | null;
  categorie: string;
  type: string;
  prixOneShot: string | null;
  prixMensuel: string | null;
  prixVariable?: boolean;
  engagementMois?: number | null;
}

interface DealFormProps {
  prospects: ProspectOption[];
  products: ProductOption[];
  /** Si fourni → mode édition. */
  initial?: {
    id: string;
    prospectId: string;
    titre: string;
    description: string | null;
    montantPrevu: number;
    stage: DealStage;
    probabilite: number;
    closeAttenduLe: Date | null;
    productIds: string[];
    productNotes?: Record<string, string> | null;
  };
}

export function DealForm({ prospects, products, initial }: DealFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const isEdit = !!initial;

  const [prospectId, setProspectId] = useState(
    initial?.prospectId ?? searchParams.get("prospectId") ?? "",
  );
  // Libellé initial du prospect pré-sélectionné (pour le combobox).
  const initialProspectLabel = useMemo(() => {
    const pid = initial?.prospectId ?? searchParams.get("prospectId") ?? "";
    const p = prospects.find((x) => x.id === pid);
    return p ? `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}` : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [stage, setStage] = useState<DealStage>(initial?.stage ?? "DECOUVERTE");
  const [probabilite, setProbabilite] = useState(
    String(initial?.probabilite ?? DEAL_STAGE_PROBA_DEFAUT.DECOUVERTE),
  );
  const [closeAttenduLe, setCloseAttenduLe] = useState(
    initial?.closeAttenduLe
      ? new Date(initial.closeAttenduLe).toISOString().slice(0, 10)
      : "",
  );
  const [productIds, setProductIds] = useState<string[]>(
    initial?.productIds ?? [],
  );
  const [productNotes, setProductNotes] = useState<Record<string, string>>(
    initial?.productNotes ?? {},
  );
  const [productSearch, setProductSearch] = useState("");
  // Produits créés à la volée pendant l'édition du deal (non encore reflétés
  // côté props `products`). On les rajoute pour qu'ils apparaissent sélectionnés.
  const [localCustomProducts, setLocalCustomProducts] = useState<
    ProductOption[]
  >([]);

  // Catalogue effectif = produits passés en props + produits custom créés ici.
  // Dédup par id : si Next.js re-render la page (revalidatePath du serveur),
  // le custom product peut apparaître à la fois dans `products` ET dans
  // `localCustomProducts` → on évite le doublon de comptage.
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

  // Montant prévu = total déduit des produits sélectionnés.
  // valeurAn1 = oneShot + mensuel × 12. Recalculé à chaque toggle.
  const { totalOneShot, totalMensuel, montantPrevu } = useMemo(() => {
    const selected = allProducts.filter((p) => productIds.includes(p.id));
    let one = 0;
    let mens = 0;
    for (const p of selected) {
      if (p.prixOneShot) one += Number(p.prixOneShot);
      if (p.prixMensuel) mens += Number(p.prixMensuel);
    }
    return {
      totalOneShot: one,
      totalMensuel: mens,
      montantPrevu: one + mens * 12,
    };
  }, [allProducts, productIds]);

  const handleStageChange = (newStage: DealStage) => {
    setStage(newStage);
    setProbabilite(String(DEAL_STAGE_PROBA_DEFAUT[newStage]));
  };

  const toggleProduct = (id: string) => {
    setProductIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(false);
  };

  const submit = (thenContract: boolean) => {
    if (!prospectId) {
      toast.error("Sélectionne un prospect.");
      return;
    }
    if (!titre.trim()) {
      toast.error("Donne un titre au deal.");
      return;
    }
    if (productIds.length === 0 || montantPrevu <= 0) {
      toast.error("Sélectionne au moins un produit avec un prix.");
      return;
    }

    // Ne garde les notes que pour les produits actuellement sélectionnés,
    // et trim les valeurs vides.
    const filteredNotes: Record<string, string> = {};
    for (const pid of productIds) {
      const v = (productNotes[pid] ?? "").trim();
      if (v) filteredNotes[pid] = v;
    }

    const payload = {
      prospectId,
      titre: titre.trim(),
      description: description.trim() || undefined,
      montantPrevu,
      stage,
      probabilite: Number(probabilite),
      closeAttenduLe: closeAttenduLe ? new Date(closeAttenduLe) : undefined,
      productIds,
      productNotes: filteredNotes,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateDeal(initial!.id, payload)
        : await createDeal(payload);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      if (thenContract && !isEdit && res.dealId) {
        // Enchaîne directement sur le wizard de contrat (devise, modalités,
        // lignes, prix) pré-rempli avec ce deal.
        toast.success("Deal créé — passons au contrat.");
        router.push(`/contrats/nouveau?dealId=${res.dealId}`);
        router.refresh();
        return;
      }
      toast.success(isEdit ? "Deal mis à jour." : "Deal créé.");
      router.push("/pipeline");
      router.refresh();
    });
  };

  // Groupement des produits par catégorie pour l'affichage (filtré par recherche)
  const filteredProductsByCat = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const matchSearch = (p: ProductOption) => {
      if (!q) return true;
      return (
        p.nom.toLowerCase().includes(q) ||
        p.categorie.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    };
    const filtered = allProducts.filter(
      (p) => matchSearch(p) || productIds.includes(p.id),
    );
    return filtered.reduce<Record<string, ProductOption[]>>((acc, p) => {
      const cat = p.categorie || "Autre";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [allProducts, productSearch, productIds]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prospect & titre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prospectId">
              Prospect <span className="text-red-500">*</span>
            </Label>
            {isEdit ? (
              <input
                id="prospectId"
                value={initialProspectLabel}
                readOnly
                className="h-9 w-full rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground"
              />
            ) : (
              <ProspectCombobox
                id="prospectId"
                value={prospectId}
                initialLabel={initialProspectLabel}
                onSelect={(pid) => setProspectId(pid)}
              />
            )}
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                Le prospect ne peut pas être changé après création.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titre">
              Titre du deal <span className="text-red-500">*</span>
            </Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Pack Web Complet — démo prévue"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Contexte, besoins identifiés, points d'attention…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Produits proposés
            {productIds.length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {productIds.length}
              </span>
            )}
          </CardTitle>
          <CustomProductButton
            onCreated={(newProduct) => {
              // Ajoute le produit créé dans la liste locale + le sélectionne.
              // Guards anti-doublon : si onCreated est rappelé (double-click,
              // retry, etc.) on n'empile pas le même id deux fois.
              setLocalCustomProducts((prev) =>
                prev.some((p) => p.id === newProduct.id)
                  ? prev
                  : [...prev, newProduct],
              );
              setProductIds((prev) =>
                prev.includes(newProduct.id) ? prev : [...prev, newProduct.id],
              );
            }}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ces produits déterminent automatiquement le montant du deal et
            seront repris comme lignes du contrat lors de la signature.
          </p>

          {/* Récap montant calculé en direct */}
          {productIds.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Montant prévu (valeur 1 an)
                </p>
                <p className="text-2xl font-semibold tabular-nums text-primary">
                  {formatCHF(montantPrevu)}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {totalOneShot > 0 && `${formatCHF(totalOneShot)} one-shot`}
                {totalOneShot > 0 && totalMensuel > 0 && " + "}
                {totalMensuel > 0 &&
                  `${formatCHF(totalMensuel)}/mois × 12 = ${formatCHF(totalMensuel * 12)}`}
              </p>
            </div>
          )}

          {/* Recherche */}
          {products.length > 0 && (
            <Input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Rechercher dans le catalogue (nom, catégorie, description)…"
              className="text-sm"
            />
          )}

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun produit au catalogue. Ajoute-en depuis /catalogue ou
              clique sur &quot;+ Produit sur-mesure&quot;.
            </p>
          ) : Object.keys(filteredProductsByCat).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun produit ne correspond à &quot;{productSearch}&quot;.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(filteredProductsByCat).map(([cat, list]) => (
                <div key={cat}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORIE_LABELS[cat] ?? cat}
                  </p>
                  <div className="space-y-1.5">
                    {list.map((p) => {
                      const isChecked = productIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors",
                            isChecked
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleProduct(p.id)}
                            className="mt-0.5 h-4 w-4 rounded border-input"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="text-sm font-medium">{p.nom}</p>
                              {p.engagementMois ? (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-medium text-blue-800">
                                  Engagement {p.engagementMois} mois
                                </span>
                              ) : null}
                              {p.prixVariable ? (
                                <span
                                  className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-medium text-amber-800"
                                  title="Prix de base — peut être ajusté lors de la signature du contrat selon le périmètre exact."
                                >
                                  ✏️ Prix sur-mesure
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {p.prixOneShot && Number(p.prixOneShot) > 0
                                ? `${p.prixVariable ? "dès " : ""}${formatCHF(Number(p.prixOneShot))} one-shot`
                                : ""}
                              {p.prixOneShot &&
                                Number(p.prixOneShot) > 0 &&
                                p.prixMensuel &&
                                Number(p.prixMensuel) > 0 &&
                                " · "}
                              {p.prixMensuel && Number(p.prixMensuel) > 0
                                ? `${p.prixVariable ? "dès " : ""}${formatCHF(Number(p.prixMensuel))}/mois`
                                : ""}
                            </p>
                            {p.description && !isChecked && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                                {p.description}
                              </p>
                            )}
                            {isChecked && (
                              <textarea
                                value={productNotes[p.id] ?? ""}
                                onChange={(e) =>
                                  setProductNotes((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder={
                                  p.prixVariable
                                    ? "Précise le périmètre + prix négocié avec le client (sera repris sur le contrat / la facture)"
                                    : "Détails / livrables / spécificités (apparaîtra sur le contrat et la facture)"
                                }
                                rows={2}
                                className="mt-2 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {(
                [
                  "DECOUVERTE",
                  "PROPOSITION",
                  "NEGOCIATION",
                  "SIGNE",
                  "PERDU",
                ] as DealStage[]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStageChange(s)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs",
                    stage === s
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="probabilite">Probabilité (%)</Label>
              <Input
                id="probabilite"
                type="number"
                min={0}
                max={100}
                value={probabilite}
                onChange={(e) => setProbabilite(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Pondère le pipeline. Recalculée à chaque changement de stage.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="closeAttenduLe">Close attendu le</Label>
              <Input
                id="closeAttenduLe"
                type="date"
                value={closeAttenduLe}
                onChange={(e) => setCloseAttenduLe(e.target.value)}
              />
            </div>
          </div>

          {/* Rappel du montant calculé pour ne pas oublier de cocher les produits */}
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Montant du deal :</span>{" "}
            {productIds.length === 0 ? (
              <span className="text-amber-700">
                — sélectionne au moins un produit ci-dessus
              </span>
            ) : (
              <span className="font-semibold text-primary tabular-nums">
                {formatCHF(montantPrevu)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending} variant={isEdit ? "default" : "outline"}>
          {pending
            ? isEdit
              ? "Enregistrement…"
              : "Création…"
            : isEdit
              ? "Enregistrer les modifications"
              : "Créer le deal"}
        </Button>
        {!isEdit && (
          <Button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
          >
            {pending
              ? "Création…"
              : "Créer + faire le contrat (devise, modalités…)"}
          </Button>
        )}
      </div>
    </form>
  );
}

const STAGE_LABELS: Record<DealStage, string> = {
  DECOUVERTE: "Découverte",
  PROPOSITION: "Proposition",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé",
  PERDU: "Perdu",
};

// ===========================================================================
// CustomProductButton — modal pour créer un produit sur-mesure à la volée
// ===========================================================================

interface CustomProductButtonProps {
  onCreated: (p: ProductOption) => void;
}

function CustomProductButton({ onCreated }: CustomProductButtonProps) {
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
      toast.error("Renseigne au moins un prix (one-shot ou mensuel).");
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
      toast.success(`"${nom.trim()}" ajouté au deal ✓`);
      // Construit l'objet ProductOption pour insertion locale
      onCreated({
        id: res.productId,
        nom: nom.trim(),
        description: description.trim()
          ? `[Custom] ${description.trim()}`
          : "[Custom] Produit sur-mesure créé depuis un deal.",
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
            Crée un produit non présent au catalogue. Il sera ajouté au deal et
            persisté pour pouvoir être réutilisé. L&apos;admin pourra le
            désactiver depuis /catalogue si besoin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cp-nom">
              Nom <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cp-nom"
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Refonte branding + charte graphique"
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-categorie">Catégorie</Label>
            <select
              id="cp-categorie"
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
              <Label htmlFor="cp-oneshot">Prix one-shot (CHF)</Label>
              <Input
                id="cp-oneshot"
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
              <Label htmlFor="cp-mensuel">Prix mensuel (CHF)</Label>
              <Input
                id="cp-mensuel"
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
            Au moins un des deux prix est obligatoire. Tu peux laisser
            l&apos;autre vide.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="cp-description">Description (optionnelle)</Label>
            <textarea
              id="cp-description"
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
              {pending ? "Création…" : "Ajouter au deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
