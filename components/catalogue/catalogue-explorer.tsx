"use client";

/**
 * Vue Catalogue unifiée : accordéon par catégorie.
 *
 * - Catégories triées par ordre alphabétique (libellé)
 * - Renommer une catégorie / en ajouter / supprimer (si vide, non-système)
 * - Clic sur une catégorie → déplie ses produits
 * - Par produit : modifier (lien), désactiver (toggle), supprimer
 * - Les produits inactifs sont automatiquement renvoyés en bas de liste
 * - Produits triés par ordre alphabétique (actifs puis inactifs)
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createCategorie,
  deleteCategorie,
  deleteProduct,
  renameCategorieLabel,
  toggleProductActive,
} from "@/app/(app)/catalogue/actions";
import { InlinePriceCell } from "@/components/catalogue/inline-price-cell";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProductTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export interface ExplorerProduct {
  id: string;
  nom: string;
  description: string | null;
  type: string;
  /** Code de catégorie effectif (categorieCode ?? categorie). */
  categorieCode: string;
  prixOneShot: string | null;
  prixMensuel: string | null;
  prixAnnuel: string | null;
  isActive: boolean;
}

export interface ExplorerCategory {
  code: string;
  label: string;
  systeme: boolean;
}

const byFr = (a: string, b: string) =>
  a.localeCompare(b, "fr", { sensitivity: "base" });

