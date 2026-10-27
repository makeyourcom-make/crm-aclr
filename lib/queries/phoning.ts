/**
 * Requêtes du mode Phoning (/phoning) : la file d'appels de la commerciale.
 *
 * Périmètre (RLS) IDENTIQUE aux listes de prospects : un commercial ne voit
 * que SES prospects (`assigneAId = user.id`) ; un admin voit les siens par
 * défaut et peut afficher le portefeuille d'un autre utilisateur (`ownerId`).
 *
 * Ordre de la file :
 *   1. Rappels dus (en retard, puis du jour) : activités APPEL_SORTANT
 *      planifiées (rappels auto ou manuels) dont la date est passée ou tombe
 *      aujourd'hui, et qui n'ont pas déjà été « honorées » par un appel saisi
 *      après la création du rappel.
 *   2. Prospects chauds : proposition envoyée / RDV pris / qualifié, sans
 *      action depuis RECENT_ACTION_DAYS jours et sans rien de planifié.
 *   3. Nouveaux / jamais appelés : NOUVEAU, VIERGE, ou CONTACTE sans aucun
 *      appel, sans rien de planifié et pas déjà appelés aujourd'hui.
 *
 * Exclus partout : NE_PAS_RAPPELER, NUMERO_INVALIDE, SIGNE, PERDU, et les
 * fiches sans aucun numéro de téléphone.
 *
 * Les journées sont découpées en fuseau Europe/Zurich (dates stockées en UTC).
 * Lecture seule : aucune écriture ici, la file se recalcule à chaque rendu.
 */
import type {
  ActivityResultat,
  ActivityStatut,
  ActivityType,
  Prisma,
  ProspectSecteur,
  ProspectStatut,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type PhoningReason = "RAPPEL_RETARD" | "RAPPEL_JOUR" | "CHAUD" | "NOUVEAU";

export interface PhoningRecentActivity {
  id: string;
  type: ActivityType;
  date: Date;
  statut: ActivityStatut;
  resultat: ActivityResultat | null;
  sujet: string;
  note: string | null;
}

export interface PhoningQueueItem {
  id: string;
  raisonSociale: string;
  contactPrenom: string | null;
  contactNom: string | null;
  contactFonction: string | null;
  telephone: string | null;
  telephoneMobile: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  canton: string | null;
  secteur: ProspectSecteur | null;
  statut: ProspectStatut;
  notesGenerales: string | null;
  createdAt: Date;
  derniereActionLe: Date | null;
  reason: PhoningReason;
  /** Rappel dû à l'origine de la présence dans la file (tier 1). */
  rappel: {
    id: string;
    date: Date;
    sujet: string;
    /** Appel d'origine du rappel auto (résultat + date), si connu. */
    origine: { resultat: ActivityResultat | null; date: Date } | null;
  } | null;
  /** Nombre d'appels sortants déjà passés (statut FAIT). */
  tentatives: number;
  /** Date du dernier appel sortant passé (FAIT), null si jamais. */
  dernierAppel: Date | null;
  /** Dernières activités passées (4 max, la plus récente en premier). */
  recent: PhoningRecentActivity[];
}

export interface PhoningQueue {
  items: PhoningQueueItem[];
  counts: { rappels: number; chauds: number; nouveaux: number; total: number };
  /** Vrai si la file a été tronquée (il reste des prospects au-delà). */
  truncated: boolean;
}

export interface PhoningDayCall {
  id: string;
  date: Date;
  /** Durée réelle en secondes (widget d'appel), null si inconnue. */
  duree2: number | null;
  statut: ActivityStatut;
  resultat: ActivityResultat | null;
  prospectId: string | null;
  raisonSociale: string | null;
}

export interface PhoningAgendaItem {
  id: string;
  date: Date;
  type: ActivityType;
  sujet: string;
  raisonSociale: string | null;
}

// ---------------------------------------------------------------------------
// RÉGLAGES
// ---------------------------------------------------------------------------

/** Un prospect chaud est « à relancer » sans action depuis ce nombre de jours. */
export const RECENT_ACTION_DAYS = 7;
/** Taille maximale de la file renvoyée (le reste arrive au rechargement). */
const MAX_ITEMS = 60;
const MAX_RAPPELS_SCAN = 500;
const MAX_CHAUDS = 30;

const EXCLUDED_STATUTS: ProspectStatut[] = [
  "NE_PAS_RAPPELER",
  "NUMERO_INVALIDE",
  "SIGNE",
  "PERDU",
];
const HOT_STATUTS: ProspectStatut[] = ["PROPOSITION_ENVOYEE", "RDV_PRIS", "QUALIFIE"];
const HOT_WEIGHT: Partial<Record<ProspectStatut, number>> = {
  PROPOSITION_ENVOYEE: 0,
  RDV_PRIS: 1,
  QUALIFIE: 2,
};
const PLANNED: ActivityStatut[] = ["PLANIFIE", "REPLANIFIE"];
const RDV_TYPES: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];

