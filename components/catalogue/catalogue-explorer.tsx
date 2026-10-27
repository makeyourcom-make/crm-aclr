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
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
import { StatusPill } from "@/components/arena/pills";
import { ActiveToggle } from "@/components/catalogue/active-toggle";
import { InlinePriceCell } from "@/components/catalogue/inline-price-cell";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { FIELD_CLASS, FIELD_SM_CLASS } from "@/components/common/form-styles";
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

const ICON_BTN =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors disabled:opacity-50";

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
      toast.success(`Catégorie « ${newLabel.trim()} » créée.`);
      setNewLabel("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {/* Ajouter une catégorie */}
      <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-dashed border-border-strong bg-ground p-3">
        <span
          aria-hidden="true"
          className="hidden size-9 shrink-0 items-center justify-center rounded-[12px] bg-card text-navy-700 shadow-arena sm:flex"
        >
          <Plus className="size-4" />
        </span>
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Nom de la nouvelle catégorie</span>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Nom d'une nouvelle catégorie…"
            className={FIELD_CLASS}
          />
        </label>
        <Button type="button" size="lg" onClick={handleCreate} disabled={pending}>
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
  const panelId = `cat-${cat.code}`;

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
      toast.success("Catégorie renommée.");
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
      toast.success("Catégorie supprimée.");
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[0_1px_2px_rgba(14,25,54,0.04)]">
      {/* En-tête de catégorie */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
        {renaming ? (
          <label className="min-w-0 flex-1">
            <span className="sr-only">Nouveau nom de la catégorie {cat.label}</span>
            <Input
              value={label}
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setLabel(cat.label);
                }
              }}
              onBlur={handleRename}
              className={cn(FIELD_SM_CLASS, "max-w-xs")}
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] text-left disabled:cursor-default"
            disabled={products.length === 0}
            aria-expanded={products.length > 0 ? expanded : undefined}
            aria-controls={products.length > 0 ? panelId : undefined}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-90",
                products.length === 0 && "opacity-30",
              )}
            />
            <span className="truncate text-sm font-extrabold">{cat.label}</span>
            {cat.systeme && (
              <StatusPill tone="blue" dot={false} className="h-5 px-2 text-[11px]">
                Système
              </StatusPill>
            )}
          </button>
        )}

        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {activeCount} actif{activeCount > 1 ? "s" : ""}
          {inactiveCount > 0 && ` · ${inactiveCount} inactif${inactiveCount > 1 ? "s" : ""}`}
        </span>

        {!renaming && (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            disabled={pending}
            className={cn(ICON_BTN, "hover:bg-navy-50 hover:text-foreground")}
            title="Renommer la catégorie"
            aria-label={`Renommer la catégorie ${cat.label}`}
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
        )}

        {!cat.systeme && products.length === 0 && (
          <button
            type="button"
            onClick={handleDeleteCat}
            disabled={pending}
            className={cn(ICON_BTN, "hover:bg-alert-50 hover:text-alert-700")}
            title="Supprimer cette catégorie (vide)"
            aria-label={`Supprimer la catégorie ${cat.label}`}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {/* Liste de produits dépliée */}
      {expanded && products.length > 0 && (
        <div id={panelId} className="border-t border-border">
          <TableScroll label={`Produits de la catégorie ${cat.label}`}>
            <table className={TABLE_CLASS}>
              <thead className={THEAD_CLASS}>
                <tr>
                  <Th className="pl-4">Produit</Th>
                  <Th>Type</Th>
                  <Th className="text-right">One-shot</Th>
                  <Th className="text-right">Mensuel</Th>
                  <Th className="text-right">Annuel</Th>
                  <Th className="text-center">Actif</Th>
                  <Th className="pr-4">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </tbody>
            </table>
          </TableScroll>
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

  // Un prix nul OU égal à 0 n'est pas un vrai prix → on l'ignore (badge + affichage).
  const realPrice = (s: string | null) => (s != null && Number(s) > 0 ? s : null);
  const oneShot = realPrice(p.prixOneShot);
  const mensuel = realPrice(p.prixMensuel);
  const annuel = realPrice(p.prixAnnuel);

  // Le "type" affiché reflète les prix réellement renseignés (un produit
  // peut cumuler un frais unique ET un abonnement).
  const hasOneShot = oneShot != null;
  const hasMensuel = mensuel != null;
  const hasAnnuel = annuel != null;
  const priceBadges: string[] = [];
  if (hasOneShot) priceBadges.push("One-shot");
  if (hasMensuel) priceBadges.push("Mensuel");
  if (hasAnnuel) priceBadges.push("Annuel");
  if (priceBadges.length === 0) priceBadges.push(getProductTypeLabel(p.type as never));

  return (
    <tr className={cn(TR_CLASS, !p.isActive && "bg-ground/70 text-muted-foreground")}>
      <Td className="min-w-[180px] pl-4">
        <Link
          href={`/catalogue/${p.id}/modifier`}
          className={cn(
            "font-bold hover:underline",
            p.isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {p.nom}
        </Link>
        {p.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {p.description}
          </p>
        )}
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {priceBadges.map((b) => (
            <span
              key={b}
              className="inline-flex h-6 items-center rounded-full bg-navy-50 px-2.5 text-xs font-semibold whitespace-nowrap text-foreground"
            >
              {b}
            </span>
          ))}
        </div>
      </Td>
      <Td className="text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixOneShot"
          value={oneShot}
          inactive={!hasOneShot}
        />
      </Td>
      <Td className="text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixMensuel"
          value={mensuel}
          inactive={!hasMensuel}
        />
      </Td>
      <Td className="text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixAnnuel"
          value={annuel}
          inactive={!hasAnnuel}
        />
      </Td>
      <Td className="text-center">
        <ActiveToggle
          active={p.isActive}
          onToggle={handleToggle}
          disabled={pending}
          productName={p.nom}
        />
      </Td>
      <Td className="pr-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/catalogue/${p.id}/modifier`}
            className={cn(ICON_BTN, "hover:bg-navy-50 hover:text-foreground")}
            title="Modifier"
            aria-label={`Modifier ${p.nom}`}
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className={cn(ICON_BTN, "hover:bg-alert-50 hover:text-alert-700")}
            title="Supprimer (impossible si lié à un deal/contrat)"
            aria-label={`Supprimer ${p.nom}`}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </Td>
    </tr>
  );
}
