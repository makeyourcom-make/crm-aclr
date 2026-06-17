import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/catalogue/product-form";
import { getCategories } from "@/lib/categories";
import { getProductById, getProducts } from "@/lib/queries/products";
import { requireAdmin } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Modifier produit" };

export default async function EditProductPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const [product, { unitaires }, categories] = await Promise.all([
    getProductById(id),
    getProducts(),
    getCategories(),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title={`Modifier · ${product.nom}`}
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
        initial={product}
        unitaires={unitaires
          .filter((u) => u.id !== product.id)
          .map((u) => ({ id: u.id, nom: u.nom, type: u.type }))}
        categories={categories.map((c) => ({ code: c.code, label: c.label }))}
      />
    </div>
  );
}
