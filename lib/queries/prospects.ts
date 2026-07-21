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

  // Sur la table prospects (~124k lignes), un count(*) exact non filtré coûte
  // ~150 ms à chaque affichage de la liste par défaut. Comme la pagination n'a
  // pas besoin d'un total au prospect près sur des dizaines de milliers de
  // lignes, on utilise l'estimation Postgres (reltuples, quasi instantanée)
  // UNIQUEMENT quand aucun filtre n'est appliqué. Dès qu'il y a un filtre ou une
  // recherche, on garde le count exact (rapide car sélectif / indexé trgm).
  const isUnfiltered = Object.keys(where).length === 0;

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
    isUnfiltered
      ? estimatedProspectTotal()
      : prisma.prospect.count({ where }),
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
 * Total approximatif de la table prospects via les statistiques Postgres
 * (`pg_class.reltuples`, tenues à jour par autovacuum/ANALYZE). Quasi instantané
 * — suffisant pour paginer une liste non filtrée de ~124k lignes. Repli sur un
 * count exact si l'estimation n'est pas disponible (table jamais analysée).
 */
async function estimatedProspectTotal(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT reltuples::bigint AS n FROM pg_class WHERE relname = 'prospects'`,
  );
  const n = Number(rows[0]?.n ?? 0);
  return n > 0 ? n : prisma.prospect.count();
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

/**
 * Parse une date de filtre "AAAA-MM-JJ" (input type=date) → début de la journée
 * LOCALE. Renvoie null si vide/invalide (le filtre est alors ignoré). On borne
 * au début du jour pour que "depuis le 13.07" inclue bien tout le 13.07.
 */
function parseDateFilter(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildProspectWhere(
  user: SessionUser,
  params: ProspectListParams,
): Prisma.ProspectWhereInput {
  const conditions: Prisma.ProspectWhereInput[] = [];

  // Row-level security
  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  // Filtres multi-sélection : un tableau vide = filtre inactif.
  if (params.statut.length > 0) {
    conditions.push({ statut: { in: params.statut } });
  }
  // Par défaut : toutes les entreprises (prospects + clients signés). Sophie
  // / Arthur ont une vue unifiée "fichier entreprises" — les détails par
  // statut sont gérés via le filtre.
  if (params.secteur.length > 0)
    conditions.push({ secteur: { in: params.secteur } });
  if (params.canton) conditions.push({ canton: params.canton });
  // Plusieurs villes → OR (fiche dans l'une OU l'autre).
  if (params.ville.length > 0)
    conditions.push({
      OR: params.ville.map((v) => ({
        ville: { contains: v, mode: "insensitive" as const },
      })),
    });
  if (params.avecTel === "1")
    conditions.push({
      OR: [{ telephone: { not: null } }, { telephoneMobile: { not: null } }],
    });
  if (params.assigneAId) conditions.push({ assigneAId: params.assigneAId });
  // Filtre par tag(s) : fiches portant AU MOINS UN des tags cochés.
  if (params.tagId.length > 0) {
    conditions.push({ tags: { some: { tagId: { in: params.tagId } } } });
  }
  // Filtre par produit(s) : clients SIGNÉS dont un contrat EN COURS contient l'un
  // des produits cochés. On exige un contrat réellement signé et actif — sinon un
  // simple brouillon (ATTENTE_SIGNATURE_CLIENT) ferait remonter un prospect non
  // signé, ce que « clients signés » exclut. On écarte aussi les contrats clos
  // (RÉSILIÉ / EXPIRÉ) : « produits qu'ils ont » = ce qu'ils détiennent encore.
  if (params.productId.length > 0) {
    conditions.push({
      contracts: {
        some: {
          statut: { in: ["ATTENTE_VALIDATION_ADMIN", "ACTIF", "SUSPENDU"] },
          products: { some: { id: { in: params.productId } } },
        },
      },
    });
  }
  // "Date d'ajout" : fiches créées à partir de cette date (jour inclus).
  const ajouteDepuis = parseDateFilter(params.ajouteDepuis);
  if (ajouteDepuis) conditions.push({ createdAt: { gte: ajouteDepuis } });
  // "Dernière action" : fiches dont la dernière action est à partir de cette
  // date (les fiches sans aucune action sont donc exclues — c'est voulu).
  const actionDepuis = parseDateFilter(params.actionDepuis);
  if (actionDepuis) conditions.push({ derniereActionLe: { gte: actionDepuis } });

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
