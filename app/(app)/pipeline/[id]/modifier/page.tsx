import Link from "next/link";
import { notFound } from "next/navigation";

import { DealForm } from "@/components/pipeline/deal-form";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { getProductCategorieLabel } from "@/lib/labels";
import { getDealById } from "@/lib/queries/deals";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Modifier le deal" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDealPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  const deal = await getDealById(user, id);
  if (!deal) notFound();

  const [prospects, products] = await Promise.all([
    prisma.prospect.findMany({
      where: scopedWhere(user, {}),
      select: { id: true, raisonSociale: true, ville: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nom: true,
        categorie: true,
        type: true,
        prixOneShot: true,
        prixMensuel: true,
      },
      orderBy: [{ categorie: "asc" }, { nom: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Modifier le deal"
        description={`${deal.titre} · ${deal.prospect.raisonSociale}`}
        breadcrumb={
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour au pipeline
          </Link>
        }
      />
      <DealForm
        prospects={prospects}
        products={products.map((p) => ({
          id: p.id,
          nom: p.nom,
          categorie: getProductCategorieLabel(p.categorie),
          type: p.type,
          prixOneShot: p.prixOneShot?.toString() ?? null,
          prixMensuel: p.prixMensuel?.toString() ?? null,
        }))}
        initial={{
          id: deal.id,
          prospectId: deal.prospectId,
          titre: deal.titre,
          description: deal.description,
          montantPrevu: Number(deal.montantPrevu),
          stage: deal.stage,
          probabilite: deal.probabilite,
          closeAttenduLe: deal.closeAttenduLe,
          productIds: deal.productsProposes.map((p) => p.id),
        }}
      />
    </div>
  );
}
