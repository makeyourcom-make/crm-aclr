/**
 * Requêtes de lecture pour le module Contrats.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ContractListParams } from "@/lib/schemas/contract";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ContractListItem = Prisma.ContractGetPayload<{
  include: {
    prospect: { select: { id: true; raisonSociale: true; ville: true } };
    assigneA: { select: { id: true; name: true } };
  };
}>;

export type ContractDetail = Prisma.ContractGetPayload<{
  include: {
    prospect: {
      select: {
        id: true;
        raisonSociale: true;
        contactPrenom: true;
        contactNom: true;
        email: true;
        telephone: true;
        adresse: true;
        codePostal: true;
        ville: true;
        canton: true;
      };
    };
    assigneA: { select: { id: true; name: true } };
    deal: { select: { id: true; titre: true } };
    products: {
      select: { id: true; nom: true; prixOneShot: true; prixMensuel: true };
    };
    payments: { orderBy: { date: "asc" } };
    commissions: {
      include: {
        payments: { orderBy: { dateVersementPrevue: "asc" } };
      };
    };
    clientInvoices: { orderBy: { dateEmission: "asc" } };
    signatures: { orderBy: { createdAt: "desc" } };
  };
}>;

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export interface ContractListResult {
  items: ContractListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getContracts(
  user: SessionUser,
  params: ContractListParams,
): Promise<ContractListResult> {
  const where = buildWhere(user, params);

  // Mapping sortBy → orderBy Prisma. "raisonSociale" est sur Prospect,
  // donc on utilise la syntaxe imbriquée { prospect: { raisonSociale: dir } }.
  const orderBy: Prisma.ContractOrderByWithRelationInput = (() => {
    switch (params.sortBy) {
      case "raisonSociale":
        return { prospect: { raisonSociale: params.sortDir } };
      case "numero":
        return { numero: params.sortDir };
      case "valeurAn1":
        return { valeurAn1: params.sortDir };
      case "montantMensuel":
        return { montantMensuel: params.sortDir };
      case "statut":
        return { statut: params.sortDir };
      case "dateSignature":
      default:
        return { dateSignature: params.sortDir };
    }
  })();

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        prospect: {
          select: { id: true, raisonSociale: true, ville: true },
        },
        assigneA: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.contract.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getContractStats(user: SessionUser) {
  const scopeWhere = user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const [total, parStatut] = await Promise.all([
    prisma.contract.count({ where: scopeWhere }),
    prisma.contract.groupBy({
      by: ["statut"],
      where: scopeWhere,
      _count: true,
      _sum: { valeurAn1: true, montantMensuel: true },
    }),
  ]);
  const byStatut = Object.fromEntries(
    parStatut.map((s) => [s.statut, s._count]),
  );
  const valeurAn1Active = parStatut
    .filter((s) => s.statut === "ACTIF")
    .reduce((sum, s) => sum + Number(s._sum.valeurAn1 ?? 0), 0);
  const mensuelActif = parStatut
    .filter((s) => s.statut === "ACTIF")
    .reduce((sum, s) => sum + Number(s._sum.montantMensuel ?? 0), 0);
  return { total, byStatut, valeurAn1Active, mensuelActif };
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

export async function getContractById(
  user: SessionUser,
  id: string,
): Promise<ContractDetail | null> {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      prospect: {
        select: {
          id: true,
          raisonSociale: true,
          contactPrenom: true,
          contactNom: true,
          email: true,
          telephone: true,
          adresse: true,
          codePostal: true,
          ville: true,
          canton: true,
        },
      },
      assigneA: { select: { id: true, name: true } },
      deal: { select: { id: true, titre: true } },
      products: {
        select: {
          id: true,
          nom: true,
          prixOneShot: true,
          prixMensuel: true,
        },
      },
      payments: { orderBy: { date: "asc" } },
      commissions: {
        include: {
          payments: { orderBy: { dateVersementPrevue: "asc" } },
        },
      },
      clientInvoices: { orderBy: { dateEmission: "asc" } },
      signatures: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contract) return null;
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return null;
  }
  return contract;
}

// ---------------------------------------------------------------------------
// WHERE builder
// ---------------------------------------------------------------------------

function buildWhere(
  user: SessionUser,
  params: ContractListParams,
): Prisma.ContractWhereInput {
  const conditions: Prisma.ContractWhereInput[] = [];

  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  if (params.statut) conditions.push({ statut: params.statut });
  if (params.assigneAId) conditions.push({ assigneAId: params.assigneAId });

  if (params.q) {
    conditions.push({
      OR: [
        { numero: { contains: params.q, mode: "insensitive" } },
        {
          prospect: {
            raisonSociale: { contains: params.q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
