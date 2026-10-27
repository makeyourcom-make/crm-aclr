/**
 * Requêtes pour l'Agenda (vues jour / semaine / mois) et ses résultats RDV
 * (héros « RDV de la semaine », objectifs, record, RDV à valider).
 *
 * Deux périmètres coexistent, volontairement :
 *  - la GRILLE affiche les activités de l'agenda (créées par l'utilisateur OU
 *    rattachées à un prospect qui lui est assigné), comme historiquement ;
 *  - les COMPTEURS de résultats suivent les mêmes règles que les compteurs
 *    commerciaux (lib/gamification) : RDV client = type RDV_*, rattaché à un prospect,
 *    porté par l'utilisateur (`userId`). Les événements synchronisés sans
 *    client (Google / Infomaniak) ne comptent pas.
 *
 * Jours découpés en fuseau Europe/Zurich (dates stockées en UTC).
 */
import { Prisma, type ActivityStatut, type ActivityType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isWorkingDay } from "@/lib/planning/dates";
import type { SessionUser } from "@/lib/session";

import {
  addDaysKey,
  isoWeekNumber,
  keyToUtc,
  mondayOfKey,
  monthStartKey,
  addMonthsKey,
  zDayKey,
  zStartOfDay,
} from "./agenda-dates";

const AGENDA_INCLUDE = {
  prospect: {
    select: {
      id: true,
      raisonSociale: true,
      telephone: true,
      telephoneMobile: true,
      ville: true,
      contactNom: true,
      contactPrenom: true,
      contactFonction: true,
    },
  },
  user: { select: { id: true, name: true } },
} as const satisfies Prisma.ActivityInclude;

export type AgendaActivity = Prisma.ActivityGetPayload<{
  include: typeof AGENDA_INCLUDE;
}>;

/** Vue affichée dans l'agenda. */
export type AgendaView =
  /** Activités du user courant (commercial = scope normal, admin = ses propres). */
  | "mine"
  /** Activités de tous les users (admin uniquement). */
  | "all"
  /** Activités d'un user spécifique (admin qui regarde l'agenda d'une commerciale). */
  | string; // userId

export const RDV_TYPES: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];
/** Statuts d'un RDV pas encore validé (effectué / manqué / annulé). */
export const RDV_OPEN_STATUTS: ActivityStatut[] = ["PLANIFIE", "EN_COURS", "REPLANIFIE"];
/** Fenêtre de rappel des RDV à valider (identique au rappel du dashboard). */
const JOURS_RETRO_VALIDATION = 14;

export async function getAgendaWeek(
  user: SessionUser,
  weekStart: Date,
  hideDone: boolean,
  view: AgendaView = "mine",
): Promise<AgendaActivity[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return getAgendaRange(user, weekStart, weekEnd, hideDone, view);
}

/** Périmètre « grille » selon le rôle et la vue (RLS). */
function agendaScope(user: SessionUser, view: AgendaView): Prisma.ActivityWhereInput {
  if (user.role !== "ADMIN") {
    // Commercial : verrouillé à ses propres activités, quelle que soit la vue
    return { OR: [{ userId: user.id }, { prospect: { assigneAId: user.id } }] };
  }
  if (view === "all") return {}; // Admin → « Toute l'équipe »
  if (view === "mine") {
    // Admin → ses propres activités
    return { OR: [{ userId: user.id }, { prospect: { assigneAId: user.id } }] };
  }
  // Admin → agenda d'un user spécifique
  return { OR: [{ userId: view }, { prospect: { assigneAId: view } }] };
}

/** Activités sur un intervalle [start, end) quelconque (jour / semaine / mois). */
export async function getAgendaRange(
  user: SessionUser,
  start: Date,
  end: Date,
  hideDone: boolean,
  view: AgendaView = "mine",
): Promise<AgendaActivity[]> {
  return prisma.activity.findMany({
    where: {
      ...agendaScope(user, view),
      date: { gte: start, lt: end },
      ...(hideDone ? { statut: { not: "FAIT" } } : {}),
    },
    include: AGENDA_INCLUDE,
    orderBy: { date: "asc" },
  });
}

