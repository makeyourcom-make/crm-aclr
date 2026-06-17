"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProduct, updateProduct } from "@/app/(app)/catalogue/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}

export function ProductForm({ initial, unitaires, categories }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<ProductType>(initial?.type ?? "ONE_SHOT");
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
  // (setup) ET un récurrent (abonnement) — ex. e-commerce 999.- + 49.-/mois.
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nom">
              Nom <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Site web simple"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Ce qui est inclus, livraison, …"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs",
                    type === opt.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categorie">Catégorie</Label>
            <select
              id="categorie"
              value={categorieCode}
              onChange={(e) => setCategorieCode(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Gère les catégories depuis Catalogue → « Gérer les catégories ».
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
        </CardContent>
      </Card>

      {/* Coûts internes — pour la rentabilité par projet (admin only) */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-base">
            Coûts internes (rentabilité)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            🔒 Information interne — jamais affichée au client. Sert à calculer
            la marge nette par projet sur{" "}
            <strong>Administration → Comptabilité → Rentabilité</strong>.
          </p>
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
        </CardContent>
      </Card>

      {isPack && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Composition du pack ({composantsIds.length} sélectionné·s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {composableUnitaires.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun produit unitaire en ligne. Crée ou réactive d&apos;abord
                les composants individuels.
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {composableUnitaires.map((u) => {
                  const checked = composantsIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleComposant(u.id)}
                        className="h-4 w-4"
                      />
                      <span>{u.nom}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
    <div className={cn("space-y-1.5", disabled && "opacity-50")}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="0.00"
      />
      {helper && (
        <p className="text-[11px] text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}
