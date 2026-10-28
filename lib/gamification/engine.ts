/**
 * Résultats commerciaux - requêtes serveur (compteurs, série, objectifs du
 * jour, records, classements).
 *
 * SERVEUR UNIQUEMENT (server-only) : ce module interroge la base via prisma.
 * Pas de `import "server-only"` : Next le gère en interne, mais le paquet
 * n'est pas installé, donc les scripts de vérification lancés avec
 * `npx tsx` (hors Next) ne le résoudraient pas. Côté client, importer
 * uniquement `@/lib/gamification/rules`, jamais `@/lib/gamification`.
 *
 * Principes :
 *  - Aucune table dédiée : tout est recalculé à partir des agrégats existants
 *    (activités, contrats), avec les MÊMES définitions que
 *    `lib/queries/pilotage.ts` (compteurs) et `lib/queries/dashboard.ts`
 *    (CA signé = valeur totale des contrats réellement signés).
 *  - Les dates sont stockées en UTC (timestamp sans fuseau) : les jours sont
 *    découpés en fuseau Europe/Zurich, côté SQL (`AT TIME ZONE`) comme côté JS.
 *  - Une seule requête d'agrégat « par jour » sur tout l'historique d'un
 *    utilisateur, partagée (via `cache()` de React) entre `getPlayerHeader`
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
 *                    (createdAt), quel que soit leur sort ensuite, hors
 *                    contrats importés a posteriori
 *  - signatures    : contrats réellement signés (hors ATTENTE_SIGNATURE_CLIENT
 *                    et ATTENTE_VALIDATION_ADMIN), datés par dateSignature
 *  - caSigne (CHF) : somme sur ces contrats de montantOneShot +
 *                    montantMensuel × dureeMois (valeur totale, comme le
 *                    dashboard et le héros pipeline)
 *  - emails        : Activity EMAIL_ENVOYE au statut FAIT
 */
import { cache } from "react";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { addDays, isoWeekKey, isWorkingDay } from "@/lib/planning/dates";

import {
  BADGE_DEFS,
  BADGE_THRESHOLDS,
  DEFAULT_DAILY_TARGETS,
  dailyGoalsFor,
  emptyCounters,
  emptyMonthResults,
  firstNameOf,
  initialsOf,
  levelFor,
  missionsFor,
  xpForDay,
  type BadgeState,
  type DailyTargets,
  type DayCounters,
  type LeaderboardEntry,
  type MonthResults,
  type MonthTargets,
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

/** Bornes utiles autour de « maintenant » (Zurich). */
function nowWindow(now: Date) {
  const todayKey = zurichDayKey(now);
  const todayDate = keyToUtcDate(todayKey);
  const monthKey = todayKey.slice(0, 7);
  const mondayDate = addDays(todayDate, -((todayDate.getUTCDay() || 7) - 1));
  return {
    todayKey,
    todayDate,
    monthKey,
    weekStart: zurichStartOfDay(utcDateToKey(mondayDate)),
    monthStart: zurichStartOfDay(`${monthKey}-01`),
    tomorrowStart: zurichStartOfDay(utcDateToKey(addDays(todayDate, 1))),
  };
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
  ca: number;
}

interface DayData {
  c: DayCounters;
  /** Somme des montants mensuels des contrats signés ce jour-là (CHF). */
  mensuel: number;
  /** Plus gros montant mensuel signé ce jour-là (CHF). */
  mensuelMax: number;
  /** CA signé ce jour-là (CHF, valeur totale). */
  ca: number;
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
      COALESCE(MAX(t.mensuel_max), 0)::float8 AS mensuel_max,
      COALESCE(SUM(t.ca), 0)::float8 AS ca
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
        0::numeric AS mensuel_max,
        0::numeric AS ca
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
        0, 0, 0, 0
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
        MAX(c."montantMensuel") AS mensuel_max,
        SUM(c."montantOneShot" + c."montantMensuel" * c."dureeMois") AS ca
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
    ca: Number(r.ca) || 0,
  };
}

/** Cumule un jour dans des résultats mensuels (mutation). */
function addDayToMonth(m: MonthResults, day: DayData): void {
  m.caSigne += day.ca;
  m.contratsSignes += day.c.signatures;
  m.rdvPris += day.c.rdvPris;
  m.rdvEffectues += day.c.rdvEffectues;
  m.appels += day.c.appels;
  m.propositions += day.c.propositions;
}

// ---------------------------------------------------------------------------
// OBJECTIFS QUOTIDIENS / MENSUELS
// ---------------------------------------------------------------------------

interface DailyObjective {
  userId: string;
  startKey: string;
  endKey: string;
  appels: number | null;
  rdvPris: number | null;
  signatures: number | null;
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
      nbSignaturesObjectif: true,
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
    signatures: o.nbSignaturesObjectif,
    propositions: o.nbPropositionsObjectif,
  }));
}