export function getStartOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7;
  x.setDate(x.getDate() - (day - 1));
  return x;
}

// ===========================================================================
// COUCHE DE JEU
// ===========================================================================

/** Joueur(s) dont on suit les compteurs selon la vue. */
export interface AgendaSubject {
  userIds: string[];
  /** self = soi-même · user = une commerciale précise · team = toute l'équipe */
  kind: "self" | "user" | "team";
  /** Nom affiché (« Lucille Bouin », « L'équipe »). */
  name: string;
}

export function resolveAgendaSubject(
  user: SessionUser,
  view: AgendaView,
  activeUsers: Array<{ id: string; name: string }>,
): AgendaSubject {
  if (user.role !== "ADMIN" || view === "mine") {
    return { userIds: [user.id], kind: "self", name: user.name };
  }
  if (view === "all") {
    const ids = activeUsers.map((u) => u.id);
    return { userIds: ids.length > 0 ? ids : [user.id], kind: "team", name: "L'équipe" };
  }
  const u = activeUsers.find((x) => x.id === view);
  if (!u) return { userIds: [view], kind: "user", name: "Agenda" };
  return { userIds: [u.id], kind: u.id === user.id ? "self" : "user", name: u.name };
}

export interface AgendaResults {
  todayKey: string;
  week: {
    startKey: string;
    endKey: string; // dimanche
    number: number;
    /** RDV clients calés cette semaine (hors annulés). */
    total: number;
    /** Effectués (FAIT, heure passée). */
    fait: number;
    manque: number;
    /** Encore à venir d'ici dimanche. */
    aVenir: number;
    /** RDV pris au phoning cette semaine (résultat d'appel RDV_PRIS). */
    rdvPrisPhoning: number;
    /** Jours ouvrés écoulés (aujourd'hui compris) sur les 5 de la semaine. */
    joursOuvresEcoules: number;
    joursOuvres: number;
    /** Jours ouvrés restants (aujourd'hui compris) sans aucun RDV client. */
    joursSansRdv: number;
  };
  /** Meilleure semaine passée (RDV clients calés, hors annulés). */
  record: number;
  objectives: {
    /** Objectif hebdomadaire de RDV (somme sur le périmètre), null si aucun. */
    weekly: number | null;
    /** Objectif mensuel de RDV (comparé aux RDV effectués, comme le dashboard). */
    monthly: number | null;
  };
  month: {
    key: string; // « AAAA-MM »
    fait: number;
    manque: number;
  };
  /** RDV passés pas encore validés (14 derniers jours), du plus ancien au plus récent. */
  pending: AgendaActivity[];
  /** Prochains RDV clients (5 max). */
  upcoming: AgendaActivity[];
}

