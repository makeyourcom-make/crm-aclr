"use client";

import { Check, CircleDollarSign, Layers, Loader2, Lock, Shapes, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProduct, updateProduct } from "@/app/(app)/catalogue/actions";
import { SectionCard } from "@/components/arena/section-card";
import { Callout } from "@/components/common/callout";
import {
  FIELD_CLASS,
  HINT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { Product, ProductCategorie, ProductType } from "@prisma/client";

const TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: "ONE_SHOT", label: "One-shot" },
  { value: "RECURRENT_MENSUEL", label: "Mensuel" },
  { value: "RECURRENT_ANNUEL", label: "Annuel" },
  { value: "PACK", label: "Pack" },
];

/** Codes des catégories système (alignent l'enum legacy). */
const SYSTEM_CODES = new Set([
  "SITE",
  "RS",
  "SEO",
  "ADS",
  "CMO",
  "METRICOOL",
  "PACK",
]);

interface ProductFormProps {
  initial?: Product;
  /** Liste des produits unitaires disponibles pour composer un pack. */
  unitaires: Pick<Product, "id" | "nom" | "type" | "isActive">[];
  /** Catégories disponibles (système + ajoutées). */
  categories: { code: string; label: string }[];
  /** Type pré-sélectionné à la création (ex. PACK depuis « Nouveau pack »). */
  defaultType?: ProductType;
}

