import Link from "next/link";

import { ContractWizard } from "@/components/contrats/contract-wizard";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Nouveau contrat" };

export default async function NewContractPage() {
  const user = await requireUser();

  const [prospects, deals, products, userFull] = await Promise.all([
    prisma.prospect.findMany({
      where: {
        ...scopedWhere(user, {}),
        statut: { notIn: ["PERDU", "NE_PAS_RAPPELER"] },
      },
      select: { id: true, raisonSociale: true, ville: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.deal.findMany({
      where: {
        ...scopedWhere(user, {}),
        stage: { in: ["NEGOCIATION", "SIGNE"] },
      },
      select: {
        id: true,
        titre: true,
        montantPrevu: true,
        prospectId: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nom: true,
        description: true,
        categorie: true,
        type: true,
        prixOneShot: true,
        prixMensuel: true,
        prixVariable: true,
        engagementMois: true,
      },
      orderBy: [{ categorie: "asc" }, { nom: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { tauxCommissionSignature: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Nouveau contrat"
        description="Wizard de création — la commission, les versements et les factures clients sont générés automatiquement."
        breadcrumb={
          <Link
            href="/contrats"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux contrats
          </Link>
        }
      />

      <ContractWizard
        prospects={prospects}
        deals={deals.map((d) => ({
          id: d.id,
          titre: d.titre,
          montantPrevu: d.montantPrevu.toString(),
          prospectId: d.prospectId,
        }))}
        products={products.map((p) => ({
          id: p.id,
          nom: p.nom,
          description: p.description,
          categorie: p.categorie,
          type: p.type,
          prixOneShot: p.prixOneShot?.toString() ?? null,
          prixMensuel: p.prixMensuel?.toString() ?? null,
          prixVariable: p.prixVariable,
          engagementMois: p.engagementMois,
        }))}
        tauxCommission={Number(userFull?.tauxCommissionSignature ?? 0.25)}
      />
    </div>
  );
}