const positive = (v: number | null | undefined, fallback: number): number =>
  v != null && v > 0 ? v : fallback;

/** Arrondi au centime (évite les 5074.799999 des sommes flottantes). */
const round2 = (n: number): number => Math.round(n * 100) / 100;

const positiveOrNull = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && v > 0 ? v : null;

/** Objectifs du jour `key` (Objective QUOTIDIEN actif couvrant ce jour, sinon défauts). */
function targetsFor(objectives: DailyObjective[], key: string): DailyTargets {
  const o = objectives.find((x) => x.startKey <= key && x.endKey >= key);
  return {
    appels: positive(o?.appels, DEFAULT_DAILY_TARGETS.appels),
    rdvPris: positive(o?.rdvPris, DEFAULT_DAILY_TARGETS.rdvPris),
    // Pas de champ « RDV effectués » en base : objectif par défaut (3/jour).
    rdvEffectues: DEFAULT_DAILY_TARGETS.rdvEffectues,
    signatures: positive(o?.signatures, DEFAULT_DAILY_TARGETS.signatures),
    propositions: positive(o?.propositions, DEFAULT_DAILY_TARGETS.propositions),
  };
}

/**
 * Objectif MENSUEL actif le plus récent couvrant le mois en cours (même
 * requête que `computeMonthlyProgressPartial` du dashboard).
 */
async function loadMonthTargets(userId: string, now: Date): Promise<MonthTargets> {
  const { monthKey, monthStart } = nowWindow(now);
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const nextMonthKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthEnd = new Date(zurichStartOfDay(`${nextMonthKey}-01`).getTime() - 1);
  const o = await prisma.objective.findFirst({
    where: {
      userId,
      periode: "MENSUEL",
      isActif: true,
      dateDebut: { lte: monthEnd },
      dateFin: { gte: monthStart },
    },
    orderBy: { createdAt: "desc" },
    select: {
      caObjectif: true,
      nbSignaturesObjectif: true,
      nbRdvObjectif: true,
      nbAppelsObjectif: true,
    },
  });
  return {
    caSigne: positiveOrNull(o?.caObjectif != null ? Number(o.caObjectif) : null),
    contratsSignes: positiveOrNull(o?.nbSignaturesObjectif),
    rdv: positiveOrNull(o?.nbRdvObjectif),
    appels: positiveOrNull(o?.nbAppelsObjectif),
  };
}

// ---------------------------------------------------------------------------
// NOYAU (requêtes + calculs dérivés, mis en cache par requête)
// ---------------------------------------------------------------------------

interface PlayerCore {
  userId: string;
  name: string;
  todayKey: string;
  today: DayCounters;
  todayTargets: DailyTargets;
  month: MonthResults;
  streak: number;
  longestStreak: number;
  bestDayRdvPris: number;
  bestDayRdvPrisDate: string | null;
  bestMonthCaSigne: number;
  bestMonthCaSigneKey: string | null;
  biggestContractMensuel: number;
  // --- déprécié (XP / badges) ---
  xpTotal: number;
  xpToday: number;
  xpWeek: number;
  bestDayXp: number;
  bestDayDate: string | null;
  bestWeekXp: number;
  maxAppelsWeek: number;
  longestGrandChelem: number;
  signaturesTotal: number;
}

