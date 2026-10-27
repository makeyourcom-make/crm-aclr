/**
 * MYC Arena - moteur de jeu (requêtes serveur).
 *
 * SERVEUR UNIQUEMENT (server-only) : ce module interroge la base via prisma.
 * Pas de `import "server-only"` : Next le gère en interne, mais le paquet
 * n'est pas installé, donc les scripts de vérification lancés avec
 * `npx tsx` (hors Next) ne le résoudraient pas. Côté client, importer
 * uniquement `@/lib/gamification/rules`, jamais `@/lib/gamification`.
 *
 * Principes :
 *  - Aucune table d'XP : tout est recalculé à partir des agrégats existants
 *    (activités, contrats), avec les MÊMES définitions que
 *    `lib/queries/stats.ts` / `lib/queries/today.ts`.
 *  - Les dates sont stockées en UTC (timestamp sans fuseau) : les jours sont
 *    découpés en fuseau Europe/Zurich, côté SQL (`AT TIME ZONE`) comme côté JS.
 *  - Une seule requête d'agrégat « par jour » sur tout l'historique d'un
 *    joueur, partagée (via `cache()` de React) entre `getPlayerHeader`
 *    (layout, à chaque navigation) et `getPlayerStats` (dashboard).
 *
 * Définitions des compteurs :
 *  - appels        : Activity APPEL_SORTANT, statut FAIT ou EN_COURS
 *  - conversations : ces appels avec un résultat non nul, hors COMBOX /
 *                    NE_DECROCHE_PAS / INVALIDE
 *  - rdvPris       : activités au résultat RDV_PRIS
 *  - rdvEffectues  : activités RDV_PHYSIQUE / RDV_VISIO / RDV_TELEPHONIQUE,
 *                    rattachées à un prospect, FAIT, datées au plus tard
 *                    maintenant
 *  - propositions  : contrats (devis) créés par la commerciale assignée
 *                    (createdAt), quel que soit leur sort ensuite (stats.ts)
 *  - signatures    : contrats réellement signés (hors ATTENTE_SIGNATURE_CLIENT
 *                    et ATTENTE_VALIDATION_ADMIN), datés par dateSignature
 *  - emails        : Activity EMAIL_ENVOYE au statut FAIT (créée à chaque
 *                    envoi depuis le CRM : mail prospect, contrat, facture)
 */
import { cache } from "react";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { addDays, isoWeekKey, isWorkingDay } from "@/lib/planning/dates";

import {
  BADGE_DEFS,
  BADGE_THRESHOLDS,
  DEFAULT_DAILY_TARGETS,
  emptyCounters,
  firstNameOf,
  initialsOf,
  levelFor,
  missionsFor,
  xpForDay,
  type BadgeState,
  type DailyTargets,
  type DayCounters,
  type LeaderboardEntry,
  type PlayerHeader,
  type PlayerStats,
} from "./rules";

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

/** Clé « AAAA-MM-JJ » du jour (vu de Suisse) contenant l'instant `d`. */
function zurichDayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

