/**
 * Résultats commerciaux - règles et fonctions PURES (client-safe).
 *
 * Le CRM n'est pas un jeu (décision d'Arthur, 27.10.2026) : on suit des
 * résultats réels (CA signé en CHF, contrats signés, RDV pris / effectués,
 * propositions, appels), des « Objectifs du jour », une série de régularité,
 * des records exprimés en résultats et un classement en CA signé puis RDV pris.
 *
 * Ce fichier ne dépend d'aucune ressource serveur (pas de prisma) : il est
 * importable depuis un composant client. Les requêtes vivent dans `engine.ts`.
 *
 * Les éléments marqués `@deprecated` (XP, niveaux, badges, combo) sont gardés
 * UNIQUEMENT pour que les rubriques pas encore nettoyées compilent : ne plus
 * les utiliser, ils disparaîtront une fois les rubriques migrées.
 */

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type Tone =
  | "coral"
  | "navy"
  | "green"
  | "gold"
  | "blue"
  | "violet"
  | "teal"
  | "red";

export interface DayCounters {
  appels: number;
  conversations: number;
  rdvPris: number;
  rdvEffectues: number;
  propositions: number;
  signatures: number;
  emails: number;
}

/** Objectifs quotidiens (Objective QUOTIDIEN actif, sinon DEFAULT_DAILY_TARGETS). */
export interface DailyTargets {
  appels: number;
  rdvPris: number;
  propositions: number;
}

/** Un objectif du jour (appels, RDV pris, propositions) avec sa jauge. */
export interface DailyGoal {
  key: "appels" | "rdvPris" | "propositions";
  /** Ex. « Passer 40 appels ». */
  label: string;
  current: number;
  target: number;
  /** Progression 0-100 (jamais 100 tant que l'objectif n'est pas atteint). */
  pct: number;
  done: boolean;
  /** Reste à faire pour atteindre l'objectif (0 si atteint). */
  remaining: number;
}

/** Résultats réels d'un mois (fuseau Europe/Zurich). */
export interface MonthResults {
  /** Clé du mois « AAAA-MM ». */
  monthKey: string;
  /**
   * CA signé (CHF) : valeur TOTALE des contrats réellement signés du mois
   * (montantOneShot + montantMensuel × dureeMois, statuts ACTIF / SUSPENDU /
   * RESILIE / EXPIRE, datés par dateSignature). Même définition que le
   * dashboard (`getDashboard().monthlyProgress.caRealise`) et le héros
   * pipeline. NB : /stats (pilotage) affiche la valeur an 1 (`valeurAn1`).
   */
  caSigne: number;
  /** Nombre de contrats réellement signés dans le mois. */
  contratsSignes: number;
  rdvPris: number;
  rdvEffectues: number;
  appels: number;
  propositions: number;
}

/**
 * Objectifs du mois (Objective MENSUEL actif le plus récent couvrant le mois).
 * `null` = pas d'objectif défini (jamais inventé ; un objectif à 0 vaut null).
 */
export interface MonthTargets {
  /** Objectif de CA signé (CHF), à comparer à `MonthResults.caSigne`. */
  caSigne: number | null;
  /** Objectif de contrats signés. */
  contratsSignes: number | null;
  /** Objectif de RDV (le dashboard le compare aux RDV effectués). */
  rdv: number | null;
  appels: number | null;
}

/** En-tête léger (layout : carte résultats de la sidebar, pilules de la topbar). */
export interface PlayerHeader {
  userId: string;
  name: string;
  firstName: string;
  initials: string;
  /** Compteurs du jour (Europe/Zurich). */
  today: DayCounters;
  /** Objectifs du jour (appels, RDV pris, propositions). */
  dailyTargets: DailyTargets;
  /** Résultats du mois en cours. */
  month: MonthResults;
  /** Série en cours (jours ouvrés consécutifs avec l'objectif d'appels atteint). */
  streak: number;
  /** Objectif d'appels du jour (= dailyTargets.appels). */
  dailyCallTarget: number;
  /** @deprecated Plus de niveaux dans l'interface. */
  level: LevelInfo;
  /** @deprecated Plus d'XP dans l'interface : utiliser `today`. */
  xpToday: number;
}

