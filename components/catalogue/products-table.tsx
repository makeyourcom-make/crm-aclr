"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteProduct,
  toggleProductActive,
} from "@/app/(app)/catalogue/actions";
import { Badge } from "@/components/ui/badge";
import { InlinePriceCell } from "@/components/catalogue/inline-price-cell";
import { Icon } from "@/components/icon";
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
}

export function ProductsTable({ products }: ProductsTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <Th className="text-left">Nom</Th>
            <Th className="text-left">Catégorie</Th>
            <Th className="text-left">Type</Th>
            <Th className="text-right">One-shot</Th>
            <Th className="text-right">Mensuel</Th>
            <Th className="text-right">Annuel</Th>
            <Th className="text-center">Actif</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-12 text-center text-muted-foreground"
              >
                Aucun produit.
              </td>
            </tr>
          ) : (
            products.map((p) => <ProductRow key={p.id} product={p} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({ product: p }: { product: Product }) {
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

  // Détermine les prix attendus selon le type — inactive le grise
  const expectsOneShot =
    p.type === "ONE_SHOT" || p.type === "PACK";
  const expectsMensuel =
    p.type === "RECURRENT_MENSUEL" || p.type === "PACK";
  const expectsAnnuel = p.type === "RECURRENT_ANNUEL";

  return (
    <tr
      className={cn(
        "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
        !p.isActive && "opacity-50",
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
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {getProductCategorieLabel(p.categorie)}
      </td>
      <td className="px-3 py-2">
        <Badge variant="secondary" className="font-normal">
          {getProductTypeLabel(p.type)}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixOneShot"
          value={p.prixOneShot?.toString() ?? null}
          inactive={!expectsOneShot}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixMensuel"
          value={p.prixMensuel?.toString() ?? null}
          inactive={!expectsMensuel}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <InlinePriceCell
          productId={p.id}
          field="prixAnnuel"
          value={p.prixAnnuel?.toString() ?? null}
          inactive={!expectsAnnuel}
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
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
          aria-label="Supprimer"
          title="Supprimer (impossible si lié à un deal/contrat)"
        >
          <Icon name="LogOut" className="h-3.5 w-3.5 rotate-180" />
        </button>
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
        "px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}