/** Décalage (ms) entre l'heure de Zurich et UTC à l'instant `at`. */
function zurichOffsetMs(at: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant UTC de minuit (heure de Zurich) du jour `key`. */
function zurichStartOfDay(key: string): Date {
  const guess = keyToUtcDate(key).getTime();
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

/** Clé de jour → minuit UTC (convention de `lib/planning/dates.ts`). */
function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Paramètre SQL : instant JS → timestamp UTC sans fuseau (format des colonnes). */
function ts(d: Date): Prisma.Sql {
  return Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/** Expression SQL : jour Europe/Zurich (texte AAAA-MM-JJ) d'une colonne UTC. */
function zDay(column: string): Prisma.Sql {
  return Prisma.raw(
    `to_char((${column} AT TIME ZONE 'UTC' AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD')`,
  );
}

// ---------------------------------------------------------------------------
// AGRÉGAT PAR JOUR (une requête, UNION ALL activités + contrats)
// ---------------------------------------------------------------------------

interface DayAggRow {
  uid: string;
  d: string;
  appels: number;
  conversations: number;
  rdv_pris: number;
  rdv_effectues: number;
  emails: number;
  propositions: number;
  signatures: number;
  mensuel: number;
  mensuel_max: number;
}

interface DayData {
  c: DayCounters;
  /** Somme des montants mensuels des contrats signés ce jour-là (CHF). */
  mensuel: number;
  /** Plus gros montant mensuel signé ce jour-là (CHF). */
  mensuelMax: number;
}

type Scope = { userId: string } | { activeUsers: true };

/**
 * Compteurs par (utilisateur, jour Zurich) sur [from, to[.
 * `from` null = tout l'historique. `now` plafonne les RDV effectués.
 */
function dayAggregateSql(scope: Scope, from: Date | null, to: Date, now: Date): Prisma.Sql {
  const actUser =
    "userId" in scope
      ? Prisma.sql`a."userId" = ${scope.userId}`
      : Prisma.sql`a."userId" IN (SELECT u.id FROM users u WHERE u."isActive")`;
  const ctUser =
    "userId" in scope
      ? Prisma.sql`c."assigneAId" = ${scope.userId}`
      : Prisma.sql`c."assigneAId" IN (SELECT u.id FROM users u WHERE u."isActive")`;
  const actFrom = from ? Prisma.sql`AND a."date" >= ${ts(from)}` : Prisma.empty;
  const createdFrom = from ? Prisma.sql`AND c."createdAt" >= ${ts(from)}` : Prisma.empty;
  const signedFrom = from ? Prisma.sql`AND c."dateSignature" >= ${ts(from)}` : Prisma.empty;

  return Prisma.sql`
    SELECT t.uid, t.d,
      SUM(t.appels)::int AS appels,
      SUM(t.conversations)::int AS conversations,
      SUM(t.rdv_pris)::int AS rdv_pris,
      SUM(t.rdv_effectues)::int AS rdv_effectues,
      SUM(t.emails)::int AS emails,
      SUM(t.propositions)::int AS propositions,
      SUM(t.signatures)::int AS signatures,
      COALESCE(SUM(t.mensuel), 0)::float8 AS mensuel,
      COALESCE(MAX(t.mensuel_max), 0)::float8 AS mensuel_max
    FROM (
      SELECT a."userId" AS uid, ${zDay('a."date"')} AS d,
        COUNT(*) FILTER (
          WHERE a."type" = 'APPEL_SORTANT' AND a."statut" IN ('FAIT', 'EN_COURS')
        ) AS appels,
        COUNT(*) FILTER (
          WHERE a."type" = 'APPEL_SORTANT' AND a."statut" IN ('FAIT', 'EN_COURS')
            AND a."resultat" IS NOT NULL
            AND a."resultat" NOT IN ('COMBOX', 'NE_DECROCHE_PAS', 'INVALIDE')
        ) AS conversations,
        COUNT(*) FILTER (WHERE a."resultat" = 'RDV_PRIS') AS rdv_pris,
        COUNT(*) FILTER (
          WHERE a."type" IN ('RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE')
            AND a."prospectId" IS NOT NULL
            AND a."statut" = 'FAIT'
            AND a."date" <= ${ts(now)}
        ) AS rdv_effectues,
        COUNT(*) FILTER (
          WHERE a."type" = 'EMAIL_ENVOYE' AND a."statut" = 'FAIT'
        ) AS emails,
        0::bigint AS propositions,
        0::bigint AS signatures,
        0::numeric AS mensuel,
        0::numeric AS mensuel_max
      FROM activities a
      WHERE ${actUser}
        ${actFrom}
        AND a."date" < ${ts(to)}
        -- Uniquement les lignes qui comptent (évite les jours « vides », ex.
        -- événements d'agenda synchronisés) : allège le résultat renvoyé.
        AND (
          (a."type" = 'APPEL_SORTANT' AND a."statut" IN ('FAIT', 'EN_COURS'))
          OR a."resultat" = 'RDV_PRIS'
          OR (
            a."type" IN ('RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE')
            AND a."prospectId" IS NOT NULL
            AND a."statut" = 'FAIT'
          )
          OR (a."type" = 'EMAIL_ENVOYE' AND a."statut" = 'FAIT')
        )
      GROUP BY 1, 2

      UNION ALL

      SELECT c."assigneAId" AS uid, ${zDay('c."createdAt"')} AS d,
        0, 0, 0, 0, 0,
        COUNT(*) AS propositions,
        0, 0, 0
      FROM contracts c
      WHERE ${ctUser}
        ${createdFrom}
        AND c."createdAt" < ${ts(to)}
        -- Contrats importés a posteriori (signés bien avant leur saisie, ex.
        -- import du 29.05.2026) : ce ne sont pas des propositions du jour.
        AND NOT (c."dateSignature" IS NOT NULL AND c."dateSignature" < c."createdAt" - INTERVAL '7 days')
      GROUP BY 1, 2

      UNION ALL

      SELECT c."assigneAId" AS uid, ${zDay('c."dateSignature"')} AS d,
        0, 0, 0, 0, 0, 0,
        COUNT(*) AS signatures,
        SUM(c."montantMensuel") AS mensuel,
        MAX(c."montantMensuel") AS mensuel_max
      FROM contracts c
      WHERE ${ctUser}
        AND c."statut" NOT IN ('ATTENTE_SIGNATURE_CLIENT', 'ATTENTE_VALIDATION_ADMIN')
        ${signedFrom}
        AND c."dateSignature" < ${ts(to)}
      GROUP BY 1, 2
    ) t
    GROUP BY t.uid, t.d
    ORDER BY t.d
  `;
}

function rowToDayData(r: DayAggRow): DayData {
  return {
    c: {
      appels: r.appels,
      conversations: r.conversations,
      rdvPris: r.rdv_pris,
      rdvEffectues: r.rdv_effectues,
      propositions: r.propositions,
      signatures: r.signatures,
      emails: r.emails,
    },
    mensuel: Number(r.mensuel) || 0,
    mensuelMax: Number(r.mensuel_max) || 0,
  };
}

// ---------------------------------------------------------------------------
// OBJECTIFS QUOTIDIENS
// ---------------------------------------------------------------------------

interface DailyObjective {
  userId: string;
  startKey: string;
  endKey: string;
  appels: number | null;
  rdvPris: number | null;
  propositions: number | null;
}

async function loadDailyObjectives(userId: string | null): Promise<DailyObjective[]> {
  const rows = await prisma.objective.findMany({
    where: {
      periode: "QUOTIDIEN",
      isActif: true,
      ...(userId ? { userId } : { user: { isActive: true } }),
    },
    select: {
      userId: true,
      dateDebut: true,
      dateFin: true,
      nbAppelsObjectif: true,
      nbRdvObjectif: true,
      nbPropositionsObjectif: true,
    },
    // Le plus récent d'abord (même règle que getTeamActivityOverview).
    orderBy: { dateFin: "desc" },
  });
  return rows.map((o) => ({
    userId: o.userId,
    startKey: zurichDayKey(o.dateDebut),
    endKey: zurichDayKey(o.dateFin),
    appels: o.nbAppelsObjectif,
    rdvPris: o.nbRdvObjectif,
    propositions: o.nbPropositionsObjectif,
  }));
}

const positive = (v: number | null | undefined, fallback: number): number =>
  v != null && v > 0 ? v : fallback;

/** Objectifs du jour `key` (Objective QUOTIDIEN actif couvrant ce jour, sinon défauts). */
function targetsFor(objectives: DailyObjective[], key: string): DailyTargets {
  const o = objectives.find((x) => x.startKey <= key && x.endKey >= key);
  return {
    appels: positive(o?.appels, DEFAULT_DAILY_TARGETS.appels),
    rdvPris: positive(o?.rdvPris, DEFAULT_DAILY_TARGETS.rdvPris),
    propositions: positive(o?.propositions, DEFAULT_DAILY_TARGETS.propositions),
  };
}

// ---------------------------------------------------------------------------
// NOYAU JOUEUR (requêtes + calculs dérivés, mis en cache par requête)
// ---------------------------------------------------------------------------

interface PlayerCore {
  userId: string;
  name: string;
  todayKey: string;
  today: DayCounters;
  todayTargets: DailyTargets;
  xpTotal: number;
  xpToday: number;
  xpWeek: number;
  streak: number;
  longestStreak: number;
  bestDayXp: number;
  bestDayDate: string | null;
  bestWeekXp: number;
  maxRdvPrisDay: number;
  maxAppelsWeek: number;
  longestGrandChelem: number;
  signaturesTotal: number;
  biggestContractMensuel: number;
}

const loadPlayerCore = cache(async (userId: string): Promise<PlayerCore> => {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const todayDate = keyToUtcDate(todayKey);
  const tomorrowStart = zurichStartOfDay(utcDateToKey(addDays(todayDate, 1)));

  const [user, objectives, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    loadDailyObjectives(userId),
    prisma.$queryRaw<DayAggRow[]>(
      dayAggregateSql({ userId }, null, tomorrowStart, now),
    ),
  ]);

  const days = new Map<string, DayData>();
  for (const r of rows) days.set(r.d, rowToDayData(r));

  const dayTargets = (key: string) => targetsFor(objectives, key);
  const callGoalMet = (key: string) =>
    (days.get(key)?.c.appels ?? 0) >= dayTargets(key).appels;
  const allMissionsDone = (key: string) => {
    const day = days.get(key);
    return day ? missionsFor(day.c, dayTargets(key)).every((m) => m.done) : false;
  };

  // XP par jour / semaine + records
  const todayWeek = isoWeekKey(todayDate);
  const weekXp = new Map<string, number>();
  const weekAppels = new Map<string, number>();
  let xpTotal = 0;
  let xpToday = 0;
  let bestDayXp = 0;
  let bestDayDate: string | null = null;
  let maxRdvPrisDay = 0;
  let signaturesTotal = 0;
  let biggestContractMensuel = 0;
  for (const [key, day] of days) {
    const xp = xpForDay(day.c, day.mensuel, dayTargets(key));
    xpTotal += xp;
    if (key === todayKey) xpToday = xp;
    if (xp > bestDayXp) {
      bestDayXp = xp;
      bestDayDate = key;
    }
    const wk = isoWeekKey(keyToUtcDate(key));
    weekXp.set(wk, (weekXp.get(wk) ?? 0) + xp);
    weekAppels.set(wk, (weekAppels.get(wk) ?? 0) + day.c.appels);
    maxRdvPrisDay = Math.max(maxRdvPrisDay, day.c.rdvPris);
    signaturesTotal += day.c.signatures;
    biggestContractMensuel = Math.max(biggestContractMensuel, day.mensuelMax);
  }
  const bestWeekXp = Math.max(0, ...weekXp.values());
  const maxAppelsWeek = Math.max(0, ...weekAppels.values());

  // Séries (jours ouvrés lun-ven hors fériés VS ; week-ends et fériés ignorés).
  // Plus longues séries : parcours chronologique de tout l'historique.
  let longestStreak = 0;
  let longestGrandChelem = 0;
  const firstKey = rows.length > 0 ? rows[0].d : null;
  if (firstKey && firstKey <= todayKey) {
    let run = 0;
    let runChelem = 0;
    for (
      let d = keyToUtcDate(firstKey);
      d.getTime() <= todayDate.getTime();
      d = addDays(d, 1)
    ) {
      if (!isWorkingDay(d)) continue;
      const key = utcDateToKey(d);
      const isToday = key === todayKey;
      if (callGoalMet(key)) {
        run += 1;
        longestStreak = Math.max(longestStreak, run);
      } else if (!isToday) {
        run = 0;
      }
      if (allMissionsDone(key)) {
        runChelem += 1;
        longestGrandChelem = Math.max(longestGrandChelem, runChelem);
      } else if (!isToday) {
        runChelem = 0;
      }
    }
  }

  // Série en cours : aujourd'hui compte s'il est atteint ; sinon on repart
  // d'hier (la série n'est pas cassée avant la fin de la journée).
  let streak = 0;
  if (firstKey) {
    const firstTime = keyToUtcDate(firstKey).getTime();
    if (isWorkingDay(todayDate) && callGoalMet(todayKey)) streak = 1;
    let cursor = addDays(todayDate, -1);
    while (cursor.getTime() >= firstTime) {
      if (isWorkingDay(cursor)) {
        if (!callGoalMet(utcDateToKey(cursor))) break;
        streak += 1;
      }
      cursor = addDays(cursor, -1);
    }
  }

  return {
    userId,
    name: user?.name ?? "",
    todayKey,
    today: days.get(todayKey)?.c ?? emptyCounters(),
    todayTargets: dayTargets(todayKey),
    xpTotal,
    xpToday,
    xpWeek: weekXp.get(todayWeek) ?? 0,
    streak,
    longestStreak,
    bestDayXp,
    bestDayDate,
    bestWeekXp,
    maxRdvPrisDay,
    maxAppelsWeek,
    longestGrandChelem,
    signaturesTotal,
    biggestContractMensuel,
  };
});

function headerFromCore(core: PlayerCore): PlayerHeader {
  return {
    userId: core.userId,
    name: core.name,
    firstName: firstNameOf(core.name),
    initials: initialsOf(core.name),
    level: levelFor(core.xpTotal),
    xpToday: core.xpToday,
    streak: core.streak,
    dailyCallTarget: core.todayTargets.appels,
  };
}

// ---------------------------------------------------------------------------
// API PUBLIQUE
// ---------------------------------------------------------------------------

/**
 * En-tête joueur (carte joueur de la sidebar, pilules de la topbar).
 * Léger : 3 requêtes en parallèle (utilisateur, objectifs quotidiens,
 * agrégat par jour), dédupliquées par requête avec getPlayerStats.
 */
export const getPlayerHeader = cache(async (userId: string): Promise<PlayerHeader> => {
  return headerFromCore(await loadPlayerCore(userId));
});

/** Statistiques complètes du joueur (dashboard, objectifs, kit). */
export const getPlayerStats = cache(async (userId: string): Promise<PlayerStats> => {
  const [core, unreadInbox, closer] = await Promise.all([
    loadPlayerCore(userId),
    // Non lus de la boîte de réception (même périmètre que /emails) : hors
    // archivés ET hors corbeille. Un mail supprimé sans avoir été ouvert reste
    // `lu: false` : sans `supprime: false`, il bloquerait « Inbox zéro » alors
    // qu'il n'est plus visible dans la boîte. (Le badge « non lus » historique
    // de la sidebar, lui, ne filtre pas encore la corbeille.)
    prisma.email.count({
      where: { userId, direction: "ENTRANT", lu: false, archive: false, supprime: false },
    }),
    isCloserOfTheMonth(userId),
  ]);

  const header = headerFromCore(core);
  const missions = missionsFor(core.today, core.todayTargets);

  const earned: Record<BadgeState["key"], boolean> = {
    "premier-sang": core.signaturesTotal >= 1,
    sniper: core.maxRdvPrisDay >= BADGE_THRESHOLDS.sniperRdvJour,
    marathon: core.maxAppelsWeek >= BADGE_THRESHOLDS.marathonAppelsSemaine,
    "serie-de-feu": core.longestStreak >= BADGE_THRESHOLDS.serieDeFeuJours,
    "closer-du-mois": closer,
    "inbox-zero": unreadInbox === 0,
    legende: header.level.level === 5,
    "grand-chelem": core.longestGrandChelem >= BADGE_THRESHOLDS.grandChelemJours,
  };
  const badges: BadgeState[] = BADGE_DEFS.map((b) => ({ ...b, earned: earned[b.key] }));

  return {
    ...header,
    xpTotal: core.xpTotal,
    xpRecordDay: core.bestDayXp,
    xpWeek: core.xpWeek,
    xpRecordWeek: core.bestWeekXp,
    streakRecord: core.longestStreak,
    today: core.today,
    missions,
    badges,
    records: {
      bestDayXp: core.bestDayXp,
      bestDayDate: core.bestDayDate,
      bestWeekXp: core.bestWeekXp,
      longestStreak: core.longestStreak,
      biggestContractMensuel: core.biggestContractMensuel,
    },
  };
});

/**
 * Classement XP de la semaine ISO en cours (lundi → aujourd'hui, Zurich)
 * parmi les utilisateurs actifs. Mêmes règles que getPlayerStats().xpWeek.
 */
export const getWeeklyLeaderboard = cache(
  async (meId: string): Promise<LeaderboardEntry[]> => {
    const now = new Date();
    const todayKey = zurichDayKey(now);
    const todayDate = keyToUtcDate(todayKey);
    const mondayDate = addDays(todayDate, -((todayDate.getUTCDay() || 7) - 1));
    const weekStart = zurichStartOfDay(utcDateToKey(mondayDate));
    const tomorrowStart = zurichStartOfDay(utcDateToKey(addDays(todayDate, 1)));

    const [users, objectives, rows] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      loadDailyObjectives(null),
      prisma.$queryRaw<DayAggRow[]>(
        dayAggregateSql({ activeUsers: true }, weekStart, tomorrowStart, now),
      ),
    ]);

    const objByUser = new Map<string, DailyObjective[]>();
    for (const o of objectives) {
      const list = objByUser.get(o.userId) ?? [];
      list.push(o);
      objByUser.set(o.userId, list);
    }
    const xpByUser = new Map<string, number>();
    for (const r of rows) {
      const day = rowToDayData(r);
      const xp = xpForDay(day.c, day.mensuel, targetsFor(objByUser.get(r.uid) ?? [], r.d));
      xpByUser.set(r.uid, (xpByUser.get(r.uid) ?? 0) + xp);
    }

    const sorted = users
      .map((u) => ({ userId: u.id, name: u.name, xp: xpByUser.get(u.id) ?? 0 }))
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, "fr"));

    let prevXp: number | null = null;
    let prevRank = 0;
    return sorted.map((e, i) => {
      const rank = prevXp !== null && e.xp === prevXp ? prevRank : i + 1;
      prevXp = e.xp;
      prevRank = rank;
      return {
        userId: e.userId,
        name: e.name,
        initials: initialsOf(e.name),
        xp: e.xp,
        rank,
        isMe: e.userId === meId,
      };
    });
  },
);

