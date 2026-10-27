/**
 * Requête principale de « Ma journée » (/aujourd-hui).
 *
 * Renvoie tout ce qu'il faut pour la page en une passe (requêtes en parallèle) :
 *   - la feuille de route du jour triée par urgence : retards en tête (jours
 *     précédents + créneaux du jour déjà passés), puis maintenant, ce matin,
 *     cet après-midi, ce soir ; et l'aperçu de demain (5 premiers items)
 *   - les RDV passés à valider (effectué / manqué / annulé)
 *   - les relances : contrats envoyés, toujours en attente de signature
 *   - la charge de la semaine (actions par jour ouvré) et les compteurs de la
 *     semaine + ceux du jour ouvré précédent à la même heure (moteur de jeu,
 *     mêmes définitions que la topbar)
 *   - l'objectif QUOTIDIEN actif (cibles emails / RDV / signatures)
 *
 * Toutes les heures et tous les jours sont calculés en fuseau Europe/Zurich
 * (les dates sont stockées en UTC et le serveur tourne en UTC) : on passe au
 * client des libellés déjà formatés, jamais une heure à recalculer.
 *
 * Les compteurs et missions du JOUR viennent de getPlayerStats() (page).
 */
import type { ActivityResultat, ActivityStatut, ActivityType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getDayCounters } from "@/lib/gamification";
import { XP_RULES, type DayCounters } from "@/lib/gamification/rules";
import { addDays, isWorkingDay } from "@/lib/planning/dates";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// FUSEAU EUROPE/ZURICH
// ---------------------------------------------------------------------------

const TZ = "Europe/Zurich";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface ZParts {
  /** Clé de jour « AAAA-MM-JJ ». */
  key: string;
  y: number;
  m: number;
  d: number;
  hour: number;
  minute: number;
  second: number;
}

