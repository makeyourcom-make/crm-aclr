/**
 * Requêtes de lecture pour le module Prospects (rubrique « Entreprises »).
 *
 * Ces fonctions sont appelées depuis des Server Components. Elles appliquent
 * automatiquement le scoping par rôle (un commercial ne voit que ses
 * propres prospects).
 *
 * Pour les mutations (create/update/delete), voir app/(app)/prospects/actions.ts.
 *
 * Les vues rapides (« Les plus chaudes », « Jamais appelées »…)
 * et le filtre de fraîcheur reposent sur les colonnes dénormalisées
 * (derniereActionLe, dernierAppelLe, dateRdvLe) et sur les MÊMES règles que
 * la chaleur calculée côté affichage (components/prospects/lead-heat.ts).
 */
import type { Prisma } from "@prisma/client";

import {
  ENGAGED_STATUTS,
  HEAT_RULES,
  LEAD_STATUTS,
  OPEN_DEAL_STAGES,
  PIPELINE_STATUTS,
  sinceMs,
} from "@/components/prospects/lead-heat";
import type {
  ProspectFraicheur,
  ProspectVue,
} from "@/components/prospects/lead-views";
import {
  zurichStartOfDay,
  zurichStartOfMonth,
} from "@/components/prospects/zurich-format";
import { prisma } from "@/lib/db";
import type { ProspectListParams } from "@/lib/schemas/prospect";
import { type SessionUser } from "@/lib/session";

/** Relations chargées pour chaque ligne de la liste. */
const LIST_INCLUDE = {
  tags: {
    include: {
      tag: { select: { id: true, nom: true, couleur: true } },
    },
  },
  // Un deal ouvert suffit à savoir si la fiche « chauffe » (chaleur).
  deals: {
    where: { stage: { in: [...OPEN_DEAL_STAGES] } },
    select: { id: true },
    take: 1,
  },
  // Plus ancienne action encore planifiée (en retard ou à venir) : colonne
  // « Prochaine action ».
  activities: {
    where: { statut: "PLANIFIE" },
    orderBy: { date: "asc" },
    select: { id: true, type: true, date: true },
    take: 1,
  },
} satisfies Prisma.ProspectInclude;

export type ProspectListItem = Prisma.ProspectGetPayload<{
  include: typeof LIST_INCLUDE;
}>;