/**
 * Compteurs d'un joueur sur une fenêtre [start, end] (bornes incluses, comme
 * stats.ts). Réutilisable par les rubriques (une seule requête).
 *
 * `cache()` compare les arguments par identité : deux `new Date()` égales ne
 * dédupliqueraient jamais. On met donc en cache sur les timestamps (nombres).
 */
export function getDayCounters(userId: string, start: Date, end: Date): Promise<DayCounters> {
  return dayCountersCached(userId, start.getTime(), end.getTime());
}

const dayCountersCached = cache(
  async (userId: string, startMs: number, endMs: number): Promise<DayCounters> => {
    const start = new Date(startMs);
    const end = new Date(endMs);
    const nowCap = new Date(Math.min(endMs, Date.now()));
    const rows = await prisma.$queryRaw<
      Array<{
        appels: number;
        conversations: number;
        rdv_pris: number;
        rdv_effectues: number;
        emails: number;
        propositions: number;
        signatures: number;
      }>
    >`
      WITH a AS (
        SELECT
          COUNT(*) FILTER (
            WHERE a."type" = 'APPEL_SORTANT' AND a."statut" IN ('FAIT', 'EN_COURS')
          )::int AS appels,
          COUNT(*) FILTER (
            WHERE a."type" = 'APPEL_SORTANT' AND a."statut" IN ('FAIT', 'EN_COURS')
              AND a."resultat" IS NOT NULL
              AND a."resultat" NOT IN ('COMBOX', 'NE_DECROCHE_PAS', 'INVALIDE')
          )::int AS conversations,
          COUNT(*) FILTER (WHERE a."resultat" = 'RDV_PRIS')::int AS rdv_pris,
          COUNT(*) FILTER (
            WHERE a."type" IN ('RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE')
              AND a."prospectId" IS NOT NULL
              AND a."statut" = 'FAIT'
              AND a."date" <= ${ts(nowCap)}
          )::int AS rdv_effectues,
          COUNT(*) FILTER (
            WHERE a."type" = 'EMAIL_ENVOYE' AND a."statut" = 'FAIT'
          )::int AS emails
        FROM activities a
        WHERE a."userId" = ${userId}
          AND a."date" >= ${ts(start)}
          AND a."date" <= ${ts(end)}
      ),
      p AS (
        SELECT COUNT(*)::int AS n
        FROM contracts c
        WHERE c."assigneAId" = ${userId}
          AND c."createdAt" >= ${ts(start)}
          AND c."createdAt" <= ${ts(end)}
          -- Contrats importés a posteriori (signés bien avant leur saisie, ex.
          -- import du 29.05.2026) : ce ne sont pas des propositions du jour.
          AND NOT (c."dateSignature" IS NOT NULL AND c."dateSignature" < c."createdAt" - INTERVAL '7 days')
      ),
      s AS (
        SELECT COUNT(*)::int AS n
        FROM contracts c
        WHERE c."assigneAId" = ${userId}
          AND c."statut" NOT IN ('ATTENTE_SIGNATURE_CLIENT', 'ATTENTE_VALIDATION_ADMIN')
          AND c."dateSignature" >= ${ts(start)}
          AND c."dateSignature" <= ${ts(end)}
      )
      SELECT a.*, p.n AS propositions, s.n AS signatures FROM a, p, s
    `;
    const r = rows[0];
    if (!r) return emptyCounters();
    return {
      appels: r.appels,
      conversations: r.conversations,
      rdvPris: r.rdv_pris,
      rdvEffectues: r.rdv_effectues,
      propositions: r.propositions,
      signatures: r.signatures,
      emails: r.emails,
    };
  },
);

