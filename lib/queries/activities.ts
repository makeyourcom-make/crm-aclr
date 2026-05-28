/**
 * Requêtes de lecture pour le module Activités.
 *
 * Toutes les requêtes appliquent le scoping par rôle : un commercial ne
 * voit que les activités liées à ses prospects assignés.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ActivityListParams } from "@/lib/schemas/activity";
import { type SessionUser } from "@/lib/session";

// Type d'une Activity avec ses relations chargées (preuve à TS)
export type ActivityWithProspectUser = Prisma.ActivityGetPayload<{
  include: {
    prospect: { select: { id: true; raisonSociale: true; telephone: true } };
    user: { select: { id: true; name: true } };
  };
}>;

export type ActivityWithUser = Prisma.ActivityGetPayload<{
  include: {
    user: { select: { id: true; name: true } };
    rappelLeDe: { select: { id: true; type: true; date: true } };
  };
}>;

// ===========================================================================
// TIMELINE d'un prospect (avec inclusion des relations)
// ===========================================================================

export async function getProspectActivities(
  prospectId: string,
  user: SessionUser,
) {
  // RLS : un commercial ne voit que les activités sur ses prospects assignés
  if (user.role !== "ADMIN") {
    const p = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { assigneAId: true },
    });
    if (!p || p.assigneAId !== user.id) {
      return [];
    }
  }

  return prisma.activity.findMany({
    where: { prospectId },
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      rappelLeDe: {
        select: { id: true, type: true, date: true },
      },
    },
    take: 100, // garde-fou perf — les plus anciennes sont raremement utiles
  });
}

// ===========================================================================
// LISTE GLOBALE — pour /activites
// ===========================================================================

export interface ActivityListResult {
  items: ActivityWithProspectUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getActivities(
  user: SessionUser,
  params: ActivityListParams,
): Promise<ActivityListResult> {
  const where = buildActivityWhere(user, params);

  const orderBy: Prisma.ActivityOrderByWithRelationInput = {
    [params.sortBy]: params.sortDir,
  };

  const [items, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        prospect: {
          select: { id: true, raisonSociale: true, telephone: true },
        },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

// ===========================================================================
// COMPTEUR D'APPELS DU JOUR (sidebar / dashboard)
// ===========================================================================

export async function getTodayCallStats(user: SessionUser) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const whereOwn = user.role === "ADMIN" ? {} : { userId: user.id };

  const [appelsSortants, rdvFaits, emailsEnvoyes] = await Promise.all([
    prisma.activity.count({
      where: {
        ...whereOwn,
        type: "APPEL_SORTANT",
        date: { gte: start, lte: end },
        statut: { in: ["FAIT", "EN_COURS"] },
      },
    }),
    prisma.activity.count({
      where: {
        ...whereOwn,
        type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
        date: { gte: start, lte: end },
        statut: "FAIT",
      },
    }),
    prisma.activity.count({
      where: {
        ...whereOwn,
        type: "EMAIL_ENVOYE",
        date: { gte: start, lte: end },
      },
    }),
  ]);

  return { appelsSortants, rdvFaits, emailsEnvoyes };
}

// ===========================================================================
// INTERNAL — WHERE builder
// ===========================================================================

function buildActivityWhere(
  user: SessionUser,
  params: ActivityListParams,
): Prisma.ActivityWhereInput {
  const conditions: Prisma.ActivityWhereInput[] = [];

  // RLS : commercial → ses propres activités OU celles sur ses prospects assignés
  if (user.role !== "ADMIN") {
    conditions.push({
      OR: [
        { userId: user.id },
        { prospect: { assigneAId: user.id } },
      ],
    });
  }

  if (params.type) conditions.push({ type: params.type });
  if (params.statut) conditions.push({ statut: params.statut });
  if (params.prospectId) conditions.push({ prospectId: params.prospectId });
  if (params.userId) conditions.push({ userId: params.userId });

  // Plage de dates
  if (params.range && params.range !== "all") {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    switch (params.range) {
      case "today":
        start.setHours(0, 0, 0, 0);
        conditions.push({ date: { gte: start, lte: end } });
        break;
      case "week": {
        const day = start.getDay() || 7; // dimanche = 0 → 7 (lundi = jour 1)
        start.setDate(start.getDate() - (day - 1));
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        conditions.push({ date: { gte: start, lte: end } });
        break;
      }
      case "month":
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        conditions.push({ date: { gte: start, lte: end } });
        break;
      case "overdue":
        conditions.push({
          date: { lt: now },
          statut: { in: ["PLANIFIE", "EN_COURS"] },
        });
        break;
    }
  }

  // Recherche full-text simple
  if (params.q && params.q.length > 0) {
    conditions.push({
      OR: [
        { sujet: { contains: params.q, mode: "insensitive" } },
        { contenu: { contains: params.q, mode: "insensitive" } },
        { notesResultat: { contains: params.q, mode: "insensitive" } },
        { prospect: { raisonSociale: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
