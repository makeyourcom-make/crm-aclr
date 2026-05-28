/**
 * Requêtes de lecture pour le module Deals (Pipeline).
 */
import { Prisma, type DealStage } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { DealListParams } from "@/lib/schemas/deal";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DealForKanban = Prisma.DealGetPayload<{
  include: {
    prospect: {
      select: { id: true; raisonSociale: true; secteur: true };
    };
    assigneA: { select: { id: true; name: true } };
  };
}>;

export type DealWithRelations = Prisma.DealGetPayload<{
  include: {
    prospect: {
      select: {
        id: true;
        raisonSociale: true;
        contactPrenom: true;
        contactNom: true;
        email: true;
        telephone: true;
        ville: true;
      };
    };
    assigneA: { select: { id: true; name: true } };
    productsProposes: { select: { id: true; nom: true; prixOneShot: true; prixMensuel: true } };
  };
}>;

export interface PipelineColumn {
  stage: DealStage;
  deals: DealForKanban[];
  totalMontant: number;
  totalPondere: number; // somme(montantPrevu * probabilité / 100)
}

export interface PipelineData {
  columns: PipelineColumn[];
  grandTotal: number;
  grandTotalPondere: number;
}

// ---------------------------------------------------------------------------
// PIPELINE — tout en un
// ---------------------------------------------------------------------------

const STAGE_ORDER: DealStage[] = [
  "DECOUVERTE",
  "PROPOSITION",
  "NEGOCIATION",
  "SIGNE",
  "PERDU",
];

export async function getPipeline(
  user: SessionUser,
  params: DealListParams = {},
): Promise<PipelineData> {
  const conditions: Prisma.DealWhereInput[] = [];

  // RLS : commercial = ses deals uniquement
  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  if (params.assigneAId) {
    conditions.push({ assigneAId: params.assigneAId });
  }

  if (params.secteur) {
    conditions.push({
      prospect: { secteur: params.secteur as never },
    });
  }

  if (params.q) {
    conditions.push({
      OR: [
        { titre: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
        {
          prospect: {
            raisonSociale: { contains: params.q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  const where: Prisma.DealWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const deals = await prisma.deal.findMany({
    where,
    include: {
      prospect: {
        select: { id: true, raisonSociale: true, secteur: true },
      },
      assigneA: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const columns: PipelineColumn[] = STAGE_ORDER.map((stage) => {
    const dealsOfStage = deals.filter((d) => d.stage === stage);
    const totalMontant = dealsOfStage.reduce(
      (sum, d) => sum + Number(d.montantPrevu),
      0,
    );
    const totalPondere = dealsOfStage.reduce(
      (sum, d) => sum + (Number(d.montantPrevu) * d.probabilite) / 100,
      0,
    );
    return { stage, deals: dealsOfStage, totalMontant, totalPondere };
  });

  const grandTotal = columns.reduce((s, c) => s + c.totalMontant, 0);
  const grandTotalPondere = columns.reduce((s, c) => s + c.totalPondere, 0);

  return { columns, grandTotal, grandTotalPondere };
}

// ---------------------------------------------------------------------------
// DETAIL d'un deal
// ---------------------------------------------------------------------------

export async function getDealById(
  user: SessionUser,
  id: string,
): Promise<DealWithRelations | null> {
  const deal = await prisma.deal.findUnique({
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
          ville: true,
        },
      },
      assigneA: { select: { id: true, name: true } },
      productsProposes: {
        select: { id: true, nom: true, prixOneShot: true, prixMensuel: true },
      },
    },
  });
  if (!deal) return null;
  // RLS
  if (user.role !== "ADMIN" && deal.assigneAId !== user.id) {
    return null;
  }
  return deal;
}