// ---------------------------------------------------------------------------
// BADGE « CLOSER DU MOIS »
// ---------------------------------------------------------------------------

/**
 * Vrai si le joueur a le meilleur CA signé (somme valeurAn1, comme stats.ts)
 * parmi les utilisateurs actifs, sur le mois précédent OU le mois en cours.
 */
async function isCloserOfTheMonth(userId: string): Promise<boolean> {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const [y, m] = todayKey.split("-").map(Number) as [number, number];
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevMonthStart = zurichStartOfDay(`${prevY}-${String(prevM).padStart(2, "0")}-01`);
  const tomorrowStart = zurichStartOfDay(utcDateToKey(addDays(keyToUtcDate(todayKey), 1)));

  const rows = await prisma.$queryRaw<Array<{ uid: string; m: string; ca: number }>>`
    SELECT c."assigneAId" AS uid,
      to_char((c."dateSignature" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Zurich'), 'YYYY-MM') AS m,
      SUM(c."valeurAn1")::float8 AS ca
    FROM contracts c
    WHERE c."assigneAId" IN (SELECT u.id FROM users u WHERE u."isActive")
      AND c."statut" NOT IN ('ATTENTE_SIGNATURE_CLIENT', 'ATTENTE_VALIDATION_ADMIN')
      AND c."dateSignature" >= ${ts(prevMonthStart)}
      AND c."dateSignature" < ${ts(tomorrowStart)}
    GROUP BY 1, 2
  `;

  const byMonth = new Map<string, Array<{ uid: string; ca: number }>>();
  for (const r of rows) {
    const list = byMonth.get(r.m) ?? [];
    list.push({ uid: r.uid, ca: Number(r.ca) || 0 });
    byMonth.set(r.m, list);
  }
  for (const list of byMonth.values()) {
    const best = Math.max(...list.map((x) => x.ca));
    if (best > 0 && list.some((x) => x.uid === userId && x.ca === best)) return true;
  }
  return false;
}