export interface ProspectListResult {
  items: ProspectListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Filtres « arena » ajoutés aux paramètres classiques de la liste. */
export interface ProspectListExtras {
  vue?: ProspectVue;
  fraicheur?: ProspectFraicheur;
  /** Horloge de référence (défaut : maintenant). */
  now?: Date;
}

/**
 * Liste paginée + filtrée des prospects pour l'utilisateur courant.
 */
export async function getProspects(
  user: SessionUser,
  params: ProspectListParams,
  extras: ProspectListExtras = {},
): Promise<ProspectListResult> {
  const where = buildProspectWhere(user, params, extras);

  // Les colonnes de dates dénormalisées sont NULL pour la grande majorité des
  // fiches (une action / un contrat ne concernent qu'une minorité des 124k
  // lignes). En Postgres, DESC place les NULL EN PREMIER : sans forcer
  // `nulls: "last"`, trier « Début contrat » desc afficherait des milliers de
  // fiches vides avant le moindre client. On veut toujours les valeurs d'abord.
  const nullsLastCols = new Set([
    "contratDebutLe",
    "derniereActionLe",
    "dernierAppelLe",
    "dateRdvLe",
  ]);
  const orderBy: Prisma.ProspectOrderByWithRelationInput = nullsLastCols.has(
    params.sortBy,
  )
    ? { [params.sortBy]: { sort: params.sortDir, nulls: "last" } }
    : { [params.sortBy]: params.sortDir };

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
      include: LIST_INCLUDE,
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
 * : suffisant pour paginer une liste non filtrée de ~124k lignes. Repli sur un
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
 * Périmètre « portefeuille » : un commercial = ses fiches ; l'admin = tout,
 * ou le portefeuille d'une commerciale précise s'il la sélectionne.
 */
function portfolioWhere(
  user: SessionUser,
  assigneAId?: string,
): Prisma.ProspectWhereInput {
  if (user.role !== "ADMIN") return { assigneAId: user.id };
  return assigneAId ? { assigneAId } : {};
}

/**
 * Stats sur les prospects (pour les bandeaux de la liste).
 * Sépare actifs (en cours de prospection) et signés (migrés vers /contrats).
 *
 * `assigneAId` (optionnel, admin uniquement) : restreint le comptage au
 * portefeuille d'un commercial précis, pour afficher « X entreprises
 * attribuées à … » quand on sélectionne une commerciale dans le filtre.
 * Un commercial reste toujours limité à ses propres fiches (RLS).
 */
export async function getProspectStats(
  user: SessionUser,
  assigneAId?: string,
) {
  const scopeWhere = portfolioWhere(user, assigneAId);

  const parStatut = await prisma.prospect.groupBy({
    by: ["statut"],
    where: scopeWhere,
    _count: true,
  });

  const byStatut: Partial<Record<(typeof parStatut)[number]["statut"], number>> =
    Object.fromEntries(parStatut.map((s) => [s.statut, s._count]));

  const total = parStatut.reduce((sum, s) => sum + s._count, 0);
  const nbSignes = byStatut.SIGNE ?? 0;
  const nbActifs = total - nbSignes;

  return { total, byStatut, nbActifs, nbSignes };
}

// ===========================================================================
// MYC ARENA : héros, vues rapides
// ===========================================================================

export interface LeadsOverview {
  /** Nombre de fiches par vue rapide (périmètre portefeuille). */
  vues: Record<Exclude<ProspectVue, "toutes">, number>;
  /** RDV planifiés à venir sur le portefeuille. */
  rdv: { count: number; tomorrow: number; next: Date | null };
  /** Entreprises appelées (distinctes) sur 7 jours glissants vs les 7 précédents. */
  called: { last7: number; prev7: number };
  /** Contrats réellement signés ce mois-ci (mêmes exclusions que stats.ts). */
  signed: { count: number; ca: number; target: number | null };
}

/**
 * Chiffres du héros et compteurs des vues rapides, sur le portefeuille
 * (commercial = ses fiches ; admin = tout ou la commerciale sélectionnée).
 * Toutes les requêtes partent en parallèle.
 */
export async function getLeadsOverview(
  user: SessionUser,
  opts: { assigneAId?: string; now?: Date } = {},
): Promise<LeadsOverview> {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const scope = portfolioWhere(user, opts.assigneAId);
  const scopeUserId =
    user.role !== "ADMIN" ? user.id : (opts.assigneAId ?? null);
  const contractScope: Prisma.ContractWhereInput = scopeUserId
    ? { assigneAId: scopeUserId }
    : {};

  const and = (w: Prisma.ProspectWhereInput): Prisma.ProspectWhereInput =>
    Object.keys(scope).length > 0 ? { AND: [scope, w] } : w;

  const tomorrowStart = zurichStartOfDay(nowMs, 1);
  const afterTomorrowStart = zurichStartOfDay(nowMs, 2);
  const monthStart = zurichStartOfMonth(nowMs);
  const since7 = new Date(sinceMs(nowMs, 7));
  const since14 = new Date(sinceMs(nowMs, 14));

  const rdvWhere: Prisma.ActivityWhereInput = {
    type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
    statut: { in: ["PLANIFIE", "REPLANIFIE"] },
    date: { gt: now },
    prospect: scope,
  };
  const callWhere = (gte: Date, lt: Date): Prisma.ActivityWhereInput => ({
    type: "APPEL_SORTANT",
    statut: { in: ["FAIT", "EN_COURS"] },
    date: { gte, lt },
    prospectId: { not: null },
    prospect: scope,
  });

  const [
    chaudes,
    jamais,
    rdvFiches,
    relancer,
    refroidit,
    rdvCount,
    rdvTomorrow,
    rdvNext,
    calledLast,
    calledPrev,
    signedAgg,
    objective,
  ] = await Promise.all([
    prisma.prospect.count({ where: and(vueWhere("chaudes", now)!) }),
    prisma.prospect.count({ where: and(vueWhere("jamais", now)!) }),
    prisma.prospect.count({ where: and(vueWhere("rdv", now)!) }),
    prisma.prospect.count({ where: and(vueWhere("relancer", now)!) }),
    prisma.prospect.count({ where: and(vueWhere("refroidit", now)!) }),
    prisma.activity.count({ where: rdvWhere }),
    prisma.activity.count({
      where: { ...rdvWhere, date: { gte: tomorrowStart, lt: afterTomorrowStart } },
    }),
    prisma.activity.findFirst({
      where: rdvWhere,
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.activity.groupBy({
      by: ["prospectId"],
      where: callWhere(since7, new Date(nowMs + 1)),
    }),
    prisma.activity.groupBy({
      by: ["prospectId"],
      where: callWhere(since14, since7),
    }),
    prisma.contract.aggregate({
      where: {
        ...contractScope,
        statut: {
          notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
        },
        dateSignature: { gte: monthStart, lte: now },
      },
      _count: true,
      _sum: { valeurAn1: true },
    }),
    scopeUserId
      ? prisma.objective.findFirst({
          where: {
            userId: scopeUserId,
            periode: "MENSUEL",
            isActif: true,
            dateDebut: { lte: now },
            dateFin: { gte: monthStart },
          },
          orderBy: { createdAt: "desc" },
          select: { nbSignaturesObjectif: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    vues: { chaudes, jamais, rdv: rdvFiches, relancer, refroidit },
    rdv: { count: rdvCount, tomorrow: rdvTomorrow, next: rdvNext?.date ?? null },
    called: { last7: calledLast.length, prev7: calledPrev.length },
    signed: {
      count: signedAgg._count,
      ca: Number(signedAgg._sum.valeurAn1 ?? 0),
      target: objective?.nbSignaturesObjectif ?? null,
    },
  };
}

// ===========================================================================
// INTERNAL : construction du WHERE
// ===========================================================================

/**
 * Filtre d'une vue rapide. Les règles « chaudes » reproduisent EXACTEMENT le
 * niveau ≥ 4 de `computeLeadHeat` (components/prospects/lead-heat.ts).
 * Renvoie null pour « toutes ».
 */
export function vueWhere(
  vue: ProspectVue,
  now: Date,
): Prisma.ProspectWhereInput | null {
  const nowMs = now.getTime();
  const since7 = new Date(sinceMs(nowMs, HEAT_RULES.hotDays));
  const since30 = new Date(sinceMs(nowMs, HEAT_RULES.warmDays));
  const sinceRelance = new Date(sinceMs(nowMs, HEAT_RULES.relanceDays));
  const leads = { statut: { in: [...LEAD_STATUTS] } };

  switch (vue) {
    case "chaudes":
      return {
        AND: [
          leads,
          {
            OR: [
              { dateRdvLe: { gt: now } },
              {
                statut: { in: [...PIPELINE_STATUTS] },
                derniereActionLe: { gte: since30 },
              },
              { statut: "CONTACTE", derniereActionLe: { gte: since7 } },
              {
                derniereActionLe: { gte: since30 },
                deals: { some: { stage: { in: [...OPEN_DEAL_STAGES] } } },
              },
            ],
          },
        ],
      };
    case "jamais":
      return { AND: [leads, { dernierAppelLe: null }] };
    case "rdv":
      return { dateRdvLe: { gt: now } };
    case "relancer":
      return {
        statut: "PROPOSITION_ENVOYEE",
        OR: [{ derniereActionLe: null }, { derniereActionLe: { lt: sinceRelance } }],
      };
    case "refroidit":
      return {
        AND: [
          { statut: { in: [...ENGAGED_STATUTS] } },
          { derniereActionLe: { gte: since30, lt: since7 } },
          // `NOT { gt }` exclurait aussi les NULL (logique SQL à 3 valeurs).
          { OR: [{ dateRdvLe: null }, { dateRdvLe: { lte: now } }] },
        ],
      };
    default:
      return null;
  }
}

function fraicheurWhere(
  f: ProspectFraicheur,
  now: Date,
): Prisma.ProspectWhereInput {
  const nowMs = now.getTime();
  const since7 = new Date(sinceMs(nowMs, HEAT_RULES.hotDays));
  const since30 = new Date(sinceMs(nowMs, HEAT_RULES.warmDays));
  if (f === "chaud") return { derniereActionLe: { gte: since7 } };
  if (f === "tiede") return { derniereActionLe: { gte: since30, lt: since7 } };
  return { OR: [{ derniereActionLe: null }, { derniereActionLe: { lt: since30 } }] };
}

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
  extras: ProspectListExtras = {},
): Prisma.ProspectWhereInput {
  const conditions: Prisma.ProspectWhereInput[] = [];
  const now = extras.now ?? new Date();

  // Fiches fusionnées dans un doublon : masquées de la liste active.
  conditions.push({ mergedIntoId: null });

  // Row-level security
  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  // Filtres multi-sélection : un tableau vide = filtre inactif.
  if (params.statut.length > 0) {
    conditions.push({ statut: { in: params.statut } });
  }
  // Par défaut : toutes les entreprises (prospects + clients signés). Sophie
  // / Arthur ont une vue unifiée "fichier entreprises" ; les détails par
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
  // des produits cochés. On exige un contrat réellement signé et actif, sinon un
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
  // date (les fiches sans aucune action sont donc exclues, c'est voulu).
  const actionDepuis = parseDateFilter(params.actionDepuis);
  if (actionDepuis) conditions.push({ derniereActionLe: { gte: actionDepuis } });

  // Vue rapide + fraîcheur de la dernière action.
  if (extras.vue) {
    const w = vueWhere(extras.vue, now);
    if (w) conditions.push(w);
  }
  if (extras.fraicheur) conditions.push(fraicheurWhere(extras.fraicheur, now));

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
