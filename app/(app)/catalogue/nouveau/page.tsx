import { ProductForm } from "@/components/catalogue/product-form";
import { BackLink } from "@/components/common/back-link";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
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
    <PageShell width="narrow">
      <PageHeader
        rubrique="finance"
        title={isPack ? "Nouveau pack" : "Nouveau produit"}
        description={
          isPack
            ? "Assemble plusieurs produits unitaires en une offre groupée."
            : "Ajoute un produit unitaire ou un pack au catalogue."
        }
        breadcrumb={<BackLink href="/catalogue">Retour au catalogue</BackLink>}
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
    </PageShell>
  );
}