const loadPlayerCore = cache(async (userId: string): Promise<PlayerCore> => {
  const now = new Date();
  const { todayKey, todayDate, monthKey, tomorrowStart } = nowWindow(now);

  const [user, objectives, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    loadDailyObjectives(userId),
    prisma.$queryRaw<DayAggRow[]>(dayAggregateSql({ userId }, null, tomorrowStart, now)),
  ]);

  // Lignes triées par jour croissant (ORDER BY t.d) : la Map garde cet ordre.
  const days = new Map<string, DayData>();
  for (const r of rows) days.set(r.d, rowToDayData(r));

  const dayTargets = (key: string) => targetsFor(objectives, key);
  const callGoalMet = (key: string) =>
    (days.get(key)?.c.appels ?? 0) >= dayTargets(key).appels;
  const allGoalsDone = (key: string) => {
    const day = days.get(key);
    return day ? dailyGoalsFor(day.c, dayTargets(key)).every((m) => m.done) : false;
  };

  // Mois en cours, records en résultats (+ XP déprécié).
  const month = emptyMonthResults(monthKey);
  const caByMonth = new Map<string, number>();
  let bestDayRdvPris = 0;
  let bestDayRdvPrisDate: string | null = null;
  let biggestContractMensuel = 0;
  let signaturesTotal = 0;

  const todayWeek = isoWeekKey(todayDate);
  const weekXp = new Map<string, number>();
  const weekAppels = new Map<string, number>();
  let xpTotal = 0;
  let xpToday = 0;
  let bestDayXp = 0;
  let bestDayDate: string | null = null;

  for (const [key, day] of days) {
    const mk = key.slice(0, 7);
    if (mk === monthKey) addDayToMonth(month, day);
    if (day.ca > 0) caByMonth.set(mk, (caByMonth.get(mk) ?? 0) + day.ca);
    if (day.c.rdvPris > bestDayRdvPris) {
      bestDayRdvPris = day.c.rdvPris;
      bestDayRdvPrisDate = key;
    }
    biggestContractMensuel = Math.max(biggestContractMensuel, day.mensuelMax);
    signaturesTotal += day.c.signatures;

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
  }

  month.caSigne = round2(month.caSigne);
  let bestMonthCaSigne = 0;
  let bestMonthCaSigneKey: string | null = null;
  for (const [mk, raw] of caByMonth) {
    const ca = round2(raw);
    if (ca > bestMonthCaSigne) {
      bestMonthCaSigne = ca;
      bestMonthCaSigneKey = mk;
    }
  }

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
      if (allGoalsDone(key)) {
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
    month,
    streak,
    longestStreak,
    bestDayRdvPris,
    bestDayRdvPrisDate,
    bestMonthCaSigne,
    bestMonthCaSigneKey,
    biggestContractMensuel,
    xpTotal,
    xpToday,
    xpWeek: weekXp.get(todayWeek) ?? 0,
    bestDayXp,
    bestDayDate,
    bestWeekXp: Math.max(0, ...weekXp.values()),
    maxAppelsWeek: Math.max(0, ...weekAppels.values()),
    longestGrandChelem,
    signaturesTotal,
  };
});

function headerFromCore(core: PlayerCore): PlayerHeader {
  return {
    userId: core.userId,
    name: core.name,
    firstName: firstNameOf(core.name),
    initials: initialsOf(core.name),
    today: core.today,
    dailyTargets: core.todayTargets,
    month: core.month,
    streak: core.streak,
    dailyCallTarget: core.todayTargets.appels,
    level: levelFor(core.xpTotal),
    xpToday: core.xpToday,
  };
}

// ---------------------------------------------------------------------------
// API PUBLIQUE
// ---------------------------------------------------------------------------

/**
 * En-tête léger (carte résultats de la sidebar, pilules de la topbar) :
 * compteurs du jour, objectifs du jour, résultats du mois, série.
 * 3 requêtes en parallèle (utilisateur, objectifs quotidiens, agrégat par
 * jour), dédupliquées par requête avec getPlayerStats.
 */
export const getPlayerHeader = cache(async (userId: string): Promise<PlayerHeader> => {
  return headerFromCore(await loadPlayerCore(userId));
});

/** Statistiques complètes (dashboard, Ma journée, objectifs, commissions...). */
export const getPlayerStats = cache(async (userId: string): Promise<PlayerStats> => {
  const now = new Date();
  const [core, monthTargets, unreadInbox, closer] = await Promise.all([
    loadPlayerCore(userId),
    loadMonthTargets(userId, now),
    // Déprécié (badge « Inbox zéro ») : non lus de la boîte de réception.
    prisma.email.count({
      where: { userId, direction: "ENTRANT", lu: false, archive: false, supprime: false },
    }),
    // Déprécié (badge « Closer du mois »).
    isCloserOfTheMonth(userId),
  ]);

  const header = headerFromCore(core);

  const earned: Record<BadgeState["key"], boolean> = {
    "premier-sang": core.signaturesTotal >= 1,
    sniper: core.bestDayRdvPris >= BADGE_THRESHOLDS.sniperRdvJour,
    marathon: core.maxAppelsWeek >= BADGE_THRESHOLDS.marathonAppelsSemaine,
    "serie-de-feu": core.longestStreak >= BADGE_THRESHOLDS.serieDeFeuJours,
    "closer-du-mois": closer,
    "inbox-zero": unreadInbox === 0,
    legende: header.level.level === 5,
    "grand-chelem": core.longestGrandChelem >= BADGE_THRESHOLDS.grandChelemJours,
  };

  return {
    ...header,
    dailyGoals: dailyGoalsFor(core.today, core.todayTargets),
    monthTargets,
    records: {
      bestDayRdvPris: core.bestDayRdvPris,
      bestDayRdvPrisDate: core.bestDayRdvPrisDate,
      bestMonthCaSigne: core.bestMonthCaSigne,
      bestMonthCaSigneKey: core.bestMonthCaSigneKey,
      biggestContractMensuel: core.biggestContractMensuel,
      longestStreak: core.longestStreak,
      bestDayXp: core.bestDayXp,
      bestDayDate: core.bestDayDate,
      bestWeekXp: core.bestWeekXp,
    },
    streakRecord: core.longestStreak,
    missions: missionsFor(core.today, core.todayTargets),
    badges: BADGE_DEFS.map((b) => ({ ...b, earned: earned[b.key] })),
    xpTotal: core.xpTotal,
    xpRecordDay: core.bestDayXp,
    xpWeek: core.xpWeek,
    xpRecordWeek: core.bestWeekXp,
  };
});

