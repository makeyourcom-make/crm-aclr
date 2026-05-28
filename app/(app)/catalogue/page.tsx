import Link from "next/link";

import { PackComposition } from "@/components/catalogue/pack-composition";
import { ProductsTable } from "@/components/catalogue/products-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF } from "@/lib/format";
import { getProductCategorieLabel } from "@/lib/labels";
import { getProducts } from "@/lib/queries/products";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Catalogue produits" };
export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  await requireAdmin();
  const { unitaires, packs } = await getProducts();

  return (
    <div className="px-6 py-6 lg:px-8">
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

      {/* Produits unitaires */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Produits unitaires
        </h2>
        <ProductsTable products={unitaires} />
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Clique sur un prix pour le modifier en place. Le toggle Actif/Inactif
          masque le produit des nouveaux deals sans le supprimer.
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
          <div className="space-y-4">
            <ProductsTable products={packs} />

            {/* Composition visuelle des packs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {p.nom}
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                        {getProductCategorieLabel(p.categorie)}
                      </span>
                    </CardTitle>
                    {(p.prixOneShot || p.prixMensuel) && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {p.prixOneShot &&
                          `${formatCHF(Number(p.prixOneShot))} one-shot`}
                        {p.prixOneShot && p.prixMensuel && " + "}
                        {p.prixMensuel &&
                          `${formatCHF(Number(p.prixMensuel))}/mois`}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <PackComposition composantsIds={p.composantsIds} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