// ---------------------------------------------------------------------------
// FUSEAU EUROPE/ZURICH
// ---------------------------------------------------------------------------

const TZ = "Europe/Zurich";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Décalage (ms) de l'heure de Zurich par rapport à UTC à l'instant `at`. */
function zurichOffsetMs(at: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Minuit (heure de Zurich) du jour `y-m-d`, exprimé en instant UTC. */
function zurichMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

/** Bornes [début, fin] de la journée de Zurich contenant `now`. */
export function zurichDayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const [y, m, d] = dayKeyFmt.format(now).split("-").map(Number) as [number, number, number];
  const start = zurichMidnight(y, m, d);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const end = new Date(
    zurichMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()).getTime() - 1,
  );
  return { start, end };
}

// ---------------------------------------------------------------------------
// PÉRIMÈTRE
// ---------------------------------------------------------------------------

/**
 * Portefeuille affiché : un commercial est TOUJOURS limité au sien ; un admin
 * voit le sien par défaut, ou celui d'un autre utilisateur s'il le demande.
 */
export function resolvePhoningOwner(user: SessionUser, requested?: string | null): string {
  if (user.role !== "ADMIN") return user.id;
  return requested && requested.trim() ? requested.trim() : user.id;
}

function eligibleWhere(ownerId: string): Prisma.ProspectWhereInput {
  return {
    assigneAId: ownerId,
    statut: { notIn: EXCLUDED_STATUTS },
    OR: [
      { AND: [{ telephone: { not: null } }, { telephone: { not: "" } }] },
      { AND: [{ telephoneMobile: { not: null } }, { telephoneMobile: { not: "" } }] },
    ],
  };
}

const PROSPECT_SELECT = {
  id: true,
  raisonSociale: true,
  contactPrenom: true,
  contactNom: true,
  contactFonction: true,
  telephone: true,
  telephoneMobile: true,
  adresse: true,
  codePostal: true,
  ville: true,
  canton: true,
  secteur: true,
  statut: true,
  notesGenerales: true,
  createdAt: true,
  derniereActionLe: true,
  activities: {
    where: { statut: { notIn: PLANNED } },
    orderBy: { date: "desc" },
    take: 4,
    select: {
      id: true,
      type: true,
      date: true,
      statut: true,
      resultat: true,
      sujet: true,
      notesResultat: true,
      contenu: true,
    },
  },
} satisfies Prisma.ProspectSelect;

type ProspectRow = Prisma.ProspectGetPayload<{ select: typeof PROSPECT_SELECT }>;

// ---------------------------------------------------------------------------
// FILE D'APPELS
// ---------------------------------------------------------------------------

