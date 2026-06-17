import Link from "next/link";

import { CatalogueExplorer } from "@/components/catalogue/catalogue-explorer";
import { ProductsTable } from "@/components/catalogue/products-table";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { getCategories, getCategorieLabels } from "@/lib/categories";
import { getProducts } from "@/lib/queries/products";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Catalogue produits" };
export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  await requireAdmin();
  const [{ unitaires, packs }, categories, categorieLabels] = await Promise.all([
    getProducts(),
    getCategories(),
    getCategorieLabels(),
  ]);

  // Sérialise les unitaires pour la vue accordéon (prix Decimal → string)
  const explorerProducts = unitaires.map((p) => ({
    id: p.id,
    nom: p.nom,
    description: p.description,
    type: p.type,
    categorieCode: p.categorieCode ?? p.categorie,
    prixOneShot: p.prixOneShot?.toString() ?? null,
    prixMensuel: p.prixMensuel?.toString() ?? null,
    prixAnnuel: p.prixAnnuel?.toString() ?? null,
    isActive: p.isActive,
  }));

  const explorerCategories = categories.map((c) => ({
    code: c.code,
    label: c.label,
    systeme: c.systeme,
  }));

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Catalogue produits"
        description={`${unitaires.length} produit(s) unitaire(s) + ${packs.length} pack(s).`}
        actions={
          <Link
            href="/catalogue/nouveau"
            className={buttonVariants({ variant: "default" })}
          >
            <Icon name="Package" className="mr-1.5 h-4 w-4" />
            Nouveau produit
          </Link>
        }
      />

      {/* Produits unitaires — accordéon par catégorie */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Produits par catégorie
          </h2>
        </div>
        <CatalogueExplorer
          categories={explorerCategories}
          products={explorerProducts}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Clique sur une catégorie pour déplier ses produits. Renomme-la via le
          crayon, ou ajoute-en une nouvelle en haut. Sur un produit : clique un prix
          pour le modifier, le toggle l&apos;active/désactive (les inactifs passent
          en bas), la corbeille le supprime.
        </p>
      </section>

      {/* Packs */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Packs
        </h2>

        {packs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun pack défini.
            </CardContent>
          </Card>
        ) : (
          <ProductsTable products={packs} categorieLabels={categorieLabels} />
        )}
      </section>
    </div>
  );
}
