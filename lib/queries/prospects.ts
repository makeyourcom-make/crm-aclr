/**
 * Requêtes de lecture pour le module Prospects.
 *
 * Ces fonctions sont appelées depuis des Server Components. Elles appliquent
 * automatiquement le scoping par rôle (un commercial ne voit que ses
 * propres prospects).
 *
 * Pour les mutations (create/update/delete), voir app/(app)/prospects/actions.ts.
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ProspectListParams } from "@/lib/schemas/prospect";
import { type SessionUser } from "@/lib/session";

export interface ProspectListResult {
  items: Awaited<ReturnType<typeof prisma.prospect.findMany>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Liste paginée + filtrée des prospects pour l'utilisateur courant.
 */
export async function getProspects(
  user: SessionUser,
  params: ProspectListParams,
): Promise<ProspectListResult> {
  const where = buildProspectWhere(user, params);

  const orderBy: Prisma.ProspectOrderByWithRelationInput = {
    [params.sortBy]: params.sortDir,
  };

  const [items, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        tags: {
          include: {
            tag: { select: { id: true, nom: true, couleur: true } },
          },
        },
      },
    }),
    prisma.prospect.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/**
 * Récupère un prospect par son ID. Renvoie null si introuvable ou si
 * l'utilisateur n'y a pas accès (commercial sur un prospect non-assigné).
 */
export async function getProspectById(user: SessionUser, id: string) {
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      assigneA: { select: { id: true, name: true } },
      tags: {
        include: {
          tag: {
            select: { id: true, nom: true, couleur: true, description: true },
          },
        },
      },
      _count: {
        select: { activities: true, deals: true, contracts: true },
      },
    },
  });

  if (!prospect) return null;

  // Row-level security
  if (user.role !== "ADMIN" && prospect.assigneAId !== user.id) {
    return null;
  }

  return prospect;
}

/**
 * Stats globales sur les prospects (pour les bandeaux de la liste).
 * Sépare actifs (en cours de prospection) et signés (migrés vers /contrats).
 */
export async function getProspectStats(user: SessionUser) {
  const scopeWhere = user.role === "ADMIN" ? {} : { assigneAId: user.id };

  const parStatut = await prisma.prospect.groupBy({
    by: ["statut"],
    where: scopeWhere,
    _count: true,
  });

  const byStatut = Object.fromEntries(
    parStatut.map((s) => [s.statut, s._count]),
  );

  const total = parStatut.reduce((sum, s) => sum + s._count, 0);
  const nbSignes = byStatut.SIGNE ?? 0;
  const nbActifs = total - nbSignes;

  return { total, byStatut, nbActifs, nbSignes };
}

// ===========================================================================
// INTERNAL — construction du WHERE
// ===========================================================================

function buildProspectWhere(
  user: SessionUser,
  params: ProspectListParams,
): Prisma.ProspectWhereInput {
  const conditions: Prisma.ProspectWhereInput[] = [];

  // Row-level security
  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  // Filtres
  if (params.statut) {
    conditions.push({ statut: params.statut });
  }
  // Par défaut : toutes les entreprises (prospects + clients signés). Sophie
  // / Arthur ont une vue unifiée "fichier entreprises" — les détails par
  // statut sont gérés via le filtre.
  if (params.secteur) conditions.push({ secteur: params.secteur });
  if (params.canton) conditions.push({ canton: params.canton });
  if (params.assigneAId) conditions.push({ assigneAId: params.assigneAId });
  // Filtre par tag : récupère les prospects ayant ce tagId via la table de jonction
  if (params.tagId) {
    conditions.push({ tags: { some: { tagId: params.tagId } } });
  }

  // Recherche full-text simple (LIKE multi-champs, insensible à la casse)
  if (params.q && params.q.length > 0) {
    conditions.push({
      OR: [
        { raisonSociale: { contains: params.q, mode: "insensitive" } },
        { contactNom: { contains: params.q, mode: "insensitive" } },
        { contactPrenom: { contains: params.q, mode: "insensitive" } },
        { email: { contains: params.q, mode: "insensitive" } },
        { ville: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