export async function getPhoningQueue(
  user: SessionUser,
  ownerId: string,
): Promise<PhoningQueue> {
  // Garde-fou RLS (défense en profondeur) : un commercial ne lit que le sien.
  const owner = user.role === "ADMIN" ? ownerId : user.id;
  const now = new Date();
  const { start: startOfToday, end: endOfToday } = zurichDayBounds(now);
  const staleBefore = new Date(now.getTime() - RECENT_ACTION_DAYS * 86_400_000);
  const eligible = eligibleWhere(owner);

  // ---- 1. Rappels dus -----------------------------------------------------
  const rappelRows = await prisma.activity.findMany({
    where: {
      type: "APPEL_SORTANT",
      statut: { in: PLANNED },
      date: { lte: endOfToday },
      prospectId: { not: null },
      prospect: eligible,
    },
    orderBy: { date: "asc" },
    take: MAX_RAPPELS_SCAN,
    select: {
      id: true,
      date: true,
      createdAt: true,
      sujet: true,
      prospectId: true,
      rappelLeDe: { select: { resultat: true, date: true } },
    },
  });

  // Un rappel est honoré si un appel a été saisi (FAIT) APRÈS sa création.
  const rappelProspectIds = [
    ...new Set(rappelRows.map((r) => r.prospectId).filter((v): v is string => !!v)),
  ];
  const minCreated = rappelRows.reduce<Date | null>(
    (min, r) => (!min || r.createdAt < min ? r.createdAt : min),
    null,
  );
  const laterCalls =
    rappelProspectIds.length > 0 && minCreated
      ? await prisma.activity.findMany({
          where: {
            prospectId: { in: rappelProspectIds },
            type: "APPEL_SORTANT",
            statut: "FAIT",
            createdAt: { gte: minCreated },
          },
          select: { prospectId: true, createdAt: true },
        })
      : [];
  const lastCallCreated = new Map<string, number>();
  for (const c of laterCalls) {
    if (!c.prospectId) continue;
    const t = c.createdAt.getTime();
    if (t > (lastCallCreated.get(c.prospectId) ?? 0)) lastCallCreated.set(c.prospectId, t);
  }
  const rappelByProspect = new Map<string, (typeof rappelRows)[number]>();
  for (const r of rappelRows) {
    if (!r.prospectId || rappelByProspect.has(r.prospectId)) continue;
    const honored = (lastCallCreated.get(r.prospectId) ?? 0) > r.createdAt.getTime();
    if (!honored) rappelByProspect.set(r.prospectId, r);
  }
  const rappelIds = [...rappelByProspect.keys()];

  // ---- 2. Prospects chauds -------------------------------------------------
  const nothingPlanned: Prisma.ProspectWhereInput = {
    activities: { none: { statut: { in: PLANNED }, date: { gte: startOfToday } } },
  };
  const chaudWhere: Prisma.ProspectWhereInput = {
    AND: [
      eligible,
      { statut: { in: HOT_STATUTS } },
      { OR: [{ derniereActionLe: null }, { derniereActionLe: { lt: staleBefore } }] },
      nothingPlanned,
      { id: { notIn: rappelIds } },
    ],
  };

  // ---- 3. Nouveaux / jamais appelés ----------------------------------------
  const nouveauWhere = (excluded: string[]): Prisma.ProspectWhereInput => ({
    AND: [
      eligible,
      {
        OR: [
          { statut: { in: ["NOUVEAU", "VIERGE"] } },
          { statut: "CONTACTE", dernierAppelLe: null },
        ],
      },
      nothingPlanned,
      {
        activities: {
          none: { type: "APPEL_SORTANT", statut: "FAIT", date: { gte: startOfToday } },
        },
      },
      { id: { notIn: excluded } },
    ],
  });

  const [chaudRows, chaudCount] = await Promise.all([
    prisma.prospect.findMany({
      where: chaudWhere,
      orderBy: [{ derniereActionLe: { sort: "asc", nulls: "first" } }],
      take: MAX_CHAUDS,
      select: PROSPECT_SELECT,
    }),
    prisma.prospect.count({ where: chaudWhere }),
  ]);
  chaudRows.sort(
    (a, b) =>
      (HOT_WEIGHT[a.statut] ?? 9) - (HOT_WEIGHT[b.statut] ?? 9) ||
      (a.derniereActionLe?.getTime() ?? 0) - (b.derniereActionLe?.getTime() ?? 0),
  );

  const excludedForNew = [...rappelIds, ...chaudRows.map((p) => p.id)];
  const remainingSlots = Math.max(
    0,
    MAX_ITEMS - Math.min(rappelIds.length, MAX_ITEMS) - chaudRows.length,
  );
  const [nouveauRows, nouveauCount, rappelProspects] = await Promise.all([
    remainingSlots > 0
      ? prisma.prospect.findMany({
          where: nouveauWhere(excludedForNew),
          orderBy: { createdAt: "desc" },
          take: remainingSlots,
          select: PROSPECT_SELECT,
        })
      : Promise.resolve([] as ProspectRow[]),
    prisma.prospect.count({ where: nouveauWhere(excludedForNew) }),
    rappelIds.length > 0
      ? prisma.prospect.findMany({
          where: { id: { in: rappelIds.slice(0, MAX_ITEMS) } },
          select: PROSPECT_SELECT,
        })
      : Promise.resolve([] as ProspectRow[]),
  ]);

  // ---- Assemblage ------------------------------------------------------------
  const rappelProspectMap = new Map(rappelProspects.map((p) => [p.id, p]));
  const ordered: { row: ProspectRow; reason: PhoningReason }[] = [];
  for (const id of rappelIds.slice(0, MAX_ITEMS)) {
    const row = rappelProspectMap.get(id);
    const r = rappelByProspect.get(id);
    if (!row || !r) continue;
    ordered.push({ row, reason: r.date < startOfToday ? "RAPPEL_RETARD" : "RAPPEL_JOUR" });
  }
  for (const row of chaudRows) ordered.push({ row, reason: "CHAUD" });
  for (const row of nouveauRows) ordered.push({ row, reason: "NOUVEAU" });
  const slice = ordered.slice(0, MAX_ITEMS);

  // Tentatives et dernier appel (une seule requête groupée).
  const ids = slice.map((o) => o.row.id);
  const callStats =
    ids.length > 0
      ? await prisma.activity.groupBy({
          by: ["prospectId"],
          where: { prospectId: { in: ids }, type: "APPEL_SORTANT", statut: "FAIT" },
          _count: { _all: true },
          _max: { date: true },
        })
      : [];
  const statsMap = new Map(callStats.map((s) => [s.prospectId, s]));

  const items: PhoningQueueItem[] = slice.map(({ row, reason }) => {
    const r = rappelByProspect.get(row.id);
    const s = statsMap.get(row.id);
    return {
      id: row.id,
      raisonSociale: row.raisonSociale,
      contactPrenom: row.contactPrenom,
      contactNom: row.contactNom,
      contactFonction: row.contactFonction,
      telephone: row.telephone?.trim() || null,
      telephoneMobile: row.telephoneMobile?.trim() || null,
      adresse: row.adresse,
      codePostal: row.codePostal,
      ville: row.ville,
      canton: row.canton,
      secteur: row.secteur,
      statut: row.statut,
      notesGenerales: row.notesGenerales,
      createdAt: row.createdAt,
      derniereActionLe: row.derniereActionLe,
      reason,
      rappel:
        r && (reason === "RAPPEL_RETARD" || reason === "RAPPEL_JOUR")
          ? {
              id: r.id,
              date: r.date,
              sujet: r.sujet,
              origine: r.rappelLeDe
                ? { resultat: r.rappelLeDe.resultat, date: r.rappelLeDe.date }
                : null,
            }
          : null,
      tentatives: s?._count._all ?? 0,
      dernierAppel: s?._max.date ?? null,
      recent: row.activities.map((a) => ({
        id: a.id,
        type: a.type,
        date: a.date,
        statut: a.statut,
        resultat: a.resultat,
        sujet: a.sujet,
        note: a.notesResultat ?? a.contenu ?? null,
      })),
    };
  });

  const counts = {
    rappels: rappelIds.length,
    chauds: chaudCount,
    nouveaux: nouveauCount,
    total: rappelIds.length + chaudCount + nouveauCount,
  };
  return { items, counts, truncated: counts.total > items.length };
}

