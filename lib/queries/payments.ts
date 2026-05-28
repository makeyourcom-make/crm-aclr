/**
 * Requêtes de lecture pour le module Paiements clients.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { PaymentListParams } from "@/lib/schemas/payment";
import { type SessionUser } from "@/lib/session";

export type PaymentListItem = Prisma.PaymentGetPayload<{
  include: {
    contract: {
      select: {
        id: true;
        numero: true;
        prospect: { select: { id: true; raisonSociale: true } };
        assigneA: { select: { id: true; name: true } };
      };
    };
    clientInvoice: { select: { id: true; numero: true } };
  };
}>;

export interface PaymentListResult {
  items: PaymentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getPayments(
  user: SessionUser,
  params: PaymentListParams,
): Promise<PaymentListResult> {
  const conditions: Prisma.PaymentWhereInput[] = [];

  if (user.role !== "ADMIN") {
    conditions.push({ contract: { assigneAId: user.id } });
  }

  if (params.statut) conditions.push({ statut: params.statut });
  if (params.contractId) conditions.push({ contractId: params.contractId });
  if (params.q) {
    conditions.push({
      OR: [
        {
          contract: {
            numero: { contains: params.q, mode: "insensitive" },
          },
        },
        {
          contract: {
            prospect: {
              raisonSociale: { contains: params.q, mode: "insensitive" },
            },
          },
        },
        {
          referenceFactureClient: {
            contains: params.q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  const where: Prisma.PaymentWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            numero: true,
            prospect: { select: { id: true, raisonSociale: true } },
            assigneA: { select: { id: true, name: true } },
          },
        },
        clientInvoice: { select: { id: true, numero: true } },
      },
      orderBy: { date: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getPaymentStats(user: SessionUser) {
  const scope =
    user.role === "ADMIN" ? {} : { contract: { assigneAId: user.id } };

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [encaisseesMois, enAttente, enRetard] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        ...scope,
        statut: "ENCAISSE",
        date: { gte: startMonth, lte: endMonth },
      },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...scope, statut: "EN_ATTENTE" },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...scope, statut: "EN_RETARD" },
      _sum: { montant: true },
      _count: true,
    }),
  ]);

  return {
    encaisseesMois: {
      montant: Number(encaisseesMois._sum.montant ?? 0),
      count: encaisseesMois._count,
    },
    enAttente: {
      montant: Number(enAttente._sum.montant ?? 0),
      count: enAttente._count,
    },
    enRetard: {
      montant: Number(enRetard._sum.montant ?? 0),
      count: enRetard._count,
    },
  };
}
