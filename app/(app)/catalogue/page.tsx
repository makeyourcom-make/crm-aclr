import { Boxes, FolderTree, Layers, Lightbulb, Package, PackagePlus, Plus, Power } from "lucide-react";
import Link from "next/link";

import { EmptyState, SectionCard, StatTile } from "@/components/arena";
import { CatalogueExplorer } from "@/components/catalogue/catalogue-explorer";
import { ProductsTable } from "@/components/catalogue/products-table";
import { Callout } from "@/components/common/callout";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
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

  const actifs = unitaires.filter((p) => p.isActive).length;
  const packsActifs = packs.filter((p) => p.isActive).length;

  return (
    <PageShell>
      <PageHeader
        rubrique="finance"
        title="Catalogue produits"
        description={`${unitaires.length} produit(s) unitaire(s) + ${packs.length} pack(s).`}
        actions={
          <>
            <Link
              href="/catalogue/categories"
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              <FolderTree aria-hidden="true" />
              Gérer les catégories
            </Link>
            <Link
              href="/catalogue/nouveau?type=PACK"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <PackagePlus aria-hidden="true" />
              Nouveau pack
            </Link>
            <Link
              href="/catalogue/nouveau"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              <Plus aria-hidden="true" />
              Nouveau produit
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Produits en ligne"
          value={actifs}
          sub={`sur ${unitaires.length} unitaires`}
          tone="green"
          icon={Power}
        />
        <StatTile
          label="Produits hors ligne"
          value={unitaires.length - actifs}
          sub="Masqués des offres"
          tone="navy"
          icon={Package}
        />
        <StatTile
          label="Packs"
          value={packs.length}
          sub={`${packsActifs} en ligne`}
          tone="violet"
          icon={Layers}
        />
        <StatTile
          label="Catégories"
          value={categories.length}
          sub="Système + ajoutées"
          tone="blue"
          icon={FolderTree}
          href="/catalogue/categories"
        />
      </div>

      {/* Produits unitaires : accordéon par catégorie */}
      <SectionCard
        className="mb-6"
        title="Produits par catégorie"
        description="Clique une catégorie pour déplier ses produits"
        icon={Boxes}
        tone="navy"
      >
        <CatalogueExplorer
          categories={explorerCategories}
          products={explorerProducts}
        />
        <Callout tone="blue" icon={Lightbulb} className="mt-4">
          Clique sur une catégorie pour déplier ses produits. Renomme-la via le
          crayon, ou ajoute-en une nouvelle en haut. Sur un produit : clique un
          prix pour le modifier, l&apos;interrupteur l&apos;active ou le
          désactive (les inactifs passent en bas), la corbeille le supprime.
        </Callout>
      </SectionCard>

      {/* Packs */}
      <SectionCard
        className="overflow-hidden"
        title="Packs"
        description={`${packs.length} offre(s) groupée(s)`}
        icon={Layers}
        tone="violet"
        contentClassName={packs.length > 0 ? "-mx-5 -mb-5 sm:-mx-6 sm:-mb-6" : undefined}
      >
        {packs.length === 0 ? (
          <EmptyState
            icon={Layers}
            tone="violet"
            title="Aucun pack défini"
            description="Assemble plusieurs produits unitaires en une offre groupée."
            action={
              <Link
                href="/catalogue/nouveau?type=PACK"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <PackagePlus aria-hidden="true" />
                Nouveau pack
              </Link>
            }
          />
        ) : (
          <ProductsTable products={packs} categorieLabels={categorieLabels} />
        )}
      </SectionCard>
    </PageShell>
  );
}