/** Paramètre SQL : instant JS → timestamp UTC sans fuseau (format des colonnes). */
function ts(d: Date): Prisma.Sql {
  return Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

function dureeMinutes(a: { duree: number | null }): number {
  return a.duree && a.duree > 0 ? a.duree : 60;
}

/**
 * Données du héros : semaine ISO en cours (lundi → dimanche,
 * heure suisse), record, objectifs, RDV à valider et prochains RDV.
 * Requêtes légères (agrégats ou quelques lignes), lancées en parallèle.
 */
export async function getAgendaResults(subject: AgendaSubject): Promise<AgendaResults> {
  const now = new Date();
  const todayKey = zDayKey(now);
  const weekStartKey = mondayOfKey(todayKey);
  const weekStart = zStartOfDay(weekStartKey);
  const weekEnd = zStartOfDay(addDaysKey(weekStartKey, 7));
  const monthKey = monthStartKey(todayKey);
  const monthStart = zStartOfDay(monthKey);
  const monthEnd = zStartOfDay(addMonthsKey(monthKey, 1));
  const ids = subject.userIds;
  const userIn = Prisma.join(ids);

  const [weekRows, recordRows, objectives, monthGroups, pendingRows, upcoming, rdvPrisPhoning] =
    await Promise.all([
      prisma.activity.findMany({
        where: {
          userId: { in: ids },
          type: { in: RDV_TYPES },
          prospectId: { not: null },
          date: { gte: weekStart, lt: weekEnd },
        },
        select: { statut: true, date: true, duree: true },
      }),
      prisma.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n
        FROM activities a
        WHERE a."userId" IN (${userIn})
          AND a."type" IN ('RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE')
          AND a."prospectId" IS NOT NULL
          AND a."statut" <> 'ANNULE'
          AND a."date" < ${ts(weekStart)}
        GROUP BY date_trunc('week', (a."date" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Zurich'))
        ORDER BY n DESC
        LIMIT 1
      `,
      prisma.objective.findMany({
        where: {
          userId: { in: ids },
          isActif: true,
          periode: { in: ["HEBDOMADAIRE", "MENSUEL"] },
          nbRdvObjectif: { gt: 0 },
          dateDebut: { lt: monthEnd },
          dateFin: { gte: weekStart < monthStart ? weekStart : monthStart },
        },
        select: {
          userId: true,
          periode: true,
          nbRdvObjectif: true,
          dateDebut: true,
          dateFin: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activity.groupBy({
        by: ["statut"],
        where: {
          userId: { in: ids },
          type: { in: RDV_TYPES },
          prospectId: { not: null },
          statut: { in: ["FAIT", "MANQUE"] },
          date: { gte: monthStart, lte: now < monthEnd ? now : monthEnd },
        },
        _count: true,
      }),
      prisma.activity.findMany({
        where: {
          userId: { in: ids },
          type: { in: RDV_TYPES },
          prospectId: { not: null },
          statut: { in: RDV_OPEN_STATUTS },
          date: {
            gte: new Date(now.getTime() - JOURS_RETRO_VALIDATION * 86_400_000),
            lte: now,
          },
        },
        include: AGENDA_INCLUDE,
        orderBy: { date: "asc" },
        take: 60,
      }),
      prisma.activity.findMany({
        where: {
          userId: { in: ids },
          type: { in: RDV_TYPES },
          prospectId: { not: null },
          statut: { in: RDV_OPEN_STATUTS },
          date: { gt: now },
        },
        include: AGENDA_INCLUDE,
        orderBy: { date: "asc" },
        take: 5,
      }),
      prisma.activity.count({
        where: {
          userId: { in: ids },
          resultat: "RDV_PRIS",
          date: { gte: weekStart, lt: weekEnd },
        },
      }),
    ]);

  // ---- Semaine ----
  const nowMs = now.getTime();
  let total = 0;
  let fait = 0;
  let manque = 0;
  let aVenir = 0;
  const daysWithRdv = new Set<string>();
  for (const r of weekRows) {
    if (r.statut === "ANNULE") continue;
    total += 1;
    daysWithRdv.add(zDayKey(r.date));
    if (r.statut === "FAIT" && r.date.getTime() <= nowMs) fait += 1;
    if (r.statut === "MANQUE") manque += 1;
    if (RDV_OPEN_STATUTS.includes(r.statut) && r.date.getTime() > nowMs) aVenir += 1;
  }

  let joursOuvres = 0;
  let joursOuvresEcoules = 0;
  let joursSansRdv = 0;
  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(weekStartKey, i);
    if (!isWorkingDay(keyToUtc(key))) continue;
    joursOuvres += 1;
    if (key <= todayKey) joursOuvresEcoules += 1;
    if (key >= todayKey && !daysWithRdv.has(key)) joursSansRdv += 1;
  }

  // ---- Objectifs (le plus récent par utilisateur et par période) ----
  const pick = (periode: "HEBDOMADAIRE" | "MENSUEL", from: Date, to: Date): number | null => {
    const seen = new Set<string>();
    let sum = 0;
    for (const o of objectives) {
      if (o.periode !== periode || seen.has(o.userId)) continue;
      if (!(o.dateDebut < to && o.dateFin >= from)) continue;
      seen.add(o.userId);
      sum += o.nbRdvObjectif ?? 0;
    }
    return seen.size > 0 && sum > 0 ? sum : null;
  };

  // ---- RDV à valider : passés (fin du créneau dépassée), pas encore validés ----
  const pending = pendingRows.filter(
    (a) => a.date.getTime() + dureeMinutes(a) * 60_000 <= nowMs,
  );

  const monthCount = (s: ActivityStatut) =>
    monthGroups.find((g) => g.statut === s)?._count ?? 0;

  return {
    todayKey,
    week: {
      startKey: weekStartKey,
      endKey: addDaysKey(weekStartKey, 6),
      number: isoWeekNumber(weekStartKey),
      total,
      fait,
      manque,
      aVenir,
      rdvPrisPhoning,
      joursOuvresEcoules,
      joursOuvres,
      joursSansRdv,
    },
    record: recordRows[0]?.n ?? 0,
    objectives: {
      weekly: pick("HEBDOMADAIRE", weekStart, weekEnd),
      monthly: pick("MENSUEL", monthStart, monthEnd),
    },
    month: { key: monthKey.slice(0, 7), fait: monthCount("FAIT"), manque: monthCount("MANQUE") },
    pending,
    upcoming,
  };
}

/** RDV clients d'un jour (heure suisse). */
export interface DayRdvCount {
  /** Calés (hors annulés). */
  total: number;
  fait: number;
  manque: number;
}

/**
 * RDV clients par jour (clé « AAAA-MM-JJ ») sur [startKey, endKey[ :
 * alimente le mini-calendrier et la carte de chaleur de la vue Mois.
 */
export async function getRdvDayCounts(
  subject: AgendaSubject,
  startKey: string,
  endKey: string,
): Promise<Record<string, DayRdvCount>> {
  const rows = await prisma.$queryRaw<
    Array<{ d: string; total: number; fait: number; manque: number }>
  >`
    SELECT to_char((a."date" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Zurich')::date, 'YYYY-MM-DD') AS d,
      COUNT(*) FILTER (WHERE a."statut" <> 'ANNULE')::int AS total,
      COUNT(*) FILTER (WHERE a."statut" = 'FAIT' AND a."date" <= ${ts(new Date())})::int AS fait,
      COUNT(*) FILTER (WHERE a."statut" = 'MANQUE')::int AS manque
    FROM activities a
    WHERE a."userId" IN (${Prisma.join(subject.userIds)})
      AND a."type" IN ('RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE')
      AND a."prospectId" IS NOT NULL
      AND a."date" >= ${ts(zStartOfDay(startKey))}
      AND a."date" < ${ts(zStartOfDay(endKey))}
    GROUP BY 1
  `;
  const out: Record<string, DayRdvCount> = {};
  for (const r of rows) out[r.d] = { total: r.total, fait: r.fait, manque: r.manque };
  return out;
}

/**
 * RDV « décrochés au phoning » : pour chaque RDV client, le jour de l'appel
 * au résultat RDV_PRIS sur le même prospect, passé au plus 2 jours avant la
 * saisie du RDV (ou pendant l'appel : le RDV est souvent saisi avant le
 * résultat). Renvoie { idDuRdv: "AAAA-MM-JJ" }.
 */
export async function getPhoningOrigins(
  rdvs: Array<Pick<AgendaActivity, "id" | "type" | "prospectId" | "createdAt">>,
): Promise<Record<string, string>> {
  const candidates = rdvs.filter((a) => RDV_TYPES.includes(a.type) && a.prospectId);
  if (candidates.length === 0) return {};
  const prospectIds = [...new Set(candidates.map((a) => a.prospectId as string))];
  const calls = await prisma.activity.findMany({
    where: { resultat: "RDV_PRIS", prospectId: { in: prospectIds } },
    select: { prospectId: true, date: true },
  });
  if (calls.length === 0) return {};
  const byProspect = new Map<string, Date[]>();
  for (const c of calls) {
    if (!c.prospectId) continue;
    const list = byProspect.get(c.prospectId) ?? [];
    list.push(c.date);
    byProspect.set(c.prospectId, list);
  }
  const out: Record<string, string> = {};
  for (const a of candidates) {
    const created = a.createdAt.getTime();
    const hit = (byProspect.get(a.prospectId as string) ?? []).find((d) => {
      const t = d.getTime();
      return t >= created - 2 * 86_400_000 && t <= created + 2 * 3_600_000;
    });
    if (hit) out[a.id] = zDayKey(hit);
  }
  return out;
}
