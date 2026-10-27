"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteProduct,
  toggleProductActive,
} from "@/app/(app)/catalogue/actions";
import { ActiveToggle } from "@/components/catalogue/active-toggle";
import { InlinePriceCell } from "@/components/catalogue/inline-price-cell";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableEmptyRow,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import {
  getProductCategorieLabel,
  getProductTypeLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { Product } from "@prisma/client";

interface ProductsTableProps {
  products: Product[];
  /** Si true, ne montre QUE la colonne One-shot (pour les Packs) */
  layout?: "default" | "compact";
  /** Libellés effectifs des catégories (renommés). */
  categorieLabels?: Record<string, string>;
}

export function ProductsTable({ products, categorieLabels }: ProductsTableProps) {
  return (
    <TableScroll label="Liste des packs">
      <table className={TABLE_CLASS}>
        <thead className={THEAD_CLASS}>
          <tr>
            <Th className="pl-5 sm:pl-6">Nom</Th>
            <Th>Catégorie</Th>
            <Th>Type</Th>
            <Th className="text-right">One-shot</Th>
            <Th className="text-right">Mensuel</Th>
            <Th className="text-right">Annuel</Th>
            <Th className="text-center">Actif</Th>
            <Th className="pr-5 sm:pr-6">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <TableEmptyRow colSpan={8}>
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun produit.
              </p>
            </TableEmptyRow>
          ) : (
            products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                categorieLabels={categorieLabels}
              />
            ))
          )}
        </tbody>
      </table>
    </TableScroll>
  );
}

function ProductRow({
  product: p,
  categorieLabels,
}: {
  product: Product;
  categorieLabels?: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();

  const handleToggle = () =>
    startTransition(async () => {
      const res = await toggleProductActive(p.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        p.isActive ? "Produit désactivé." : "Produit réactivé.",
      );
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
    });

  // Détermine les prix attendus selon le type : inactive le grise
  const expectsOneShot =
    p.type === "ONE_SHOT" || p.type === "PACK";
  const expectsMensuel =
    p.type === "RECURRENT_MENSUEL" || p.type === "PACK";
  const expectsAnnuel = p.type === "RECURRENT_ANNUEL";

  return (
    <tr className={cn(TR_CLASS, !p.isActive && "bg-ground/70 text-muted-foreground")}>
      <Td className="min-w-[180px] pl-5 sm:pl-6">
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
      <Td className="text-xs whitespace-nowrap text-muted-foreground">
        {categorieLabels?.[p.categorieCode ?? p.categorie] ??
          getProductCategorieLabel(p.categorie)}
      </Td>
      <Td>
        <span className="inline-flex h-6 items-center rounded-full bg-lvl-50 px-2.5 text-xs font-bold whitespace-nowrap text-lvl-700">
          {getProductTypeLabel(p.type)}
        </span>
      </Td>
      <Td className="text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixOneShot"
          value={p.prixOneShot?.toString() ?? null}
          inactive={!expectsOneShot}
        />
      </Td>
      <Td className="text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixMensuel"
          value={p.prixMensuel?.toString() ?? null}
          inactive={!expectsMensuel}
        />
      </Td>
      <Td className="text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixAnnuel"
          value={p.prixAnnuel?.toString() ?? null}
          inactive={!expectsAnnuel}
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
      <Td className="pr-5 text-right sm:pr-6">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-alert-50 hover:text-alert-700 disabled:opacity-50"
          aria-label={`Supprimer ${p.nom}`}
          title="Supprimer (impossible si lié à un deal/contrat)"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </Td>
    </tr>
  );
}