/**
 * Classement des utilisateurs actifs sur [from, demain 00:00 Zurich[ :
 * CA signé décroissant, puis RDV pris, puis appels, puis nom.
 * Ex aequo (même rang) si même CA signé ET mêmes RDV pris.
 */
async function buildLeaderboard(meId: string, from: Date, now: Date): Promise<LeaderboardEntry[]> {
  const { tomorrowStart } = nowWindow(now);
  const [users, objectives, rows] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    loadDailyObjectives(null),
    prisma.$queryRaw<DayAggRow[]>(
      dayAggregateSql({ activeUsers: true }, from, tomorrowStart, now),
    ),
  ]);

  const objByUser = new Map<string, DailyObjective[]>();
  for (const o of objectives) {
    const list = objByUser.get(o.userId) ?? [];
    list.push(o);
    objByUser.set(o.userId, list);
  }

  const acc = new Map<
    string,
    { caSigne: number; contratsSignes: number; rdvPris: number; appels: number; xp: number }
  >();
  for (const r of rows) {
    const day = rowToDayData(r);
    const cur = acc.get(r.uid) ?? { caSigne: 0, contratsSignes: 0, rdvPris: 0, appels: 0, xp: 0 };
    cur.caSigne = round2(cur.caSigne + day.ca);
    cur.contratsSignes += day.c.signatures;
    cur.rdvPris += day.c.rdvPris;
    cur.appels += day.c.appels;
    cur.xp += xpForDay(day.c, day.mensuel, targetsFor(objByUser.get(r.uid) ?? [], r.d));
    acc.set(r.uid, cur);
  }

  const sorted = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      ...(acc.get(u.id) ?? { caSigne: 0, contratsSignes: 0, rdvPris: 0, appels: 0, xp: 0 }),
    }))
    .sort(
      (a, b) =>
        b.caSigne - a.caSigne ||
        b.rdvPris - a.rdvPris ||
        b.appels - a.appels ||
        a.name.localeCompare(b.name, "fr"),
    );

  let prev: { caSigne: number; rdvPris: number } | null = null;
  let prevRank = 0;
  return sorted.map((e, i) => {
    const rank =
      prev !== null && e.caSigne === prev.caSigne && e.rdvPris === prev.rdvPris ? prevRank : i + 1;
    prev = { caSigne: e.caSigne, rdvPris: e.rdvPris };
    prevRank = rank;
    return {
      userId: e.userId,
      name: e.name,
      initials: initialsOf(e.name),
      caSigne: round2(e.caSigne),
      contratsSignes: e.contratsSignes,
      rdvPris: e.rdvPris,
      appels: e.appels,
      rank,
      isMe: e.userId === meId,
      xp: e.xp,
    };
  });
}

/** Classement de la semaine ISO en cours (lundi → aujourd'hui, Zurich). */
export const getWeeklyLeaderboard = cache(
  async (meId: string): Promise<LeaderboardEntry[]> => {
    const now = new Date();
    return buildLeaderboard(meId, nowWindow(now).weekStart, now);
  },
);

/** Classement du mois en cours (1er du mois → aujourd'hui, Zurich). */
export const getMonthlyLeaderboard = cache(
  async (meId: string): Promise<LeaderboardEntry[]> => {
    const now = new Date();
    return buildLeaderboard(meId, nowWindow(now).monthStart, now);
  },
);

/**
 * Compteurs d'un utilisateur sur une fenêtre [start, end] (bornes incluses,
 * comme stats.ts). Réutilisable par les rubriques (une seule requête).
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
// DÉPRÉCIÉ : BADGE « CLOSER DU MOIS » (gardé tant que `badges` existe)
// ---------------------------------------------------------------------------

/**
 * Vrai si l'utilisateur a le meilleur CA signé (somme valeurAn1, comme
 * stats.ts) parmi les utilisateurs actifs, sur le mois précédent OU le mois
 * en cours.
 */
async function isCloserOfTheMonth(userId: string): Promise<boolean> {
  const now = new Date();
  const { todayKey, tomorrowStart } = nowWindow(now);
  const [y, m] = todayKey.split("-").map(Number) as [number, number];
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevMonthStart = zurichStartOfDay(`${prevY}-${String(prevM).padStart(2, "0")}-01`);

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
