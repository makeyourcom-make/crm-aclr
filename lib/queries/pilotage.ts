/**
 * Pilotage de direction (rubrique Statistiques, MYC Arena).
 *
 * SERVEUR UNIQUEMENT (prisma). Regroupe les requêtes du tableau de bord
 * d'Arthur en tête de /stats :
 *   - fenêtres de période (jours en fuseau Europe/Zurich, dates stockées UTC) ;
 *   - compteurs d'activité d'une période (mêmes définitions que le moteur de
 *     jeu `lib/gamification/engine.ts`, donc cohérents avec les XP) ;
 *   - contrats et CA signés du mois / de l'année vs objectifs (modèle
 *     Objective MENSUEL / ANNUEL) ;
 *   - MRR (contrats ACTIF) vs charges mensuelles récurrentes (Expense +
 *     ExpenseRecurrence) et marge récurrente ;
 *   - activité de l'équipe jour / semaine / mois par collaborateur, avec XP ;
 *   - historique 12 mois (MRR reconstitué, charges, CA signé).
 *
 * Règle produit : un objectif absent n'est JAMAIS inventé. Les champs
 * `objectif` valent `null` quand aucun Objective actif ne le définit.
 */
import { Prisma, type ActivityType, type ContractStatut } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  firstNameOf,
  initialsOf,
  missionsFor,
  xpForDay,
  DEFAULT_DAILY_TARGETS,
  type DailyTargets,
  type DayCounters,
} from "@/lib/gamification/rules";
import { addDays, isWorkingDay } from "@/lib/planning/dates";

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

const timeFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const monthLongFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const monthOnlyFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  month: "long",
});

const monthShortFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  month: "short",
});

const weekdayFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  weekday: "long",
});

/** Clé « AAAA-MM-JJ » du jour (vu de Suisse) contenant l'instant `d`. */
export function zurichDayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

