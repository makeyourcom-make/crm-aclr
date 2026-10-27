import { CategoriesManager } from "@/components/catalogue/categories-manager";
import { BackLink } from "@/components/common/back-link";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
import { getCategories } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Catégories produits" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdmin();

  const [cats, products] = await Promise.all([
    getCategories(),
    prisma.product.findMany({
      select: {
        id: true,
        nom: true,
        categorie: true,
        categorieCode: true,
        isActive: true,
      },
      orderBy: { nom: "asc" },
    }),
  ]);

  const codeOf = (p: { categorie: string; categorieCode: string | null }) =>
    p.categorieCode ?? p.categorie;

  const categories = cats.map((cat) => {
    const items = products
      .filter((p) => codeOf(p) === cat.code)
      .map((p) => ({ id: p.id, nom: p.nom, isActive: p.isActive }));
    return {
      code: cat.code,
      label: cat.label,
      systeme: cat.systeme,
      count: items.length,
      products: items,
    };
  });

  return (
    <PageShell width="medium">
      <PageHeader
        rubrique="finance"
        title="Catégories produits"
        description="Renomme l'affichage des catégories et réaffecte les produits. Le calcul de commission (catégorie ADS) reste basé sur le type interne, indépendant du nom."
        breadcrumb={<BackLink href="/catalogue">Retour au catalogue</BackLink>}
      />

      <CategoriesManager categories={categories} />
    </PageShell>
  );
}