// ---------------------------------------------------------------------------
// APPELS DU JOUR (session, stats) - de l'utilisateur connecté
// ---------------------------------------------------------------------------

/**
 * Appels sortants passés aujourd'hui par l'utilisateur (même définition que le
 * moteur de résultats : APPEL_SORTANT au statut FAIT ou EN_COURS), du plus ancien au
 * plus récent. Sert au chrono de session et aux stats de session.
 */
export async function getPhoningDayCalls(userId: string): Promise<PhoningDayCall[]> {
  const { start, end } = zurichDayBounds();
  const rows = await prisma.activity.findMany({
    where: {
      userId,
      type: "APPEL_SORTANT",
      statut: { in: ["FAIT", "EN_COURS"] },
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
    take: 400,
    select: {
      id: true,
      date: true,
      duree2: true,
      statut: true,
      resultat: true,
      prospectId: true,
      prospect: { select: { raisonSociale: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    duree2: r.duree2,
    statut: r.statut,
    resultat: r.resultat,
    prospectId: r.prospectId,
    raisonSociale: r.prospect?.raisonSociale ?? null,
  }));
}

/**
 * RDV planifiés de l'utilisateur sur les 3 prochaines semaines : affichés dans
 * le mini-formulaire « RDV pris » pour éviter les doublons de créneau.
 */
export async function getPhoningAgenda(userId: string): Promise<PhoningAgendaItem[]> {
  const { start } = zurichDayBounds();
  const until = new Date(start.getTime() + 22 * 86_400_000);
  const rows = await prisma.activity.findMany({
    where: {
      userId,
      type: { in: RDV_TYPES },
      statut: { in: PLANNED },
      date: { gte: start, lte: until },
    },
    orderBy: { date: "asc" },
    take: 120,
    select: {
      id: true,
      date: true,
      type: true,
      sujet: true,
      prospect: { select: { raisonSociale: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    sujet: r.sujet,
    raisonSociale: r.prospect?.raisonSociale ?? null,
  }));
}