function zurichOffsetMs(at: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Clé de jour → minuit UTC (convention de `lib/planning/dates.ts`). */
function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysKey(key: string, n: number): string {
  return utcDateToKey(addDays(keyToUtcDate(key), n));
}

/** Instant UTC de minuit (heure de Zurich) du jour `key`. */
export function zurichStartOfDay(key: string): Date {
  const guess = keyToUtcDate(key).getTime();
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

/** Dernière milliseconde (heure de Zurich) du jour `key`. */
function zurichEndOfDay(key: string): Date {
  return new Date(zurichStartOfDay(addDaysKey(key, 1)).getTime() - 1);
}

/** « 2026-10-27 » → « 27.10.2026 » ; `short` → « 27.10 ». */
function keyLabel(key: string, short = false): string {
  const [y, m, d] = key.split("-");
  return short ? `${d}.${m}` : `${d}.${m}.${y}`;
}

function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

function monthStartKey(monthKey: string): string {
  return `${monthKey}-01`;
}

function addMonthsKey(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function lastDayKeyOfMonth(monthKey: string): string {
  return addDaysKey(monthStartKey(addMonthsKey(monthKey, 1)), -1);
}

/** « octobre 2026 » */
export function monthLongLabel(monthKey: string): string {
  return monthLongFmt.format(keyToUtcDate(monthStartKey(monthKey)));
}

function monthOnlyLabel(monthKey: string): string {
  return monthOnlyFmt.format(keyToUtcDate(monthStartKey(monthKey)));
}

function monthShortLabel(monthKey: string): string {
  return monthShortFmt.format(keyToUtcDate(monthStartKey(monthKey)));
}

/** Nombre de jours ouvrés (lun-ven hors fériés VS) entre deux clés incluses. */
function workingDaysBetween(fromKey: string, toKey: string): number {
  let n = 0;
  for (let k = fromKey; k <= toKey; k = addDaysKey(k, 1)) {
    if (isWorkingDay(keyToUtcDate(k))) n += 1;
  }
  return n;
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

/** Expression SQL : mois Europe/Zurich (texte AAAA-MM) d'une colonne UTC. */
function zMonth(column: string): Prisma.Sql {
  return Prisma.raw(
    `to_char((${column} AT TIME ZONE 'UTC' AT TIME ZONE '${TZ}')::date, 'YYYY-MM')`,
  );
}

/** Contrats qui ne sont PAS (encore) signés : propositions en attente. */
const NON_SIGNES: ContractStatut[] = ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"];
const RDV_TYPES: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];

/** Libellé « mardi 27.10.2026, 15:40 » (maintenant, heure de Zurich). */
export function nowLabel(now = new Date()): string {
  const key = zurichDayKey(now);
  return `${weekdayFmt.format(keyToUtcDate(key))} ${keyLabel(key)}, ${timeFmt.format(now)}`;
}

// ---------------------------------------------------------------------------
// FENÊTRES DE PÉRIODE
// ---------------------------------------------------------------------------

export type StatsRangeKey = "mois" | "7" | "30" | "90" | "365";

export const STATS_RANGES: { value: StatsRangeKey; label: string }[] = [
  { value: "mois", label: "Ce mois" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "365", label: "1 an" },
];

export interface StatsWindow {
  key: StatsRangeKey;
  label: string;
  /** Début inclus (minuit Zurich). */
  start: Date;
  /** Fin incluse (dernière milliseconde du jour, Zurich). */
  end: Date;
  /** Période de comparaison de même durée, juste avant. */
  prevStart: Date;
  prevEnd: Date;
  /** Nombre de jours calendaires de la fenêtre. */
  days: number;
  /** Jours ouvrés de la fenêtre (lun-ven hors fériés VS). */
  workingDays: number;
  /** « 01.10 - 27.10.2026 » */
  detail: string;
  /** « vs 01.09 - 27.09 » */
  prevLabel: string;
}

/** Fenêtre de la période choisie (`?range=`). Défaut : « Ce mois ». */
export function resolveStatsWindow(raw: string | undefined): StatsWindow {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const value: StatsRangeKey = STATS_RANGES.some((r) => r.value === raw)
    ? (raw as StatsRangeKey)
    : "mois";
  const label = STATS_RANGES.find((r) => r.value === value)?.label ?? "Ce mois";

  let startKey: string;
  let prevStartKey: string;
  let prevEndKey: string;
  if (value === "mois") {
    startKey = monthStartKey(monthKeyOf(todayKey));
    const elapsed = Math.round(
      (keyToUtcDate(todayKey).getTime() - keyToUtcDate(startKey).getTime()) / 86_400_000,
    );
    const prevMonth = addMonthsKey(monthKeyOf(todayKey), -1);
    prevStartKey = monthStartKey(prevMonth);
    const prevLast = lastDayKeyOfMonth(prevMonth);
    const candidate = addDaysKey(prevStartKey, elapsed);
    prevEndKey = candidate < prevLast ? candidate : prevLast;
  } else {
    const n = Number(value);
    startKey = addDaysKey(todayKey, -(n - 1));
    prevEndKey = addDaysKey(startKey, -1);
    prevStartKey = addDaysKey(prevEndKey, -(n - 1));
  }

  const days =
    Math.round(
      (keyToUtcDate(todayKey).getTime() - keyToUtcDate(startKey).getTime()) / 86_400_000,
    ) + 1;

  return {
    key: value,
    label,
    start: zurichStartOfDay(startKey),
    end: zurichEndOfDay(todayKey),
    prevStart: zurichStartOfDay(prevStartKey),
    prevEnd: zurichEndOfDay(prevEndKey),
    days,
    workingDays: workingDaysBetween(startKey, todayKey),
    // Fenêtres longues : années explicites (sinon « 28.10 - 27.10 » est ambigu).
    detail: `${keyLabel(startKey, days <= 60)} - ${keyLabel(todayKey)}`,
    prevLabel: `vs ${keyLabel(prevStartKey, days <= 60)} - ${keyLabel(prevEndKey, days <= 60)}`,
  };
}

// ---------------------------------------------------------------------------
// COMPTEURS D'UNE PÉRIODE (équipe entière ou un collaborateur)
// ---------------------------------------------------------------------------

export interface PeriodCounters extends DayCounters {
  /** RDV clients au statut MANQUE. */
  rdvManques: number;
  /** Somme des valeurs an 1 des contrats signés (CHF). */
  caSigne: number;
}

const ZERO_COUNTERS: PeriodCounters = {
  appels: 0,
  conversations: 0,
  rdvPris: 0,
  rdvEffectues: 0,
  propositions: 0,
  signatures: 0,
  emails: 0,
  rdvManques: 0,
  caSigne: 0,
};

/**
 * Compteurs sur [start, end] (bornes incluses). `userId` null = toute
 * l'équipe (tous les utilisateurs, comme la vue « Toute l'équipe » de /stats).
 * Définitions identiques au moteur de jeu (appels FAIT/EN_COURS, conversations
 * hors COMBOX / NE_DECROCHE_PAS / INVALIDE, RDV pris = résultat RDV_PRIS,
 * RDV effectués = RDV clients FAIT déjà passés, propositions = contrats créés
 * hors imports a posteriori, signatures = contrats réellement signés).
 */
export async function getPeriodCounters(
  userId: string | null,
  start: Date,
  end: Date,
): Promise<PeriodCounters> {
  const nowCap = new Date(Math.min(end.getTime(), Date.now()));
  const actUser = userId ? Prisma.sql`AND a."userId" = ${userId}` : Prisma.empty;
  const ctUser = userId ? Prisma.sql`AND c."assigneAId" = ${userId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      appels: number;
      conversations: number;
      rdv_pris: number;
      rdv_effectues: number;
      rdv_manques: number;
      emails: number;
      propositions: number;
      signatures: number;
      ca: number;
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
          WHERE a."type" IN ('RDV_PHYSIQUE', 'RDV_VISIO', 'RDV_TELEPHONIQUE')
            AND a."prospectId" IS NOT NULL
            AND a."statut" = 'MANQUE'
        )::int AS rdv_manques,
        COUNT(*) FILTER (
          WHERE a."type" = 'EMAIL_ENVOYE' AND a."statut" = 'FAIT'
        )::int AS emails
      FROM activities a
      WHERE a."date" >= ${ts(start)}
        AND a."date" <= ${ts(end)}
        ${actUser}
    ),
    p AS (
      SELECT COUNT(*)::int AS n
      FROM contracts c
      WHERE c."createdAt" >= ${ts(start)}
        AND c."createdAt" <= ${ts(end)}
        AND NOT (c."dateSignature" IS NOT NULL AND c."dateSignature" < c."createdAt" - INTERVAL '7 days')
        ${ctUser}
    ),
    s AS (
      SELECT COUNT(*)::int AS n, COALESCE(SUM(c."valeurAn1"), 0)::float8 AS ca
      FROM contracts c
      WHERE c."statut" NOT IN ('ATTENTE_SIGNATURE_CLIENT', 'ATTENTE_VALIDATION_ADMIN')
        AND c."dateSignature" >= ${ts(start)}
        AND c."dateSignature" <= ${ts(end)}
        ${ctUser}
    )
    SELECT a.*, p.n AS propositions, s.n AS signatures, s.ca AS ca FROM a, p, s
  `;
  const r = rows[0];
  if (!r) return { ...ZERO_COUNTERS };
  return {
    appels: r.appels,
    conversations: r.conversations,
    rdvPris: r.rdv_pris,
    rdvEffectues: r.rdv_effectues,
    rdvManques: r.rdv_manques,
    emails: r.emails,
    propositions: r.propositions,
    signatures: r.signatures,
    caSigne: Number(r.ca) || 0,
  };
}

// ---------------------------------------------------------------------------
// OBJECTIFS (somme des objectifs individuels actifs)
// ---------------------------------------------------------------------------

export interface ObjectiveSum {
  /** Somme des caObjectif définis (null si aucun). */
  ca: number | null;
  /** Somme des nbSignaturesObjectif définis (null si aucun). */
  signatures: number | null;
  /** Nombre de collaborateurs ayant un objectif sur la période. */
  nbCollaborateurs: number;
}

/**
 * Objectif « société » = somme des objectifs individuels actifs (un par
 * collaborateur actif, le plus récent) qui couvrent [from, to]. `userId`
 * restreint à un collaborateur.
 */
async function getObjectiveSum(
  periode: "MENSUEL" | "ANNUEL",
  from: Date,
  to: Date,
  userId?: string,
): Promise<ObjectiveSum> {
  const rows = await prisma.objective.findMany({
    where: {
      periode,
      isActif: true,
      dateDebut: { lte: to },
      dateFin: { gte: from },
      ...(userId ? { userId } : { user: { isActive: true } }),
    },
    select: { userId: true, caObjectif: true, nbSignaturesObjectif: true },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  let ca: number | null = null;
  let signatures: number | null = null;
  for (const o of rows) {
    if (seen.has(o.userId)) continue;
    seen.add(o.userId);
    if (o.caObjectif != null && Number(o.caObjectif) > 0) {
      ca = (ca ?? 0) + Number(o.caObjectif);
    }
    if (o.nbSignaturesObjectif != null && o.nbSignaturesObjectif > 0) {
      signatures = (signatures ?? 0) + o.nbSignaturesObjectif;
    }
  }
  return { ca, signatures, nbCollaborateurs: seen.size };
}

// ---------------------------------------------------------------------------
// CHARGES MENSUELLES RÉCURRENTES
// ---------------------------------------------------------------------------

export interface RecurringChargeItem {
  key: string;
  label: string;
  categorie: string;
  /** Montant mensuel moyen (CHF TTC). */
  montantMensuel: number;
  /** `observe` : fournisseur vu chaque mois dans les charges ; `modele` : ExpenseRecurrence. */
  source: "observe" | "modele";
  /** Nombre de mois (sur 3) où la charge apparaît (observée uniquement). */
  moisVus: number;
}

export interface RecurringCharges {
  total: number;
  items: RecurringChargeItem[];
  /** Moyenne mensuelle de TOUTES les charges (ponctuelles comprises) sur la fenêtre. */
  moyenneTotale: number;
  /** « juillet - septembre 2026 » */
  fenetreLabel: string;
  nbModeles: number;
}

/** Catégories ponctuelles par nature : jamais comptées comme récurrentes. */
const NON_RECURRING_CATEGORIES = new Set(["RESTAURATION", "MATERIEL_BUREAU"]);

const SUPPLIER_STOPWORDS = new Set([
  "sa", "sarl", "sàrl", "gmbh", "ag", "inc", "ltd", "limited", "llc", "pbc", "sas",
  "bv", "b", "v", "ei", "the", "de", "du", "des", "la", "le", "les", "l", "d", "et",
  "and", "international", "online", "co", "cie",
]);

/** Clé fournisseur normalisée (« Anthropic Ireland, Limited » → « anthropic »). */
function supplierKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const words = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 0 && !SUPPLIER_STOPWORDS.has(w));
  return words[0] ?? null;
}

const FREQ_MONTHS: Record<string, number> = {
  MENSUEL: 1,
  BIMESTRIEL: 2,
  TRIMESTRIEL: 3,
  SEMESTRIEL: 6,
  ANNUEL: 12,
};

/**
 * Charges mensuelles récurrentes estimées :
 *  1. charges OBSERVÉES : fournisseurs (clé normalisée) présents dans au moins
 *     2 des 3 derniers mois complets, hors catégories ponctuelles (repas,
 *     matériel) ; montant = total des 3 mois / 3 ;
 *  2. + modèles ExpenseRecurrence actifs non encore observés, ramenés au mois.
 * Montants TTC (ce qui sort de la caisse), hors charges remboursées.
 */
export async function getRecurringCharges(now = new Date()): Promise<RecurringCharges> {
  const curMonth = monthKeyOf(zurichDayKey(now));
  const firstMonth = addMonthsKey(curMonth, -3);
  const from = zurichStartOfDay(monthStartKey(firstMonth));
  const to = zurichStartOfDay(monthStartKey(curMonth));

  const [expenses, templates] = await Promise.all([
    prisma.$queryRaw<
      Array<{ fournisseur: string | null; categorie: string; m: string; ttc: number; rid: string | null }>
    >`
      SELECT e."fournisseur" AS fournisseur, e."categorie"::text AS categorie,
        ${zMonth('e."date"')} AS m,
        e."montantTTC"::float8 AS ttc, e."recurrenceId" AS rid
      FROM expenses e
      WHERE e."date" >= ${ts(from)} AND e."date" < ${ts(to)}
        AND e."statutPaiement" <> 'REMBOURSE'
    `,
    prisma.expenseRecurrence.findMany({
      where: { actif: true, OR: [{ dateFin: null }, { dateFin: { gt: now } }] },
      select: {
        id: true,
        label: true,
        fournisseur: true,
        categorie: true,
        montantEstime: true,
        frequence: true,
      },
    }),
  ]);

  const totalAll = expenses.reduce((s, e) => s + (Number(e.ttc) || 0), 0);

  interface Group {
    months: Set<string>;
    total: number;
    labels: Map<string, number>;
    categorie: string;
    recurrenceIds: Set<string>;
  }
  const groups = new Map<string, Group>();
  for (const e of expenses) {
    if (NON_RECURRING_CATEGORIES.has(e.categorie)) continue;
    const key = supplierKey(e.fournisseur);
    if (!key) continue;
    const g =
      groups.get(key) ??
      ({ months: new Set(), total: 0, labels: new Map(), categorie: e.categorie, recurrenceIds: new Set() } as Group);
    g.months.add(e.m);
    g.total += Number(e.ttc) || 0;
    const lbl = (e.fournisseur ?? key).trim();
    g.labels.set(lbl, (g.labels.get(lbl) ?? 0) + 1);
    if (e.rid) g.recurrenceIds.add(e.rid);
    groups.set(key, g);
  }

  const items: RecurringChargeItem[] = [];
  const observedKeys = new Set<string>();
  const coveredTemplates = new Set<string>();
  for (const [key, g] of groups) {
    if (g.months.size < 2) continue;
    const montant = g.total / 3;
    if (montant <= 0) continue;
    observedKeys.add(key);
    for (const rid of g.recurrenceIds) coveredTemplates.add(rid);
    const label = [...g.labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key;
    items.push({
      key,
      label,
      categorie: g.categorie,
      montantMensuel: montant,
      source: "observe",
      moisVus: g.months.size,
    });
  }

  let nbModeles = 0;
  for (const t of templates) {
    if (coveredTemplates.has(t.id)) continue;
    const k = supplierKey(t.fournisseur) ?? supplierKey(t.label);
    if (k && observedKeys.has(k)) continue;
    const months = FREQ_MONTHS[t.frequence] ?? 1;
    const montant = Number(t.montantEstime) / months;
    if (!(montant > 0)) continue;
    nbModeles += 1;
    items.push({
      key: `modele-${t.id}`,
      label: t.label,
      categorie: t.categorie,
      montantMensuel: montant,
      source: "modele",
      moisVus: 0,
    });
  }

  items.sort((a, b) => b.montantMensuel - a.montantMensuel);
  const total = items.reduce((s, i) => s + i.montantMensuel, 0);
  const lastMonth = addMonthsKey(curMonth, -1);

  return {
    total,
    items,
    moyenneTotale: totalAll / 3,
    fenetreLabel: `${monthOnlyLabel(firstMonth)} - ${monthLongLabel(lastMonth)}`,
    nbModeles,
  };
}

// ---------------------------------------------------------------------------
// TABLEAU DE BORD DE DIRECTION
// ---------------------------------------------------------------------------

export interface DirectionDashboard {
  /** « octobre 2026 » */
  monthLabel: string;
  /** « octobre » */
  monthName: string;
  year: number;
  /** Jours ouvrés restants dans le mois, aujourd'hui compris. */
  workingDaysLeft: number;
  /** Dernier jour ouvré du mois « 30.10 ». */
  lastWorkingDayLabel: string;
  contratsMois: { value: number; objectif: number | null };
  caMois: { value: number; objectif: number | null };
  caAnnee: {
    value: number;
    objectif: number | null;
    /** Projection au rythme actuel (CA YTD / part de l'année écoulée). */
    projection: number;
    /** Mois complets restants après le mois en cours. */
    moisRestants: number;
    /** CA mensuel nécessaire sur les mois restants (mois en cours compris) pour l'objectif annuel. */
    besoinParMois: number | null;
  };
  nbCollaborateursObjectifMois: number;
  mrr: { value: number; nbContrats: number };
  charges: RecurringCharges;
  margeRecurrente: number;
  /** Marge récurrente / MRR (null si MRR nul). */
  margePct: number | null;
  /** MRR / charges récurrentes (null si charges nulles). */
  couverture: number | null;
  plan: {
    rdvSemaine: number;
    rdvAValider: number;
    dernierRdvAValider: { prospect: string; quand: string } | null;
    contratsAValider: number;
    propositionsEnAttente: number;
    propositionsRecentes: number;
  };
}

export async function getDirectionDashboard(): Promise<DirectionDashboard> {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const month = monthKeyOf(todayKey);
  const year = Number(todayKey.slice(0, 4));
  const monthStart = zurichStartOfDay(monthStartKey(month));
  const lastKey = lastDayKeyOfMonth(month);
  const monthEnd = zurichEndOfDay(lastKey);
  const yearStart = zurichStartOfDay(`${year}-01-01`);
  const yearEnd = zurichEndOfDay(`${year}-12-31`);

  // Fin de semaine (dimanche soir, Zurich).
  const todayUtc = keyToUtcDate(todayKey);
  const sundayKey = addDaysKey(todayKey, 7 - (todayUtc.getUTCDay() || 7));
  const weekEnd = zurichEndOfDay(sundayKey);
  const since30 = zurichStartOfDay(addDaysKey(todayKey, -29));

  const signedWhere = { statut: { notIn: NON_SIGNES } };

  const [
    moisAgg,
    anneeAgg,
    objMois,
    objAnnee,
    mrrAgg,
    charges,
    rdvSemaine,
    rdvAValider,
    dernierRdv,
    contratsAValider,
    propositionsEnAttente,
    propositionsRecentes,
  ] = await Promise.all([
    prisma.contract.aggregate({
      where: { ...signedWhere, dateSignature: { gte: monthStart, lte: monthEnd } },
      _count: true,
      _sum: { valeurAn1: true },
    }),
    prisma.contract.aggregate({
      where: { ...signedWhere, dateSignature: { gte: yearStart, lte: yearEnd } },
      _sum: { valeurAn1: true },
    }),
    getObjectiveSum("MENSUEL", monthStart, monthEnd),
    getObjectiveSum("ANNUEL", now, now),
    prisma.contract.aggregate({
      where: { statut: "ACTIF" },
      _sum: { montantMensuel: true },
      _count: true,
    }),
    getRecurringCharges(now),
    prisma.activity.count({
      where: {
        type: { in: RDV_TYPES },
        prospectId: { not: null },
        statut: "PLANIFIE",
        date: { gte: now, lte: weekEnd },
        user: { isActive: true },
      },
    }),
    prisma.activity.count({
      where: {
        type: { in: RDV_TYPES },
        prospectId: { not: null },
        statut: "PLANIFIE",
        date: { lt: now },
        user: { isActive: true },
      },
    }),
    prisma.activity.findFirst({
      where: {
        type: { in: RDV_TYPES },
        prospectId: { not: null },
        statut: "PLANIFIE",
        date: { lt: now },
        user: { isActive: true },
      },
      orderBy: { date: "desc" },
      select: { date: true, prospect: { select: { raisonSociale: true } } },
    }),
    prisma.contract.count({ where: { statut: "ATTENTE_VALIDATION_ADMIN" } }),
    prisma.contract.count({ where: { statut: "ATTENTE_SIGNATURE_CLIENT" } }),
    prisma.contract.count({
      where: { statut: "ATTENTE_SIGNATURE_CLIENT", createdAt: { gte: since30 } },
    }),
  ]);

  const caYtd = Number(anneeAgg._sum.valeurAn1 ?? 0);
  const elapsed = Math.min(
    1,
    Math.max(1 / 365, (now.getTime() - yearStart.getTime()) / (yearEnd.getTime() + 1 - yearStart.getTime())),
  );
  const monthIndex = Number(month.slice(5, 7)); // 1-12
  const moisRestants = 12 - monthIndex;
  const besoinParMois =
    objAnnee.ca != null ? Math.max(0, objAnnee.ca - caYtd) / (moisRestants + 1) : null;

  const mrr = Number(mrrAgg._sum.montantMensuel ?? 0);
  const marge = mrr - charges.total;

  let lastWorking = lastKey;
  while (lastWorking > todayKey && !isWorkingDay(keyToUtcDate(lastWorking))) {
    lastWorking = addDaysKey(lastWorking, -1);
  }

  return {
    monthLabel: monthLongLabel(month),
    monthName: monthOnlyLabel(month),
    year,
    workingDaysLeft: workingDaysBetween(todayKey, lastKey),
    lastWorkingDayLabel: keyLabel(lastWorking, true),
    contratsMois: { value: moisAgg._count, objectif: objMois.signatures },
    caMois: { value: Number(moisAgg._sum.valeurAn1 ?? 0), objectif: objMois.ca },
    caAnnee: {
      value: caYtd,
      objectif: objAnnee.ca,
      projection: caYtd / elapsed,
      moisRestants,
      besoinParMois,
    },
    nbCollaborateursObjectifMois: objMois.nbCollaborateurs,
    mrr: { value: mrr, nbContrats: mrrAgg._count },
    charges,
    margeRecurrente: marge,
    margePct: mrr > 0 ? marge / mrr : null,
    couverture: charges.total > 0 ? mrr / charges.total : null,
    plan: {
      rdvSemaine,
      rdvAValider,
      dernierRdvAValider: dernierRdv?.prospect
        ? {
            prospect: dernierRdv.prospect.raisonSociale,
            quand: `${keyLabel(zurichDayKey(dernierRdv.date), true)} ${timeFmt.format(dernierRdv.date)}`,
          }
        : null,
      contratsAValider,
      propositionsEnAttente,
      propositionsRecentes,
    },
  };
}

// ---------------------------------------------------------------------------
// SAISON D'UN COLLABORATEUR (héros commerciale)
// ---------------------------------------------------------------------------

export interface PlayerMonth {
  monthLabel: string;
  monthName: string;
  workingDaysLeft: number;
  counters: PeriodCounters;
  objectifSignatures: number | null;
  objectifCa: number | null;
}

/** Mois en cours d'un collaborateur : compteurs + objectif MENSUEL (s'il existe). */
export async function getPlayerMonth(userId: string): Promise<PlayerMonth> {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const month = monthKeyOf(todayKey);
  const lastKey = lastDayKeyOfMonth(month);
  const start = zurichStartOfDay(monthStartKey(month));
  const end = zurichEndOfDay(todayKey);
  const [counters, obj] = await Promise.all([
    getPeriodCounters(userId, start, end),
    getObjectiveSum("MENSUEL", start, zurichEndOfDay(lastKey), userId),
  ]);
  return {
    monthLabel: monthLongLabel(month),
    monthName: monthOnlyLabel(month),
    workingDaysLeft: workingDaysBetween(todayKey, lastKey),
    counters,
    objectifSignatures: obj.signatures,
    objectifCa: obj.ca,
  };
}

// ---------------------------------------------------------------------------
// ACTIVITÉ DE L'ÉQUIPE (jour / semaine / mois) AVEC XP
// ---------------------------------------------------------------------------

export type TeamPeriodKey = "jour" | "semaine" | "mois";

export interface TeamRow {
  userId: string;
  name: string;
  firstName: string;
  initials: string;
  role: string;
  counters: DayCounters;
  caSigne: number;
  xp: number;
  rank: number;
  /** Objectif QUOTIDIEN réellement défini pour aujourd'hui (null sinon). */
  objAppelsJour: number | null;
  objRdvJour: number | null;
  /** Cibles des missions du jour (objectif défini, sinon valeurs par défaut du jeu). */
  missionTargets: DailyTargets;
}

export interface TeamPeriod {
  key: TeamPeriodKey;
  label: string;
  title: string;
  message: string;
  rows: TeamRow[];
  total: DayCounters & { caSigne: number; xp: number };
}

export interface TeamBoard {
  periods: Record<TeamPeriodKey, TeamPeriod>;
  /** Défi d'équipe du mois : CA signé ensemble vs objectif CA mensuel société. */
  defi: {
    monthName: string;
    total: number;
    objectif: number | null;
    contributions: { userId: string; name: string; firstName: string; ca: number }[];
  };
}

interface TeamDayRow {
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
  ca: number;
}

interface DailyObjective {
  userId: string;
  startKey: string;
  endKey: string;
  appels: number | null;
  rdvPris: number | null;
  propositions: number | null;
}

const positive = (v: number | null | undefined, fallback: number): number =>
  v != null && v > 0 ? v : fallback;

function targetsFor(objectives: DailyObjective[], key: string): DailyTargets {
  const o = objectives.find((x) => x.startKey <= key && x.endKey >= key);
  return {
    appels: positive(o?.appels, DEFAULT_DAILY_TARGETS.appels),
    rdvPris: positive(o?.rdvPris, DEFAULT_DAILY_TARGETS.rdvPris),
    propositions: positive(o?.propositions, DEFAULT_DAILY_TARGETS.propositions),
  };
}

function emptyDay(): DayCounters {
  return {
    appels: 0,
    conversations: 0,
    rdvPris: 0,
    rdvEffectues: 0,
    propositions: 0,
    signatures: 0,
    emails: 0,
  };
}

function addCounters(a: DayCounters, b: DayCounters): DayCounters {
  return {
    appels: a.appels + b.appels,
    conversations: a.conversations + b.conversations,
    rdvPris: a.rdvPris + b.rdvPris,
    rdvEffectues: a.rdvEffectues + b.rdvEffectues,
    propositions: a.propositions + b.propositions,
    signatures: a.signatures + b.signatures,
    emails: a.emails + b.emails,
  };
}

/**
 * Activité par collaborateur actif sur aujourd'hui, la semaine ISO en cours et
 * le mois en cours, avec les XP calculés EXACTEMENT comme le moteur de jeu
 * (XP des actions + bonus des missions remplies, jour par jour).
 */
export async function getTeamBoard(): Promise<TeamBoard> {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const todayUtc = keyToUtcDate(todayKey);
  const mondayKey = addDaysKey(todayKey, -((todayUtc.getUTCDay() || 7) - 1));
  const month = monthKeyOf(todayKey);
  const monthKey1 = monthStartKey(month);
  const fromKey = mondayKey < monthKey1 ? mondayKey : monthKey1;
  const from = zurichStartOfDay(fromKey);
  const to = zurichStartOfDay(addDaysKey(todayKey, 1));

  const [users, objectivesRaw, rows, objMois] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.objective.findMany({
      where: { periode: "QUOTIDIEN", isActif: true, user: { isActive: true } },
      select: {
        userId: true,
        dateDebut: true,
        dateFin: true,
        nbAppelsObjectif: true,
        nbRdvObjectif: true,
        nbPropositionsObjectif: true,
      },
      orderBy: { dateFin: "desc" },
    }),
    prisma.$queryRaw<TeamDayRow[]>`
      SELECT t.uid, t.d,
        SUM(t.appels)::int AS appels,
        SUM(t.conversations)::int AS conversations,
        SUM(t.rdv_pris)::int AS rdv_pris,
        SUM(t.rdv_effectues)::int AS rdv_effectues,
        SUM(t.emails)::int AS emails,
        SUM(t.propositions)::int AS propositions,
        SUM(t.signatures)::int AS signatures,
        COALESCE(SUM(t.mensuel), 0)::float8 AS mensuel,
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
          0::numeric AS ca
        FROM activities a
        WHERE a."userId" IN (SELECT u.id FROM users u WHERE u."isActive")
          AND a."date" >= ${ts(from)}
          AND a."date" < ${ts(to)}
        GROUP BY 1, 2

        UNION ALL

        SELECT c."assigneAId" AS uid, ${zDay('c."createdAt"')} AS d,
          0, 0, 0, 0, 0,
          COUNT(*) AS propositions,
          0, 0, 0
        FROM contracts c
        WHERE c."assigneAId" IN (SELECT u.id FROM users u WHERE u."isActive")
          AND c."createdAt" >= ${ts(from)}
          AND c."createdAt" < ${ts(to)}
          AND NOT (c."dateSignature" IS NOT NULL AND c."dateSignature" < c."createdAt" - INTERVAL '7 days')
        GROUP BY 1, 2

        UNION ALL

        SELECT c."assigneAId" AS uid, ${zDay('c."dateSignature"')} AS d,
          0, 0, 0, 0, 0, 0,
          COUNT(*) AS signatures,
          SUM(c."montantMensuel") AS mensuel,
          SUM(c."valeurAn1") AS ca
        FROM contracts c
        WHERE c."assigneAId" IN (SELECT u.id FROM users u WHERE u."isActive")
          AND c."statut" NOT IN ('ATTENTE_SIGNATURE_CLIENT', 'ATTENTE_VALIDATION_ADMIN')
          AND c."dateSignature" >= ${ts(from)}
          AND c."dateSignature" < ${ts(to)}
        GROUP BY 1, 2
      ) t
      GROUP BY t.uid, t.d
    `,
    getObjectiveSum(
      "MENSUEL",
      zurichStartOfDay(monthKey1),
      zurichEndOfDay(lastDayKeyOfMonth(month)),
    ),
  ]);

  const objectives: DailyObjective[] = objectivesRaw.map((o) => ({
    userId: o.userId,
    startKey: zurichDayKey(o.dateDebut),
    endKey: zurichDayKey(o.dateFin),
    appels: o.nbAppelsObjectif,
    rdvPris: o.nbRdvObjectif,
    propositions: o.nbPropositionsObjectif,
  }));
  const objByUser = new Map<string, DailyObjective[]>();
  for (const o of objectives) {
    const list = objByUser.get(o.userId) ?? [];
    list.push(o);
    objByUser.set(o.userId, list);
  }

  interface Acc {
    c: DayCounters;
    ca: number;
    xp: number;
  }
  const blank = (): Acc => ({ c: emptyDay(), ca: 0, xp: 0 });
  const acc: Record<TeamPeriodKey, Map<string, Acc>> = {
    jour: new Map(),
    semaine: new Map(),
    mois: new Map(),
  };

  for (const r of rows) {
    const c: DayCounters = {
      appels: r.appels,
      conversations: r.conversations,
      rdvPris: r.rdv_pris,
      rdvEffectues: r.rdv_effectues,
      propositions: r.propositions,
      signatures: r.signatures,
      emails: r.emails,
    };
    const xp = xpForDay(c, Number(r.mensuel) || 0, targetsFor(objByUser.get(r.uid) ?? [], r.d));
    const ca = Number(r.ca) || 0;
    const buckets: TeamPeriodKey[] = [];
    if (r.d === todayKey) buckets.push("jour");
    if (r.d >= mondayKey && r.d <= todayKey) buckets.push("semaine");
    if (r.d >= monthKey1 && r.d <= todayKey) buckets.push("mois");
    for (const b of buckets) {
      const cur = acc[b].get(r.uid) ?? blank();
      cur.c = addCounters(cur.c, c);
      cur.ca += ca;
      cur.xp += xp;
      acc[b].set(r.uid, cur);
    }
  }

  const monthName = monthOnlyLabel(month);
  const workingLeft = workingDaysBetween(todayKey, lastDayKeyOfMonth(month));

  const buildRows = (key: TeamPeriodKey): TeamRow[] => {
    const list = users.map((u) => {
      const a = acc[key].get(u.id) ?? blank();
      const todayObj = (objByUser.get(u.id) ?? []).find(
        (o) => o.startKey <= todayKey && o.endKey >= todayKey,
      );
      return {
        userId: u.id,
        name: u.name,
        firstName: firstNameOf(u.name),
        initials: initialsOf(u.name),
        role: u.role,
        counters: a.c,
        caSigne: a.ca,
        xp: a.xp,
        rank: 0,
        objAppelsJour: positive(todayObj?.appels, 0) || null,
        objRdvJour: positive(todayObj?.rdvPris, 0) || null,
        missionTargets: targetsFor(objByUser.get(u.id) ?? [], todayKey),
      };
    });
    list.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, "fr"));
    let prevXp: number | null = null;
    let prevRank = 0;
    return list.map((r, i) => {
      const rank = prevXp !== null && r.xp === prevXp ? prevRank : i + 1;
      prevXp = r.xp;
      prevRank = rank;
      return { ...r, rank };
    });
  };

  const totalOf = (rows: TeamRow[]) =>
    rows.reduce(
      (t, r) => ({ ...addCounters(t, r.counters), caSigne: t.caSigne + r.caSigne, xp: t.xp + r.xp }),
      { ...emptyDay(), caSigne: 0, xp: 0 },
    );

  const jourRows = buildRows("jour");
  const semaineRows = buildRows("semaine");
  const moisRows = buildRows("mois");
  const moisTotal = totalOf(moisRows);

  // Messages « coach » à partir des vraies données.
  const jourMessage = (() => {
    const leader = jourRows[0];
    if (!leader || leader.xp === 0) {
      return "La journée commence : premier appel, premiers XP. On lance la machine.";
    }
    const commerciale = jourRows.find((r) => r.role !== "ADMIN") ?? leader;
    const restAppels = Math.max(0, commerciale.missionTargets.appels - commerciale.counters.appels);
    const restRdv = Math.max(0, commerciale.missionTargets.rdvPris - commerciale.counters.rdvPris);
    const parts: string[] = [];
    parts.push(
      restAppels > 0
        ? `${commerciale.firstName} est à ${restAppels} appel${restAppels > 1 ? "s" : ""} de sa mission du jour`
        : `${commerciale.firstName} a plié sa mission appels du jour`,
    );
    parts.push(
      restRdv > 0 ? `à ${restRdv} RDV de la mission RDV` : "la mission RDV est remplie",
    );
    return `${parts.join(" et ")}. ${leader.firstName} mène la journée avec ${leader.xp} XP.`;
  })();

  const semaineMessage = (() => {
    const [first, second] = semaineRows;
    if (!first || first.xp === 0) return "Nouvelle semaine, compteurs à zéro : le premier qui décroche prend la tête.";
    if (second && second.xp > 0) {
      return `${first.firstName} mène la semaine avec ${first.xp} XP, ${second.firstName} suit à ${second.xp} XP. Écart : ${first.xp - second.xp} XP.`;
    }
    return `${first.firstName} mène la semaine avec ${first.xp} XP.`;
  })();

  const moisMessage = (() => {
    const n = moisTotal.signatures;
    const sig = `${n} signature${n > 1 ? "s" : ""}`;
    const jours = `${workingLeft} jour${workingLeft > 1 ? "s" : ""} ouvré${workingLeft > 1 ? "s" : ""}`;
    const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    if (objMois.signatures != null) {
      const manque = Math.max(0, objMois.signatures - n);
      return manque > 0
        ? `${label} : ${sig} sur ${objMois.signatures}. Il en manque ${manque} et il reste ${jours}, chaque RDV compte.`
        : `${label} : ${sig} sur ${objMois.signatures}, objectif plié. Il reste ${jours} pour faire exploser le compteur.`;
    }
    return `${label} : ${sig} pour l'équipe. Il reste ${jours} pour en ajouter.`;
  })();

  const todayLabel = `${weekdayFmt.format(todayUtc)} ${keyLabel(todayKey)}`;
  const sundayKey = addDaysKey(mondayKey, 6);

  return {
    periods: {
      jour: {
        key: "jour",
        label: "Jour",
        title: `Aujourd'hui · ${todayLabel}`,
        message: jourMessage,
        rows: jourRows,
        total: totalOf(jourRows),
      },
      semaine: {
        key: "semaine",
        label: "Semaine",
        title: `Cette semaine · ${keyLabel(mondayKey, true)} - ${keyLabel(sundayKey)}`,
        message: semaineMessage,
        rows: semaineRows,
        total: totalOf(semaineRows),
      },
      mois: {
        key: "mois",
        label: "Mois",
        title: `Ce mois · ${monthLongLabel(month)}`,
        message: moisMessage,
        rows: moisRows,
        total: moisTotal,
      },
    },
    defi: {
      monthName,
      total: moisTotal.caSigne,
      objectif: objMois.ca,
      contributions: moisRows
        .filter((r) => r.caSigne > 0)
        .sort((a, b) => b.caSigne - a.caSigne)
        .map((r) => ({ userId: r.userId, name: r.name, firstName: r.firstName, ca: r.caSigne })),
    },
  };
}

