import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ContractWizard } from "@/components/contrats/contract-wizard";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Modifier le contrat" };

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContractPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      products: true,
      prospect: { select: { id: true, raisonSociale: true, ville: true } },
      signatures: { select: { signeParClient: true } },
      clientInvoices: {
        select: { statut: true, payments: { select: { id: true } } },
      },
    },
  });
  if (!contract) notFound();
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) notFound();

  // Garde-fou : édition réservée aux contrats non signés et non payés.
  const signe = contract.signatures.some((s) => s.signeParClient);
  const paye = contract.clientInvoices.some(
    (inv) => inv.statut === "PAYEE" || inv.payments.length > 0,
  );
  if (signe || paye) redirect(`/contrats/${id}`);

  const [prospects, deals, catalogue, userFull] = await Promise.all([
    prisma.prospect.findMany({
      where: {
        ...scopedWhere(user, {}),
        statut: { notIn: ["PERDU", "NE_PAS_RAPPELER"] },
      },
      select: { id: true, raisonSociale: true, ville: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.deal.findMany({
      where: { ...scopedWhere(user, {}), stage: { in: ["NEGOCIATION", "SIGNE"] } },
      select: { id: true, titre: true, montantPrevu: true, prospectId: true },
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

  // Le prospect du contrat doit toujours être sélectionnable, même s'il est
  // filtré (ex. statut SIGNE) de la liste standard.
  const prospectsMerged = prospects.some((p) => p.id === contract.prospect.id)
    ? prospects
    : [
        {
          id: contract.prospect.id,
          raisonSociale: contract.prospect.raisonSociale,
          ville: contract.prospect.ville,
        },
        ...prospects,
      ];

  // Les produits du contrat doivent être disponibles dans le picker même
  // s'ils sont inactifs / sur-mesure (absents du catalogue actif).
  const catalogueIds = new Set(catalogue.map((p) => p.id));
  const productsMerged = [
    ...catalogue.map((p) => ({
      id: p.id,
      nom: p.nom,
      description: p.description,
      categorie: p.categorie,
      type: p.type,
      prixOneShot: p.prixOneShot?.toString() ?? null,
      prixMensuel: p.prixMensuel?.toString() ?? null,
      prixVariable: p.prixVariable,
      engagementMois: p.engagementMois,
    })),
    ...contract.products
      .filter((p) => !catalogueIds.has(p.id))
      .map((p) => ({
        id: p.id,
        nom: p.nom,
        description: p.description,
        categorie: p.categorie,
        type: p.type,
        prixOneShot: p.prixOneShot?.toString() ?? null,
        prixMensuel: p.prixMensuel?.toString() ?? null,
        prixVariable: p.prixVariable,
        engagementMois: p.engagementMois,
      })),
  ];

  // Recharge offert / remise / cible + prix d'ORIGINE depuis lignesMeta, pour
  // que l'édition reflète exactement ce qui a été configuré (sinon "Offert" et
  // remises seraient perdus, et les prix barrés afficheraient l'effectif).
  type LigneMeta = {
    productId: string;
    prixOneShotOriginal?: number | null;
    prixMensuelOriginal?: number | null;
    offert?: boolean;
    offertCible?: "ONESHOT" | "RECURRENT" | "DEUX" | null;
    remiseType?: "POURCENT" | "MONTANT" | null;
    remiseValeur?: number | null;
    remiseCible?: "ONESHOT" | "RECURRENT" | "DEUX" | null;
  };
  const metaArr: LigneMeta[] = Array.isArray(contract.lignesMeta)
    ? (contract.lignesMeta as unknown as LigneMeta[])
    : [];
  const metaByProduct = new Map(metaArr.map((m) => [m.productId, m]));

  const initialLines = contract.products.map((p, i) => {
    const meta = metaByProduct.get(p.id);
    const oneShot =
      meta?.prixOneShotOriginal != null
        ? String(meta.prixOneShotOriginal)
        : p.prixOneShot != null
          ? p.prixOneShot.toString()
          : "";
    const mensuel =
      meta?.prixMensuelOriginal != null
        ? String(meta.prixMensuelOriginal)
        : p.prixMensuel != null
          ? p.prixMensuel.toString()
          : "";
    return {
      id: `init-${i}`,
      productId: p.id,
      quantite: 1,
      prixOneShot: oneShot,
      prixMensuel: mensuel,
      offert: meta?.offert ?? false,
      offertCible: meta?.offertCible ?? undefined,
      remiseType: (meta?.remiseType ?? "") as "" | "POURCENT" | "MONTANT",
      remiseValeur: meta?.remiseValeur != null ? String(meta.remiseValeur) : "",
      remiseCible: meta?.remiseCible ?? undefined,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 lg:px-8">
      <PageHeader
        title={`Modifier le contrat ${contract.numero}`}
        breadcrumb={
          <Link
            href={`/contrats/${id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour au contrat
          </Link>
        }
      />

      <ContractWizard
        prospects={prospectsMerged}
        deals={deals.map((d) => ({
          id: d.id,
          titre: d.titre,
          montantPrevu: d.montantPrevu.toString(),
          prospectId: d.prospectId,
        }))}
        products={productsMerged}
        tauxCommission={Number(userFull?.tauxCommissionSignature ?? 0.25)}
        initial={{
          contractId: contract.id,
          numero: contract.numero,
          prospectId: contract.prospectId,
          dealId: contract.dealId ?? "",
          dateSignature: toIso(contract.dateSignature),
          dateDebut: toIso(contract.dateDebut),
          dureeMois: String(contract.dureeMois),
          modalitePaiement: contract.modalitePaiement,
          devise: contract.devise === "EUR" ? "EUR" : "CHF",
          lines: initialLines,
        }}
      />
    </div>
  );
}