/** Records exprimés en résultats. */
export interface PlayerRecords {
  /** Meilleure journée en RDV pris. */
  bestDayRdvPris: number;
  /** Jour de ce record « AAAA-MM-JJ » (premier jour l'ayant atteint), null si aucun RDV. */
  bestDayRdvPrisDate: string | null;
  /** Meilleur mois en CA signé (CHF, même définition que MonthResults.caSigne). */
  bestMonthCaSigne: number;
  /** Mois de ce record « AAAA-MM », null si aucun contrat signé. */
  bestMonthCaSigneKey: string | null;
  /** Plus gros contrat signé, en CHF / mois (montantMensuel). */
  biggestContractMensuel: number;
  /** Plus longue série (jours ouvrés). */
  longestStreak: number;
  /** @deprecated XP. */
  bestDayXp: number;
  /** @deprecated Jour du record XP. */
  bestDayDate: string | null;
  /** @deprecated XP. */
  bestWeekXp: number;
}

/** Statistiques complètes (dashboard, Ma journée, objectifs...). */
export interface PlayerStats extends PlayerHeader {
  /** Objectifs du jour avec jauges (sans récompense en points). */
  dailyGoals: DailyGoal[];
  /** Objectifs du mois (null si non définis). */
  monthTargets: MonthTargets;
  records: PlayerRecords;
  /** Plus longue série (= records.longestStreak). */
  streakRecord: number;
  /** @deprecated Utiliser `dailyGoals`. */
  missions: Mission[];
  /** @deprecated Plus de badges. */
  badges: BadgeState[];
  /** @deprecated XP. */
  xpTotal: number;
  /** @deprecated XP. */
  xpRecordDay: number;
  /** @deprecated XP. */
  xpWeek: number;
  /** @deprecated XP. */
  xpRecordWeek: number;
}

/** Ligne du classement (semaine ou mois) : CA signé puis RDV pris. */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  initials: string;
  /** CA signé de la période (CHF, même définition que MonthResults.caSigne). */
  caSigne: number;
  contratsSignes: number;
  rdvPris: number;
  appels: number;
  /** Rang (ex aequo si même CA signé ET mêmes RDV pris). */
  rank: number;
  isMe: boolean;
  /** @deprecated XP : ne plus afficher. */
  xp: number;
}

// ---------------------------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------------------------

/** Titre de la section des objectifs quotidiens. */
export const DAILY_GOALS_TITLE = "Objectifs du jour";

export const DEFAULT_DAILY_TARGETS: DailyTargets = { appels: 40, rdvPris: 3, propositions: 1 };

// ---------------------------------------------------------------------------
// FONCTIONS PURES
// ---------------------------------------------------------------------------