/** Missions remplies (0-3) d'une ligne d'équipe pour aujourd'hui. */
export function missionsDoneToday(row: TeamRow): number {
  return missionsFor(row.counters, row.missionTargets).filter((m) => m.done).length;
}

// ---------------------------------------------------------------------------
// HISTORIQUE 12 MOIS (MRR reconstitué, charges, CA signé)
// ---------------------------------------------------------------------------

export interface MonthPoint {
  key: string;
  short: string;
  long: string;
  /** MRR en fin de mois (mois en cours : MRR actuel des contrats ACTIF). */
  mrr: number;
  /** Total des charges du mois (toutes, TTC, hors remboursées). */
  charges: number;
  /** CA signé (valeur an 1) des contrats signés dans le mois. */
  caSigne: number;
  nbSignatures: number;
  /** Somme des objectifs CA MENSUEL couvrant ce mois (null si aucun). */
  objectifCa: number | null;
  isCurrent: boolean;
}

export async function getMonthlyHistory(nbMonths = 12): Promise<MonthPoint[]> {
  const now = new Date();
  const todayKey = zurichDayKey(now);
  const curMonth = monthKeyOf(todayKey);
  const firstMonth = addMonthsKey(curMonth, -(nbMonths - 1));
  const from = zurichStartOfDay(monthStartKey(firstMonth));

  const [contracts, expenses, objectives] = await Promise.all([
    prisma.contract.findMany({
      where: { statut: { notIn: NON_SIGNES } },
      select: {
        dateSignature: true,
        statut: true,
        dateResiliation: true,
        updatedAt: true,
        montantMensuel: true,
        valeurAn1: true,
      },
    }),
    prisma.$queryRaw<Array<{ m: string; ttc: number }>>`
      SELECT ${zMonth('e."date"')} AS m,
        COALESCE(SUM(e."montantTTC"), 0)::float8 AS ttc
      FROM expenses e
      WHERE e."date" >= ${ts(from)} AND e."date" <= ${ts(now)}
        AND e."statutPaiement" <> 'REMBOURSE'
      GROUP BY 1
    `,
    prisma.objective.findMany({
      where: {
        periode: "MENSUEL",
        isActif: true,
        dateFin: { gte: from },
        user: { isActive: true },
      },
      select: { userId: true, dateDebut: true, dateFin: true, caObjectif: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const chargesByMonth = new Map(expenses.map((e) => [e.m, Number(e.ttc) || 0]));

  const points: MonthPoint[] = [];
  for (let i = 0; i < nbMonths; i++) {
    const mk = addMonthsKey(firstMonth, i);
    const isCurrent = mk === curMonth;
    const mStart = zurichStartOfDay(monthStartKey(mk));
    const mEnd = isCurrent ? now : zurichEndOfDay(lastDayKeyOfMonth(mk));

    let mrr = 0;
    let caSigne = 0;
    let nbSignatures = 0;
    for (const c of contracts) {
      const signed = c.dateSignature;
      if (signed >= mStart && signed <= mEnd) {
        caSigne += Number(c.valeurAn1);
        nbSignatures += 1;
      }
      if (isCurrent) {
        // Mois en cours : MRR exact = contrats ACTIF (même règle que /stats).
        if (c.statut === "ACTIF") mrr += Number(c.montantMensuel);
        continue;
      }
      // Mois passés : MRR reconstitué (signé avant la fin du mois et pas
      // encore terminé : résiliation, échéance ou suspension datée par la
      // dernière mise à jour du contrat).
      if (signed > mEnd) continue;
      let endAt: Date | null = null;
      if (c.statut !== "ACTIF") endAt = c.dateResiliation ?? c.updatedAt;
      if (endAt && endAt <= mEnd) continue;
      mrr += Number(c.montantMensuel);
    }

    const seen = new Set<string>();
    let objectifCa: number | null = null;
    for (const o of objectives) {
      if (o.dateDebut > mEnd || o.dateFin < mStart) continue;
      if (seen.has(o.userId)) continue;
      seen.add(o.userId);
      if (o.caObjectif != null && Number(o.caObjectif) > 0) {
        objectifCa = (objectifCa ?? 0) + Number(o.caObjectif);
      }
    }

    points.push({
      key: mk,
      short: monthShortLabel(mk),
      long: monthLongLabel(mk),
      mrr,
      charges: chargesByMonth.get(mk) ?? 0,
      caSigne,
      nbSignatures,
      objectifCa,
      isCurrent,
    });
  }
  return points;
}