export function ProductForm({
  initial,
  unitaires,
  categories,
  defaultType,
}: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<ProductType>(
    initial?.type ?? defaultType ?? "ONE_SHOT",
  );
  const [categorieCode, setCategorieCode] = useState<string>(
    initial?.categorieCode ?? initial?.categorie ?? categories[0]?.code ?? "SITE",
  );
  const [prixOneShot, setPrixOneShot] = useState(
    initial?.prixOneShot?.toString() ?? "",
  );
  const [prixMensuel, setPrixMensuel] = useState(
    initial?.prixMensuel?.toString() ?? "",
  );
  const [coutOneShot, setCoutOneShot] = useState(
    initial?.coutOneShot?.toString() ?? "",
  );
  const [coutMensuel, setCoutMensuel] = useState(
    initial?.coutMensuel?.toString() ?? "",
  );
  const [prixAnnuel, setPrixAnnuel] = useState(
    initial?.prixAnnuel?.toString() ?? "",
  );

  // composantsIds pour les packs
  const initialComposants =
    initial && Array.isArray(initial.composantsIds)
      ? (initial.composantsIds as string[])
      : [];
  const [composantsIds, setComposantsIds] = useState<string[]>(initialComposants);

  // Composition d'un pack : on ne propose que les produits EN LIGNE (actifs).
  // Exception : un composant déjà sélectionné qui aurait été désactivé reste
  // visible, sinon il serait silencieusement retiré du pack lors d'une édition.
  const composableUnitaires = useMemo(
    () =>
      unitaires.filter((u) => u.isActive || composantsIds.includes(u.id)),
    [unitaires, composantsIds],
  );

  const isPack = type === "PACK";

  // Tous les prix sont éditables : un produit peut combiner un frais unique
  // (setup) ET un récurrent (abonnement), ex. e-commerce 999.- + 49.-/mois.
  // Le "Type" reste une simple classification, il ne bride plus la saisie.
  const showOneShot = true;
  const showMensuel = true;
  const showAnnuel = true;

  const toggleComposant = (id: string) => {
    setComposantsIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    if (isPack && composantsIds.length === 0) {
      toast.error("Un pack doit contenir au moins un composant.");
      return;
    }

    const payload = {
      nom: nom.trim(),
      // Toujours envoyée (même vide) → permet de modifier ET d'effacer.
      description: description.trim(),
      type,
      // categorieCode = vraie catégorie ; categorie (enum legacy) = le code si
      // système, sinon "SITE" (valeur vestigiale, non-ADS, requise par la BD).
      categorieCode,
      categorie: (SYSTEM_CODES.has(categorieCode)
        ? categorieCode
        : "SITE") as ProductCategorie,
      prixOneShot: prixOneShot ? Number(prixOneShot) : undefined,
      prixMensuel: prixMensuel ? Number(prixMensuel) : undefined,
      prixAnnuel: prixAnnuel ? Number(prixAnnuel) : undefined,
      coutOneShot: coutOneShot ? Number(coutOneShot) : undefined,
      coutMensuel: coutMensuel ? Number(coutMensuel) : undefined,
      composantsIds: isPack ? composantsIds : undefined,
      isActive: initial?.isActive ?? true,
    };

    startTransition(async () => {
      const res = initial
        ? await updateProduct(initial.id, payload)
        : await createProduct(payload);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(initial ? "Produit mis à jour." : "Produit créé.");
      router.push("/catalogue");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionCard title="Identité" icon={Tag} tone="navy">
        <div className="space-y-4">
          <div>
            <label htmlFor="nom" className={LABEL_CLASS}>
              Nom <span aria-hidden="true" className="text-coral-600">*</span>
              <span className="sr-only"> (obligatoire)</span>
            </label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Site web simple"
              required
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="description" className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={TEXTAREA_CLASS}
              placeholder="Ce qui est inclus, livraison, …"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Classification" icon={Shapes} tone="violet">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <fieldset>
            <legend className={LABEL_CLASS}>Type</legend>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] border px-2 text-sm font-bold transition-colors",
                      selected
                        ? "border-navy-700 bg-navy-700 text-white"
                        : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                    )}
                  >
                    {selected && <Check aria-hidden="true" className="size-4" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="categorie" className={LABEL_CLASS}>
              Catégorie
            </label>
            <select
              id="categorie"
              value={categorieCode}
              onChange={(e) => setCategorieCode(e.target.value)}
              className={SELECT_CLASS}
            >
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className={HINT_CLASS}>
              Gère les catégories depuis Catalogue · « Gérer les catégories ».
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Tarification" description="Prix de vente au client" icon={CircleDollarSign} tone="green">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PrixField
            label="Prix one-shot (CHF)"
            id="prixOneShot"
            value={prixOneShot}
            onChange={setPrixOneShot}
            disabled={!showOneShot}
          />
          <PrixField
            label="Prix mensuel (CHF)"
            id="prixMensuel"
            value={prixMensuel}
            onChange={setPrixMensuel}
            disabled={!showMensuel}
          />
          <PrixField
            label="Prix annuel (CHF)"
            id="prixAnnuel"
            value={prixAnnuel}
            onChange={setPrixAnnuel}
            disabled={!showAnnuel}
          />
        </div>
      </SectionCard>

      {/* Coûts internes : pour la rentabilité par projet (admin only) */}
      <SectionCard
        title="Coûts internes (rentabilité)"
        description="Information interne, jamais affichée au client"
        icon={Lock}
        tone="gold"
      >
        <Callout tone="gold" icon={Lock} className="mb-4">
          Sert à calculer la marge nette par projet sur{" "}
          <strong>Administration · Comptabilité · Rentabilité</strong>.
        </Callout>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PrixField
            label="Coût one-shot interne (CHF)"
            id="coutOneShot"
            value={coutOneShot}
            onChange={setCoutOneShot}
            helper="Setup, intégration, licences à l'install."
          />
          <PrixField
            label="Coût mensuel interne (CHF)"
            id="coutMensuel"
            value={coutMensuel}
            onChange={setCoutMensuel}
            helper="Hébergement, SaaS récurrent, ad spend mensuel."
          />
        </div>
      </SectionCard>

      {isPack && (
        <SectionCard
          title="Composition du pack"
          description={`${composantsIds.length} composant(s) sélectionné(s)`}
          icon={Layers}
          tone="violet"
        >
          {composableUnitaires.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun produit unitaire en ligne. Crée ou réactive d&apos;abord
              les composants individuels.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {composableUnitaires.map((u) => {
                const checked = composantsIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-2 text-sm font-semibold transition-colors focus-within:ring-4 focus-within:ring-navy-100",
                      checked
                        ? "border-lvl-500 bg-lvl-50 text-lvl-700"
                        : "border-border-strong bg-card hover:bg-navy-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleComposant(u.id)}
                      className="size-4 shrink-0 accent-lvl-700"
                    />
                    <span className="min-w-0">{u.nom}</span>
                    {!u.isActive && (
                      <span className="ml-auto text-xs font-medium text-muted-foreground">
                        (inactif)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {pending ? "Enregistrement…" : initial ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

function PrixField({
  id,
  label,
  value,
  onChange,
  disabled,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div className={cn(disabled && "opacity-50")}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="0.00"
        className={cn(FIELD_CLASS, "tabular-nums")}
      />
      {helper && <p className={HINT_CLASS}>{helper}</p>}
    </div>
  );
}
