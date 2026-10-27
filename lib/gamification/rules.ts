/**
 * MYC Arena - règles du jeu (constantes et fonctions PURES).
 *
 * Ce fichier ne dépend d'aucune ressource serveur (pas de prisma) : il est
 * importable depuis un composant client (kit du jeu, infobulles, combo
 * phoning...). Les requêtes vivent dans `engine.ts`.
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

export type LevelName = "Rookie" | "Hunter" | "Closer" | "Machine" | "Légende";

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

export interface DayCounters {
  appels: number;
  conversations: number;
  rdvPris: number;
  rdvEffectues: number;
  propositions: number;
  signatures: number;
  emails: number;
}

export interface Mission {
  key: "appels" | "rdvPris" | "propositions";
  label: string;
  current: number;
  target: number;
  pct: number;
  done: boolean;
  xpReward: number;
}

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

export interface PlayerHeader {
  userId: string;
  name: string;
  firstName: string;
  initials: string;
  level: LevelInfo;
  /** Score du jour (XP gagnés aujourd'hui, missions comprises). */
  xpToday: number;
  /** Série en cours (jours ouvrés consécutifs avec l'objectif d'appels atteint). */
  streak: number;
  /** Objectif d'appels du jour (Objective QUOTIDIEN actif, sinon 40). */
  dailyCallTarget: number;
}

export interface PlayerStats extends PlayerHeader {
  xpTotal: number;
  xpRecordDay: number;
  /** XP de la semaine ISO en cours (lundi → aujourd'hui). */
  xpWeek: number;
  xpRecordWeek: number;
  streakRecord: number;
  today: DayCounters;
  missions: Mission[];
  badges: BadgeState[];
  records: {
    bestDayXp: number;
    /** Jour du record, clé ISO « AAAA-MM-JJ » (fuseau Europe/Zurich), null si aucun XP. */
    bestDayDate: string | null;
    bestWeekXp: number;
    longestStreak: number;
    /** Plus grosse valeur mensuelle (CHF) d'un contrat signé. */
    biggestContractMensuel: number;
  };
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  initials: string;
  xp: number;
  rank: number;
  isMe: boolean;
}

/** Objectifs quotidiens servant aux missions du jour. */
export interface DailyTargets {
  appels: number;
  rdvPris: number;
  propositions: number;
}

// ---------------------------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------------------------

export const LEVELS: { level: 1 | 2 | 3 | 4 | 5; name: LevelName; minXp: number }[] = [
  { level: 1, name: "Rookie", minXp: 0 },
  // Paliers calibrés sur l'activité réelle (≈ 10-12k XP / mois pour une
  // commerciale à plein régime) : Légende se mérite en ~6-8 mois.
  { level: 2, name: "Hunter", minXp: 5000 },
  { level: 3, name: "Closer", minXp: 15000 },
  { level: 4, name: "Machine", minXp: 40000 },
  { level: 5, name: "Légende", minXp: 100000 },
];

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

/** Paliers du combo phoning (appels enchaînés à moins de COMBO_GAP_MINUTES). */
export const COMBO_STEPS: { minCalls: number; mult: number }[] = [
  { minCalls: 0, mult: 1 },
  { minCalls: 5, mult: 1.5 },
  { minCalls: 10, mult: 2 },
  { minCalls: 20, mult: 3 },
];

export const COMBO_GAP_MINUTES = 3;

export const DEFAULT_DAILY_TARGETS = { appels: 40, rdvPris: 3, propositions: 1 };

/** Définition des badges (ordre d'affichage). */
export const BADGE_DEFS: Omit<BadgeState, "earned">[] = [
  {
    key: "premier-sang",
    label: "Premier sang",
    description: "Signe ton premier contrat",
    tone: "coral",
  },
  {
    key: "sniper",
    label: "Sniper",
    description: "3 RDV pris en une seule journée",
    tone: "blue",
  },
  {
    key: "marathon",
    label: "Marathon",
    description: "150 appels sur une semaine",
    tone: "green",
  },
  {
    key: "serie-de-feu",
    label: "Série de feu",
    description: "10 jours ouvrés de série",
    tone: "red",
  },
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
  {
    key: "legende",
    label: "Légende",
    description: "Atteins le niveau 5",
    tone: "violet",
  },
  {
    key: "grand-chelem",
    label: "Grand chelem",
    description: "4 jours ouvrés d'affilée avec les 3 missions remplies",
    tone: "navy",
  },
];

/** Seuils des badges (utilisés par le moteur). */
export const BADGE_THRESHOLDS = {
  sniperRdvJour: 3,
  marathonAppelsSemaine: 150,
  serieDeFeuJours: 10,
  grandChelemJours: 4,
} as const;

// ---------------------------------------------------------------------------
// FONCTIONS PURES
// ---------------------------------------------------------------------------

/** Niveau correspondant à un total d'XP. */
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
    // Arrondi, mais jamais 100 % tant que le palier n'est pas franchi.
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

/**
 * XP « brut » rapporté par des compteurs (hors bonus de missions).
 * Un appel décroché rapporte l'XP d'appel + le bonus conversation ;
 * un contrat signé rapporte 200 XP + 1 XP par tranche de 10 CHF mensuels
 * (`signaturesMensuelChf` = somme des montants mensuels des contrats signés).
 */
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

/** Multiplicateur du combo pour un nombre d'appels enchaînés. */
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

function plural(n: number, singular: string, pluralForm: string): string {
  return n > 1 ? pluralForm : singular;
}

/** Les 3 missions du jour à partir des compteurs et des objectifs quotidiens. */
export function missionsFor(c: DayCounters, targets: DailyTargets): Mission[] {
  const build = (
    key: Mission["key"],
    label: string,
    current: number,
    target: number,
  ): Mission => {
    const t = Math.max(1, target);
    const done = current >= t;
    return {
      key,
      label,
      current,
      target: t,
      // Comme levelFor : jamais 100 % tant que la mission n'est pas remplie
      // (ex. 249 / 250 arrondi à 100 % alors que le bonus n'est pas acquis).
      pct: done ? 100 : Math.min(99, Math.max(0, Math.round((current / t) * 100))),
      done,
      xpReward: XP_RULES.missionDuJour,
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

/** XP d'une journée complète : actions + bonus des missions remplies. */
export function xpForDay(
  c: DayCounters,
  signaturesMensuelChf: number,
  targets: DailyTargets,
): number {
  const missionsDone = missionsFor(c, targets).filter((m) => m.done).length;
  return xpForCounters(c, signaturesMensuelChf) + missionsDone * XP_RULES.missionDuJour;
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
