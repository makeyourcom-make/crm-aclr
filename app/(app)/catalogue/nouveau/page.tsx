import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/catalogue/product-form";
import { getCategories } from "@/lib/categories";
import { getProducts } from "@/lib/queries/products";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Nouveau produit" };

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewProductPage({ searchParams }: PageProps) {
  await requireAdmin();
  const [{ unitaires }, categories, { type }] = await Promise.all([
    getProducts(),
    getCategories(),
    searchParams,
  ]);
  const isPack = type === "PACK";

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title={isPack ? "Nouveau pack" : "Nouveau produit"}
        description={
          isPack
            ? "Assemble plusieurs produits unitaires en une offre groupée."
            : "Ajoute un produit unitaire ou un pack au catalogue."
        }
        breadcrumb={
          <Link
            href="/catalogue"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour au catalogue
          </Link>
        }
      />
      <ProductForm
        unitaires={unitaires.map((u) => ({
          id: u.id,
          nom: u.nom,
          type: u.type,
          isActive: u.isActive,
        }))}
        categories={categories.map((c) => ({ code: c.code, label: c.label }))}
        defaultType={isPack ? "PACK" : undefined}
      />
    </div>
  );
}
