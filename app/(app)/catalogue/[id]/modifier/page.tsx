import { notFound } from "next/navigation";

import { StatusPill } from "@/components/arena/pills";
import { ProductForm } from "@/components/catalogue/product-form";
import { BackLink } from "@/components/common/back-link";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
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
    <PageShell width="narrow">
      <PageHeader
        rubrique="finance"
        title={`Modifier · ${product.nom}`}
        description={
          product.isActive ? (
            <StatusPill tone="green">En ligne</StatusPill>
          ) : (
            <StatusPill tone="navy">Hors ligne</StatusPill>
          )
        }
        breadcrumb={<BackLink href="/catalogue">Retour au catalogue</BackLink>}
      />
      <ProductForm
        initial={product}
        unitaires={unitaires
          .filter((u) => u.id !== product.id)
          .map((u) => ({
            id: u.id,
            nom: u.nom,
            type: u.type,
            isActive: u.isActive,
          }))}
        categories={categories.map((c) => ({ code: c.code, label: c.label }))}
      />
    </PageShell>
  );
}