export function CatalogueExplorer({
  categories,
  products,
}: {
  categories: ExplorerCategory[];
  products: ExplorerProduct[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");

  // Regroupe les produits par catégorie + tri (actifs alpha, puis inactifs alpha)
  const grouped = useMemo(() => {
    const map = new Map<string, ExplorerProduct[]>();
    for (const p of products) {
      const arr = map.get(p.categorieCode) ?? [];
      arr.push(p);
      map.set(p.categorieCode, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) =>
        a.isActive === b.isActive
          ? byFr(a.nom, b.nom)
          : a.isActive
            ? -1
            : 1,
      );
    }
    return map;
  }, [products]);

  // Catégories triées alphabétiquement par libellé
  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => byFr(a.label, b.label)),
    [categories],
  );

  const handleCreate = () => {
    if (newLabel.trim().length < 2) {
      toast.error("Donne un nom à la catégorie.");
      return;
    }
    startTransition(async () => {
      const res = await createCategorie({ label: newLabel.trim() });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`Catégorie « ${newLabel.trim()} » créée ✓`);
      setNewLabel("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {/* Ajouter une catégorie */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <Icon name="Plus" className="h-4 w-4 text-primary" />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="Nom d'une nouvelle catégorie…"
          className="h-9 max-w-xs"
        />
        <Button type="button" size="sm" onClick={handleCreate} disabled={pending}>
          Ajouter la catégorie
        </Button>
      </div>

      {sortedCats.map((cat) => (
        <CategorySection
          key={cat.code}
          cat={cat}
          products={grouped.get(cat.code) ?? []}
        />
      ))}
    </div>
  );
}

function CategorySection({
  cat,
  products,
}: {
  cat: ExplorerCategory;
  products: ExplorerProduct[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(cat.label);

  const activeCount = products.filter((p) => p.isActive).length;
  const inactiveCount = products.length - activeCount;

  const handleRename = () => {
    const trimmed = label.trim();
    if (trimmed.length < 2 || trimmed === cat.label) {
      setRenaming(false);
      setLabel(cat.label);
      return;
    }
    startTransition(async () => {
      const res = await renameCategorieLabel({ code: cat.code, label: trimmed });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Catégorie renommée ✓");
      setRenaming(false);
      router.refresh();
    });
  };

  const handleDeleteCat = () => {
    if (!confirm(`Supprimer la catégorie « ${cat.label} » ?`)) return;
    startTransition(async () => {
      const res = await deleteCategorie(cat.code);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Catégorie supprimée ✓");
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* En-tête de catégorie */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          disabled={products.length === 0}
        >
          <Icon
            name={expanded ? "ChevronDown" : "ChevronRight"}
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground",
              products.length === 0 && "opacity-30",
            )}
          />
          {renaming ? (
            <Input
              value={label}
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setLabel(cat.label);
                }
              }}
              onBlur={handleRename}
              className="h-8 max-w-xs"
            />
          ) : (
            <span className="truncate text-sm font-semibold">{cat.label}</span>
          )}
          {cat.systeme && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-blue-700">
              système
            </span>
          )}
        </button>

        <span className="text-xs text-muted-foreground tabular-nums">
          {activeCount} actif{activeCount > 1 ? "s" : ""}
          {inactiveCount > 0 && ` · ${inactiveCount} inactif${inactiveCount > 1 ? "s" : ""}`}
        </span>

        {!renaming && (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            disabled={pending}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Renommer la catégorie"
          >
            <Icon name="Pencil" className="h-3.5 w-3.5" />
          </button>
        )}

        {!cat.systeme && products.length === 0 && (
          <button
            type="button"
            onClick={handleDeleteCat}
            disabled={pending}
            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="Supprimer cette catégorie (vide)"
          >
            <Icon name="Trash2" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Liste de produits dépliée */}
      {expanded && products.length > 0 && (
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <Th className="text-left">Produit</Th>
                <Th className="text-left">Type</Th>
                <Th className="text-right">One-shot</Th>
                <Th className="text-right">Mensuel</Th>
                <Th className="text-right">Annuel</Th>
                <Th className="text-center">Actif</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product: p }: { product: ExplorerProduct }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleToggle = () =>
    startTransition(async () => {
      const res = await toggleProductActive(p.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(p.isActive ? "Produit désactivé." : "Produit réactivé.");
      router.refresh();
    });

  const handleDelete = () =>
    startTransition(async () => {
      if (!confirm(`Supprimer définitivement « ${p.nom} » ?`)) return;
      const res = await deleteProduct(p.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Produit supprimé.");
      router.refresh();
    });

  // Le "type" affiché reflète les prix réellement renseignés (un produit
  // peut cumuler un frais unique ET un abonnement).
  const hasOneShot = p.prixOneShot != null;
  const hasMensuel = p.prixMensuel != null;
  const hasAnnuel = p.prixAnnuel != null;
  const priceBadges: string[] = [];
  if (hasOneShot) priceBadges.push("One-shot");
  if (hasMensuel) priceBadges.push("Mensuel");
  if (hasAnnuel) priceBadges.push("Annuel");
  if (priceBadges.length === 0) priceBadges.push(getProductTypeLabel(p.type as never));

  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
        !p.isActive && "bg-muted/20 opacity-60",
      )}
    >
      <td className="px-3 py-2">
        <Link
          href={`/catalogue/${p.id}/modifier`}
          className="font-medium hover:underline"
        >
          {p.nom}
        </Link>
        {p.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {p.description}
          </p>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {priceBadges.map((b) => (
            <Badge key={b} variant="secondary" className="font-normal">
              {b}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixOneShot"
          value={p.prixOneShot}
          inactive={!hasOneShot}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixMensuel"
          value={p.prixMensuel}
          inactive={!hasMensuel}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixAnnuel"
          value={p.prixAnnuel}
          inactive={!hasAnnuel}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className={cn(
            "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors",
            p.isActive ? "bg-emerald-500" : "bg-slate-300",
          )}
          aria-label={p.isActive ? "Désactiver" : "Activer"}
          aria-pressed={p.isActive}
        >
          <span
            className={cn(
              "block h-5 w-5 rounded-full bg-white shadow transition-transform",
              p.isActive && "translate-x-5",
            )}
          />
        </button>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/catalogue/${p.id}/modifier`}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Modifier"
          >
            <Icon name="Pencil" className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
            title="Supprimer (impossible si lié à un deal/contrat)"
          >
            <Icon name="Trash2" className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}
