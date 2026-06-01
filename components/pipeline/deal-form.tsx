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

import { createDeal, updateDeal } from "@/app/(app)/pipeline/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCHF } from "@/lib/format";
import { DEAL_STAGE_PROBA_DEFAUT } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { DealStage } from "@prisma/client";

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface ProductOption {
  id: string;
  nom: string;
  categorie: string;
  type: string;
  prixOneShot: string | null;
  prixMensuel: string | null;
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

  // Montant prévu = total déduit des produits sélectionnés.
  // valeurAn1 = oneShot + mensuel × 12. Recalculé à chaque toggle.
  const { totalOneShot, totalMensuel, montantPrevu } = useMemo(() => {
    const selected = products.filter((p) => productIds.includes(p.id));
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
  }, [products, productIds]);

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
      toast.success(isEdit ? "Deal mis à jour." : "Deal créé.");
      router.push("/pipeline");
      router.refresh();
    });
  };

  // Groupement des produits par catégorie pour l'affichage
  const productsByCat = products.reduce<Record<string, ProductOption[]>>(
    (acc, p) => {
      const cat = p.categorie || "Autre";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    },
    {},
  );

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
            <select
              id="prospectId"
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              required
              disabled={isEdit}
            >
              <option value="">— Sélectionner un prospect —</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale}
                  {p.ville ? ` · ${p.ville}` : ""}
                </option>
              ))}
            </select>
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
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            Produits proposés
            {productIds.length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {productIds.length}
              </span>
            )}
          </CardTitle>
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

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun produit au catalogue. Ajoute-en depuis /catalogue.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(productsByCat).map(([cat, list]) => (
                <div key={cat}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat}
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
                            <p className="text-sm font-medium">{p.nom}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {p.prixOneShot && Number(p.prixOneShot) > 0
                                ? `${formatCHF(Number(p.prixOneShot))} one-shot`
                                : ""}
                              {p.prixOneShot &&
                                Number(p.prixOneShot) > 0 &&
                                p.prixMensuel &&
                                Number(p.prixMensuel) > 0 &&
                                " · "}
                              {p.prixMensuel && Number(p.prixMensuel) > 0
                                ? `${formatCHF(Number(p.prixMensuel))}/mois`
                                : ""}
                            </p>
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
                                placeholder="Détails / livrables / spécificités (apparaîtra sur le contrat et la facture)"
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
        <Button type="submit" disabled={pending}>
          {pending
            ? isEdit
              ? "Enregistrement…"
              : "Création…"
            : isEdit
              ? "Enregistrer les modifications"
              : "Créer le deal"}
        </Button>
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