/** Compteurs à zéro. */
export function emptyCounters(): DayCounters {
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

/** Résultats d'un mois à zéro. */
export function emptyMonthResults(monthKey: string): MonthResults {
  return {
    monthKey,
    caSigne: 0,
    contratsSignes: 0,
    rdvPris: 0,
    rdvEffectues: 0,
    appels: 0,
    propositions: 0,
  };
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n > 1 ? pluralForm : singular;
}

/** Les 3 objectifs du jour à partir des compteurs et des objectifs quotidiens. */
export function dailyGoalsFor(c: DayCounters, targets: DailyTargets): DailyGoal[] {
  const build = (
    key: DailyGoal["key"],
    label: string,
    current: number,
    target: number,
  ): DailyGoal => {
    const t = Math.max(1, target);
    const done = current >= t;
    return {
      key,
      label,
      current,
      target: t,
      // Jamais 100 % tant que l'objectif n'est pas atteint (ex. 39 / 40).
      pct: done ? 100 : Math.min(99, Math.max(0, Math.round((current / t) * 100))),
      done,
      remaining: Math.max(0, t - current),
    };
  };
  return [
    build(
      "appels",
      `Passer ${targets.appels} ${plural(targets.appels, "appel", "appels")}`,
      c.appels,
      targets.appels,
    ),
    build("rdvPris", `Décrocher ${targets.rdvPris} RDV`, c.rdvPris, targets.rdvPris),
    build(
      "propositions",
      `Envoyer ${targets.propositions} ${plural(targets.propositions, "proposition", "propositions")}`,
      c.propositions,
      targets.propositions,
    ),
  ];
}

/** Prénom (premier mot du nom). */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Initiales (premier + dernier mot), ex. « Lucille Bouin » → « LB ». */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ===========================================================================
// DÉPRÉCIÉ : XP, niveaux, badges, combo. Gardé le temps que les rubriques
// soient nettoyées ; ne plus utiliser dans du nouveau code.
// ===========================================================================

/** @deprecated Plus de niveaux. */
export type LevelName = "Rookie" | "Hunter" | "Closer" | "Machine" | "Légende";

/** @deprecated Plus de niveaux. */
export interface LevelInfo {
  level: 1 | 2 | 3 | 4 | 5;
  name: LevelName;
  /** XP total du joueur. */
  xp: number;
  /** XP plancher du niveau courant. */
  floorXp: number;
  /** XP requis pour le niveau suivant (null au niveau max). */
  nextXp: number | null;
  nextName: LevelName | null;
  /** Progression 0-100 dans le niveau courant. */
  pct: number;
  /** XP manquants avant le niveau suivant (null au niveau max). */
  xpToNext: number | null;
}

/** @deprecated Utiliser `DailyGoal` (`xpReward` vaut toujours 0). */
export interface Mission extends Omit<DailyGoal, "remaining"> {
  remaining?: number;
  /** @deprecated Toujours 0 : plus de récompense en points. */
  xpReward: number;
}

/** @deprecated Plus de badges. */
export interface BadgeState {
  key:
    | "premier-sang"
    | "sniper"
    | "marathon"
    | "serie-de-feu"
    | "closer-du-mois"
    | "inbox-zero"
    | "legende"
    | "grand-chelem";
  label: string;
  description: string;
  earned: boolean;
  tone: Tone;
}

/** @deprecated Plus de niveaux. */
export const LEVELS: { level: 1 | 2 | 3 | 4 | 5; name: LevelName; minXp: number }[] = [
  { level: 1, name: "Rookie", minXp: 0 },
  { level: 2, name: "Hunter", minXp: 5000 },
  { level: 3, name: "Closer", minXp: 15000 },
  { level: 4, name: "Machine", minXp: 40000 },
  { level: 5, name: "Légende", minXp: 100000 },
];

/** @deprecated Plus d'XP dans l'interface. */
export const XP_RULES = {
  appel: 5,
  conversation: 10,
  email: 3,
  rdvPris: 50,
  rdvEffectue: 80,
  proposition: 60,
  signature: 200,
  signatureParTranche10ChfMensuel: 1,
  missionDuJour: 100,
} as const;

/** @deprecated Plus de combo au phoning. */
export const COMBO_STEPS: { minCalls: number; mult: number }[] = [
  { minCalls: 0, mult: 1 },
  { minCalls: 5, mult: 1.5 },
  { minCalls: 10, mult: 2 },
  { minCalls: 20, mult: 3 },
];

/** @deprecated Plus de combo au phoning. */
export const COMBO_GAP_MINUTES = 3;

/** @deprecated Plus de badges. */
export const BADGE_DEFS: Omit<BadgeState, "earned">[] = [
  { key: "premier-sang", label: "Premier sang", description: "Signe ton premier contrat", tone: "coral" },
  { key: "sniper", label: "Sniper", description: "3 RDV pris en une seule journée", tone: "blue" },
  { key: "marathon", label: "Marathon", description: "150 appels sur une semaine", tone: "green" },
  { key: "serie-de-feu", label: "Série de feu", description: "10 jours ouvrés de série", tone: "red" },
  {
    key: "closer-du-mois",
    label: "Closer du mois",
    description: "Meilleur CA signé de l'équipe sur le mois",
    tone: "gold",
  },
  {
    key: "inbox-zero",
    label: "Inbox zéro",
    description: "0 mail non lu dans ta boîte de réception",
    tone: "teal",
  },
  { key: "legende", label: "Légende", description: "Atteins le niveau 5", tone: "violet" },
  {
    key: "grand-chelem",
    label: "Grand chelem",
    description: "4 jours ouvrés d'affilée avec les 3 objectifs du jour remplis",
    tone: "navy",
  },
];

/** @deprecated Plus de badges. */
export const BADGE_THRESHOLDS = {
  sniperRdvJour: 3,
  marathonAppelsSemaine: 150,
  serieDeFeuJours: 10,
  grandChelemJours: 4,
} as const;

/** @deprecated Plus de niveaux. */
export function levelFor(xp: number): LevelInfo {
  const total = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (total >= LEVELS[i].minXp) idx = i;
  }
  const cur = LEVELS[idx];
  const next = idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null;
  let pct = 100;
  if (next) {
    const span = next.minXp - cur.minXp;
    pct = Math.min(99, Math.max(0, Math.round(((total - cur.minXp) / span) * 100)));
  }
  return {
    level: cur.level,
    name: cur.name,
    xp: total,
    floorXp: cur.minXp,
    nextXp: next ? next.minXp : null,
    nextName: next ? next.name : null,
    pct,
    xpToNext: next ? next.minXp - total : null,
  };
}