function zParts(date: Date): ZParts {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    key: `${p.year}-${p.month}-${p.day}`,
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Décalage (ms) entre l'heure de Zurich et UTC à l'instant `at`. */
function zOffsetMs(at: Date): number {
  const p = zParts(at);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Clé de jour → minuit UTC (convention de lib/planning/dates.ts). */
function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysToKey(key: string, n: number): string {
  return addDays(keyToUtcDate(key), n).toISOString().slice(0, 10);
}

/** Instant UTC de minuit (heure de Zurich) du jour `key`. */
function zStartOfDay(key: string): Date {
  const guess = keyToUtcDate(key).getTime();
  const first = guess - zOffsetMs(new Date(guess));
  return new Date(guess - zOffsetMs(new Date(first)));
}

/** Écart en jours calendaires (Zurich) entre deux clés. */
function daysBetweenKeys(from: string, to: string): number {
  return Math.round((keyToUtcDate(to).getTime() - keyToUtcDate(from).getTime()) / DAY_MS);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** « 09:30 » (heure de Zurich). */
export function zurichTime(date: Date): string {
  const p = zParts(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** « 27.10 » (Zurich). */
function zurichDayMonth(date: Date): string {
  const p = zParts(date);
  return `${pad2(p.d)}.${pad2(p.m)}`;
}

/** « 27.10.2026 » (Zurich). */
function zurichDate(date: Date): string {
  const p = zParts(date);
  return `${pad2(p.d)}.${pad2(p.m)}.${p.y}`;
}

const WEEKDAY_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const WEEKDAY_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const WEEKDAY_ABBR = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
const WEEKDAY_CAP3 = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_LONG = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const weekdayOfKey = (key: string) => keyToUtcDate(key).getUTCDay();

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type TaskKind = "call" | "email" | "rdv" | "other";

/** Une action de la feuille de route (déjà formatée pour l'affichage). */
export interface TodayTask {
  id: string;
  type: ActivityType;
  statut: ActivityStatut;
  kind: TaskKind;
  /** Heure prévue « 09:30 » (Zurich). */
  heure: string;
  /** Jour prévu « 27.10 » (Zurich). */
  jour: string;
  sujet: string;
  prospect: {
    id: string;
    raisonSociale: string;
    ville: string | null;
    /** Mobile en priorité, sinon fixe (comme avant). */
    telephone: string | null;
  } | null;
  /** Résultat de l'appel qui a généré ce rappel (chaîne de relances). */
  dernierResultat: ActivityResultat | null;
  dernierNote: string | null;
  /** Retard : null si l'action est à l'heure. */
  retard: { label: string; veille: boolean } | null;
  /** RDV client dont l'heure est passée (à valider). */
  rdvPasse: boolean;
  /** RDV encore à venir : le serveur refuse « fait » avant l'heure. */
  rdvFutur: boolean;
  /** XP rapportés si l'action est marquée faite (barème du moteur). */
  xp: number;
}

export interface TodaySections {
  /** Jours précédents + créneaux du jour déjà passés, toujours pas FAIT. */
  enRetard: TodayTask[];
  /** Prévu dans l'heure courante. */
  maintenant: TodayTask[];
  /** Reste de la matinée (avant 12 h). */
  ceMatin: TodayTask[];
  /** 12 h - 18 h. */
  cetApresMidi: TodayTask[];
  /** Après 18 h. */
  ceSoir: TodayTask[];
  /** Aperçu des 5 premiers items de demain. */
  demain: TodayTask[];
}

export interface RdvAValiderItem {
  id: string;
  type: ActivityType;
  heure: string;
  /** « Mar » */
  jourAbbr: string;
  /** « 27 » */
  jourNum: string;
  /** « aujourd'hui » / « hier » / « lun. 26.10 » */
  quand: string;
  isToday: boolean;
  sujet: string;
  prospectId: string;
  raisonSociale: string;
  ville: string | null;
  adresse: string | null;
}

export interface RelanceItem {
  id: string;
  numero: string;
  prospectId: string;
  raisonSociale: string;
  ville: string | null;
  telephone: string | null;
  offre: string | null;
  montantOneShot: number;
  montantMensuel: number;
  devise: string;
  /** « 19.10.2026 » */
  envoyeeLe: string;
  /** Jours écoulés depuis l'envoi. */
  jours: number;
}

export interface WeekDayLoad {
  key: string;
  /** « Lu » */
  abbr: string;
  /** « lundi 26.10 » */
  label: string;
  n: number;
  isToday: boolean;
  isPast: boolean;
  isWorking: boolean;
}

export interface TodayCockpit {
  now: {
    ms: number;
    heure: string;
    /** « mardi » */
    jour: string;
    /** « 27.10.2026 » */
    date: string;
    /** « Mardi 27 octobre » */
    titre: string;
    todayKey: string;
    isWorkingDay: boolean;
  };
  sections: TodaySections;
  rdvAValider: RdvAValiderItem[];
  relances: { items: RelanceItem[]; total: number };
  semaine: {
    /** « lun. 26.10 - dim. 01.11 » */
    label: string;
    jours: WeekDayLoad[];
    /** Jours ouvrés de la semaine (lun-ven hors fériés VS). */
    joursOuvres: number;
    /** Jours ouvrés écoulés, aujourd'hui compris. */
    joursOuvresEcoules: number;
    /** Compteurs de la semaine (moteur), null si le moteur échoue. */
    compteurs: DayCounters | null;
  };
  /** Compteurs du jour ouvré précédent à la même heure (moteur). */
  veille: { label: string; compteurs: DayCounters } | null;
  /** Heure du premier appel du jour (rythme), en ms. */
  premierAppelMs: number | null;
  /** Objectif QUOTIDIEN actif (null = pas d'objectif, défauts). */
  objectif: {
    emails: number | null;
    rdv: number | null;
    signatures: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// MAPPING
// ---------------------------------------------------------------------------

const RDV_TYPES: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];

function kindOf(type: ActivityType): TaskKind {
  if (type === "APPEL_SORTANT" || type === "APPEL_ENTRANT") return "call";
  if (type === "EMAIL_ENVOYE") return "email";
  if (RDV_TYPES.includes(type)) return "rdv";
  return "other";
}

/** XP gagnés en marquant l'action faite (mêmes règles que le moteur). */
function xpWhenDone(type: ActivityType, statut: ActivityStatut, hasProspect: boolean): number {
  // Un appel EN_COURS est déjà compté par le moteur : le clore ne rapporte rien.
  if (type === "APPEL_SORTANT") return statut === "PLANIFIE" ? XP_RULES.appel : 0;
  if (type === "EMAIL_ENVOYE") return XP_RULES.email;
  if (RDV_TYPES.includes(type) && hasProspect) return XP_RULES.rdvEffectue;
  return 0;
}

const includeTask = {
  prospect: {
    select: {
      id: true,
      raisonSociale: true,
      telephone: true,
      telephoneMobile: true,
      ville: true,
    },
  },
  rappelLeDe: { select: { resultat: true, notesResultat: true } },
} as const;

interface RawTask {
  id: string;
  type: ActivityType;
  statut: ActivityStatut;
  date: Date;
  sujet: string;
  prospect: {
    id: string;
    raisonSociale: string;
    telephone: string | null;
    telephoneMobile: string | null;
    ville: string | null;
  } | null;
  rappelLeDe: { resultat: ActivityResultat | null; notesResultat: string | null } | null;
}

/**
 * Texte saisi (sujets, notes, noms d'entreprises et de villes, noms d'offres
 * du catalogue) : les grands tirets deviennent le petit tiret « - » (règle
 * d'affichage d'Arthur ; des fiches importées en contiennent).
 */
function clean(text: string): string;
function clean(text: string | null | undefined): string | null;
function clean(text: string | null | undefined): string | null {
  if (text == null) return null;
  return text.replace(/\s*[\u2013\u2014]\s*/g, " - ").trim();
}

function retardLabel(date: Date, now: Date, todayKey: string): { label: string; veille: boolean } {
  const key = zParts(date).key;
  if (key < todayKey) {
    const n = daysBetweenKeys(key, todayKey);
    if (n <= 1) return { label: "depuis hier", veille: true };
    if (n < 7) return { label: `depuis ${n} jours`, veille: true };
    return { label: `depuis le ${zurichDayMonth(date)}`, veille: true };
  }
  const min = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (min < 60) return { label: `depuis ${min} min`, veille: false };
  return { label: `depuis ${Math.floor(min / 60)} h`, veille: false };
}

/**
 * `late` : l'action est dans le bloc « En retard ».
 * `tomorrow` : aperçu de demain ; marquée faite d'avance, elle compte au jour
 * prévu (demain) : on n'annonce pas d'XP aujourd'hui.
 */
function toTask(
  a: RawTask,
  now: Date,
  todayKey: string,
  late: boolean,
  tomorrow = false,
): TodayTask {
  const kind = kindOf(a.type);
  const isRdvClient = kind === "rdv" && !!a.prospect;
  const passed = a.date.getTime() <= now.getTime();
  return {
    id: a.id,
    type: a.type,
    statut: a.statut,
    kind,
    heure: zurichTime(a.date),
    jour: zurichDayMonth(a.date),
    sujet: clean(a.sujet),
    prospect: a.prospect
      ? {
          id: a.prospect.id,
          raisonSociale: clean(a.prospect.raisonSociale),
          ville: clean(a.prospect.ville),
          telephone: a.prospect.telephoneMobile ?? a.prospect.telephone ?? null,
        }
      : null,
    dernierResultat: a.rappelLeDe?.resultat ?? null,
    dernierNote: clean(a.rappelLeDe?.notesResultat?.trim() || null),
    retard: late ? retardLabel(a.date, now, todayKey) : null,
    rdvPasse: isRdvClient && passed,
    rdvFutur: kind === "rdv" && !passed,
    xp: tomorrow ? 0 : xpWhenDone(a.type, a.statut, !!a.prospect),
  };
}

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// IMPLÉMENTATION
// ---------------------------------------------------------------------------

export async function getTodayCockpit(user: SessionUser): Promise<TodayCockpit> {
  const now = new Date();
  const np = zParts(now);
  const todayKey = np.key;
  const startOfToday = zStartOfDay(todayKey);
  const startOfTomorrow = zStartOfDay(addDaysToKey(todayKey, 1));
  const startOfAfterTomorrow = zStartOfDay(addDaysToKey(todayKey, 2));
  // Les fuseaux de Zurich sont décalés d'heures pleines : le début de l'heure
  // locale est le début de l'heure UTC.
  const startOfHour = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);

  // Semaine ISO (lundi → dimanche), en jours de Zurich.
  const weekday = weekdayOfKey(todayKey) || 7;
  const mondayKey = addDaysToKey(todayKey, -(weekday - 1));
  const sundayKey = addDaysToKey(mondayKey, 6);
  const weekStart = zStartOfDay(mondayKey);
  const nextMonday = zStartOfDay(addDaysToKey(mondayKey, 7));

  // Jour ouvré précédent (comparaison « vs hier à la même heure »).
  let prevKey = addDaysToKey(todayKey, -1);
  for (let i = 0; i < 10 && !isWorkingDay(keyToUtcDate(prevKey)); i++) {
    prevKey = addDaysToKey(prevKey, -1);
  }
  const prevStart = zStartOfDay(prevKey);
  const prevSameTime = new Date(prevStart.getTime() + (now.getTime() - startOfToday.getTime()));
  const prevLabel =
    prevKey === addDaysToKey(todayKey, -1) ? "hier" : WEEKDAY_LONG[weekdayOfKey(prevKey)];

  // Scope row-level : commercial ne voit que ses propres activités.
  const scopeWhere = user.role === "ADMIN" ? {} : { userId: user.id };

  const safeCounters = (p: Promise<DayCounters>) =>
    p.catch((err) => {
      console.error("[aujourd-hui] compteurs du moteur indisponibles :", err);
      return null;
    });

  const [
    todayPlanned,
    overdue,
    tomorrow,
    rdvRows,
    relanceRows,
    relancesTotal,
    weekRows,
    premierAppel,
    objQuotidien,
    weekCounters,
    prevCounters,
  ] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...scopeWhere,
        date: { gte: startOfToday, lt: startOfTomorrow },
        statut: { in: ["PLANIFIE", "EN_COURS"] },
      },
      include: includeTask,
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        ...scopeWhere,
        date: { lt: startOfToday },
        statut: { in: ["PLANIFIE", "EN_COURS"] },
      },
      include: includeTask,
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        ...scopeWhere,
        date: { gte: startOfTomorrow, lt: startOfAfterTomorrow },
        statut: "PLANIFIE",
      },
      include: includeTask,
      orderBy: { date: "asc" },
      take: 5,
    }),
    // RDV client dont l'heure est passée, pas encore validés (14 derniers
    // jours, même périmètre que le rappel du dashboard, sans attendre 17 h).
    prisma.activity.findMany({
      where: {
        userId: user.id,
        type: { in: RDV_TYPES },
        prospectId: { not: null },
        statut: { in: ["PLANIFIE", "EN_COURS", "REPLANIFIE"] },
        date: { gte: new Date(now.getTime() - 14 * DAY_MS), lte: now },
      },
      select: {
        id: true,
        type: true,
        date: true,
        sujet: true,
        adresseRdv: true,
        prospect: { select: { id: true, raisonSociale: true, ville: true } },
      },
      orderBy: { date: "asc" },
    }),
    // Relances : contrats envoyés à la signature, toujours sans signature.
    prisma.contract.findMany({
      where: { assigneAId: user.id, statut: "ATTENTE_SIGNATURE_CLIENT" },
      select: {
        id: true,
        numero: true,
        createdAt: true,
        devise: true,
        montantOneShot: true,
        montantMensuel: true,
        prospect: {
          select: {
            id: true,
            raisonSociale: true,
            ville: true,
            telephone: true,
            telephoneMobile: true,
          },
        },
        products: { select: { nom: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.contract.count({
      where: { assigneAId: user.id, statut: "ATTENTE_SIGNATURE_CLIENT" },
    }),
    // Charge de la semaine : toutes les actions (hors annulées) par jour.
    prisma.activity.findMany({
      where: {
        userId: user.id,
        date: { gte: weekStart, lt: nextMonday },
        statut: { not: "ANNULE" },
      },
      select: { date: true },
    }),
    prisma.activity.findFirst({
      where: {
        userId: user.id,
        type: "APPEL_SORTANT",
        statut: { in: ["FAIT", "EN_COURS"] },
        date: { gte: startOfToday, lte: now },
      },
      select: { date: true },
      orderBy: { date: "asc" },
    }),
    prisma.objective.findFirst({
      where: {
        userId: user.id,
        periode: "QUOTIDIEN",
        isActif: true,
        dateDebut: { lte: now },
        dateFin: { gte: now },
      },
      orderBy: { dateFin: "desc" },
      select: {
        nbEmailsObjectif: true,
        nbRdvObjectif: true,
        nbSignaturesObjectif: true,
      },
    }),
    safeCounters(getDayCounters(user.id, weekStart, now)),
    safeCounters(getDayCounters(user.id, prevStart, prevSameTime)),
  ]);

  // ---- Feuille de route : retards en tête, puis créneaux du jour ----
  const enRetard: TodayTask[] = overdue.map((a) => toTask(a, now, todayKey, true));
  const maintenant: TodayTask[] = [];
  const ceMatin: TodayTask[] = [];
  const cetApresMidi: TodayTask[] = [];
  const ceSoir: TodayTask[] = [];

  for (const a of todayPlanned) {
    const h = zParts(a.date).hour;
    if (a.date.getTime() < startOfHour.getTime()) {
      // Créneau du jour déjà passé : remonte dans les retards.
      enRetard.push(toTask(a, now, todayKey, true));
    } else if (h === np.hour) {
      maintenant.push(toTask(a, now, todayKey, false));
    } else if (h < 12) {
      ceMatin.push(toTask(a, now, todayKey, false));
    } else if (h < 18) {
      cetApresMidi.push(toTask(a, now, todayKey, false));
    } else {
      ceSoir.push(toTask(a, now, todayKey, false));
    }
  }

  // ---- RDV à valider ----
  const yesterdayKey = addDaysToKey(todayKey, -1);
  const rdvAValider: RdvAValiderItem[] = rdvRows
    .filter((r) => r.prospect)
    .map((r) => {
      const key = zParts(r.date).key;
      const wd = weekdayOfKey(key);
      return {
        id: r.id,
        type: r.type,
        heure: zurichTime(r.date),
        jourAbbr: WEEKDAY_CAP3[wd],
        jourNum: String(zParts(r.date).d),
        quand:
          key === todayKey
            ? "aujourd'hui"
            : key === yesterdayKey
              ? "hier"
              : `${WEEKDAY_SHORT[wd]} ${zurichDayMonth(r.date)}`,
        isToday: key === todayKey,
        sujet: clean(r.sujet),
        prospectId: r.prospect!.id,
        raisonSociale: clean(r.prospect!.raisonSociale),
        ville: clean(r.prospect!.ville),
        adresse: clean(r.adresseRdv),
      };
    });

  // ---- Relances ----
  const relances: RelanceItem[] = relanceRows.map((c) => {
    const noms = c.products.map((p) => p.nom).filter(Boolean);
    return {
      id: c.id,
      numero: c.numero,
      prospectId: c.prospect.id,
      raisonSociale: clean(c.prospect.raisonSociale),
      ville: clean(c.prospect.ville),
      telephone: c.prospect.telephoneMobile ?? c.prospect.telephone ?? null,
      offre: noms.length > 0 ? clean(noms.join(" + ")) : null,
      montantOneShot: toNumber(c.montantOneShot),
      montantMensuel: toNumber(c.montantMensuel),
      devise: c.devise,
      envoyeeLe: zurichDate(c.createdAt),
      jours: Math.max(0, daysBetweenKeys(zParts(c.createdAt).key, todayKey)),
    };
  });

  // ---- Charge de la semaine (lun-ven) ----
  const perDay = new Map<string, number>();
  for (const r of weekRows) {
    const k = zParts(r.date).key;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const jours: WeekDayLoad[] = [];
  let joursOuvres = 0;
  let joursOuvresEcoules = 0;
  for (let i = 0; i < 5; i++) {
    const key = addDaysToKey(mondayKey, i);
    const working = isWorkingDay(keyToUtcDate(key));
    if (working) {
      joursOuvres += 1;
      if (key <= todayKey) joursOuvresEcoules += 1;
    }
    const wd = weekdayOfKey(key);
    jours.push({
      key,
      abbr: WEEKDAY_ABBR[wd],
      label: `${WEEKDAY_LONG[wd]} ${key.slice(8, 10)}.${key.slice(5, 7)}`,
      n: perDay.get(key) ?? 0,
      isToday: key === todayKey,
      isPast: key < todayKey,
      isWorking: working,
    });
  }

  const titreJour = WEEKDAY_LONG[weekdayOfKey(todayKey)];

  return {
    now: {
      ms: now.getTime(),
      heure: zurichTime(now),
      jour: titreJour,
      date: zurichDate(now),
      titre: `${titreJour.charAt(0).toUpperCase()}${titreJour.slice(1)} ${np.d} ${MONTH_LONG[np.m - 1]}`,
      todayKey,
      isWorkingDay: isWorkingDay(keyToUtcDate(todayKey)),
    },
    sections: {
      enRetard,
      maintenant,
      ceMatin,
      cetApresMidi,
      ceSoir,
      demain: tomorrow.map((a) => toTask(a, now, todayKey, false, true)),
    },
    rdvAValider,
    relances: { items: relances, total: relancesTotal },
    semaine: {
      label: `${WEEKDAY_SHORT[1]} ${mondayKey.slice(8, 10)}.${mondayKey.slice(5, 7)} - ${WEEKDAY_SHORT[0]} ${sundayKey.slice(8, 10)}.${sundayKey.slice(5, 7)}`,
      jours,
      joursOuvres,
      joursOuvresEcoules,
      compteurs: weekCounters,
    },
    veille: prevCounters ? { label: prevLabel, compteurs: prevCounters } : null,
    premierAppelMs: premierAppel ? premierAppel.date.getTime() : null,
    objectif: objQuotidien
      ? {
          emails: objQuotidien.nbEmailsObjectif,
          rdv: objQuotidien.nbRdvObjectif,
          signatures: objQuotidien.nbSignaturesObjectif,
        }
      : null,
  };
}
