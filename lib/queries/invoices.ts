/**
 * Requêtes de lecture pour le module Factures Sophie.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { InvoiceListParams } from "@/lib/schemas/invoice";
import { type SessionUser } from "@/lib/session";

export type InvoiceListItem = Prisma.InvoiceGetPayload<{
  include: {
    user: { select: { id: true; name: true } };
    _count: { select: { commissionPayments: true } };
  };
}>;

export type InvoiceDetail = Prisma.InvoiceGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        garantieMensuelle: true;
        forfaitFrais: true;
      };
    };
    commissionPayments: {
      include: {
        commission: {
          include: {
            contract: {
              select: {
                id: true;
                numero: true;
                prospect: { select: { raisonSociale: true } };
              };
            };
          };
        };
      };
    };
  };
}>;

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export interface InvoiceListResult {
  items: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getInvoices(
  user: SessionUser,
  params: InvoiceListParams,
): Promise<InvoiceListResult> {
  const conditions: Prisma.InvoiceWhereInput[] = [];

  if (user.role !== "ADMIN") {
    conditions.push({ userId: user.id });
  }
  if (params.userId) conditions.push({ userId: params.userId });
  if (params.statut) conditions.push({ statut: params.statut });
  if (params.annee) {
    conditions.push({
      mois: {
        gte: new Date(params.annee, 0, 1),
        lte: new Date(params.annee, 11, 31, 23, 59, 59),
      },
    });
  }
  if (params.q) {
    conditions.push({
      OR: [
        { referenceFacture: { contains: params.q, mode: "insensitive" } },
        { user: { name: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.InvoiceWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { commissionPayments: true } },
      },
      orderBy: [{ mois: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getInvoiceStats(user: SessionUser) {
  const scope = user.role === "ADMIN" ? {} : { userId: user.id };

  const now = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1);

  const [total, parStatut, ytd] = await Promise.all([
    prisma.invoice.count({ where: scope }),
    prisma.invoice.groupBy({
      by: ["statut"],
      where: scope,
      _count: true,
      _sum: { montantTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { ...scope, mois: { gte: startYear } },
      _sum: { montantTotal: true, montantCommissions: true },
    }),
  ]);

  const byStatut = Object.fromEntries(parStatut.map((s) => [s.statut, s]));

  return {
    total,
    byStatut,
    ytdTotal: Number(ytd._sum.montantTotal ?? 0),
    ytdCommissions: Number(ytd._sum.montantCommissions ?? 0),
  };
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

export async function getInvoiceById(
  user: SessionUser,
  id: string,
): Promise<InvoiceDetail | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          garantieMensuelle: true,
          forfaitFrais: true,
        },
      },
      commissionPayments: {
        include: {
          commission: {
            include: {
              contract: {
                select: {
                  id: true,
                  numero: true,
                  prospect: { select: { raisonSociale: true } },
                },
              },
            },
          },
        },
        orderBy: { dateVersementPrevue: "asc" },
      },
    },
  });
  if (!invoice) return null;
  if (user.role !== "ADMIN" && invoice.userId !== user.id) return null;
  return invoice;
}