/** @deprecated Plus d'XP. */
export function xpForCounters(c: DayCounters, signaturesMensuelChf: number): number {
  const mensuel = Math.max(0, Number.isFinite(signaturesMensuelChf) ? signaturesMensuelChf : 0);
  return (
    c.appels * XP_RULES.appel +
    c.conversations * XP_RULES.conversation +
    c.emails * XP_RULES.email +
    c.rdvPris * XP_RULES.rdvPris +
    c.rdvEffectues * XP_RULES.rdvEffectue +
    c.propositions * XP_RULES.proposition +
    c.signatures * XP_RULES.signature +
    Math.floor(mensuel / 10) * XP_RULES.signatureParTranche10ChfMensuel
  );
}

/** @deprecated Plus de combo au phoning. */
export function comboFor(consecutiveCalls: number): {
  mult: number;
  next: { minCalls: number; mult: number } | null;
} {
  const n = Math.max(0, Math.floor(Number.isFinite(consecutiveCalls) ? consecutiveCalls : 0));
  let idx = 0;
  for (let i = 0; i < COMBO_STEPS.length; i++) {
    if (n >= COMBO_STEPS[i].minCalls) idx = i;
  }
  const next = idx + 1 < COMBO_STEPS.length ? COMBO_STEPS[idx + 1] : null;
  return {
    mult: COMBO_STEPS[idx].mult,
    next: next ? { minCalls: next.minCalls, mult: next.mult } : null,
  };
}

/** @deprecated Utiliser `dailyGoalsFor` (même calcul, `xpReward` toujours 0). */
export function missionsFor(c: DayCounters, targets: DailyTargets): Mission[] {
  return dailyGoalsFor(c, targets).map((g) => ({ ...g, xpReward: 0 }));
}

/** @deprecated Plus d'XP. */
export function xpForDay(
  c: DayCounters,
  signaturesMensuelChf: number,
  targets: DailyTargets,
): number {
  const goalsDone = dailyGoalsFor(c, targets).filter((m) => m.done).length;
  return xpForCounters(c, signaturesMensuelChf) + goalsDone * XP_RULES.missionDuJour;
}
