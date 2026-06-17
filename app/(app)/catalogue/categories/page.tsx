import Link from "next/link";

import { CategoriesManager } from "@/components/catalogue/categories-manager";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { CATEGORIE_CODES, getCategorieLabels } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Catégories produits" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdmin();

  const [labels, products] = await Promise.all([
    getCategorieLabels(),
    prisma.product.findMany({
      select: { id: true, nom: true, categorie: true, isActive: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  const categories = CATEGORIE_CODES.map((code) => {
    const items = products
      .filter((p) => p.categorie === code)
      .map((p) => ({ id: p.id, nom: p.nom, isActive: p.isActive }));
    return {
      code,
      label: labels[code] ?? code,
      count: items.length,
      products: items,
    };
  });

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Catégories produits"
        description="Renomme l'affichage des catégories et réaffecte les produits. Le calcul de commission (catégorie ADS) reste basé sur le type interne, indépendant du nom."
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

      <CategoriesManager categories={categories} />
    </div>
  );
}
