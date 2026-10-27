/**
 * Agenda - helpers de dates en fuseau Europe/Zurich (PURS, client-safe).
 *
 * Les dates sont stockées en UTC ; le serveur tourne en UTC et le navigateur
 * en Europe/Zurich. Pour que le rendu serveur et l'hydratation donnent
 * exactement le même résultat (et que la semaine commence bien le lundi à
 * minuit en Suisse), tout le découpage en jours / heures passe par ces
 * helpers, jamais par getHours() / setHours() du fuseau local.
 *
 * Un « jour » est une clé « AAAA-MM-JJ ». L'arithmétique sur les clés se fait
 * en minuit UTC (convention de lib/planning/dates.ts).
 */

export const AGENDA_TZ = "Europe/Zurich";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENDA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: AGENDA_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type DateLike = Date | string | number;

function toDate(d: DateLike): Date {
  return d instanceof Date ? d : new Date(d);
}

interface ZParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zParts(d: DateLike): ZParts {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(toDate(d))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour % 24,
    minute: p.minute,
    second: p.second,
  };
}

/** Clé « AAAA-MM-JJ » du jour (vu de Suisse) contenant l'instant `d`. */
export function zDayKey(d: DateLike): string {
  return dayKeyFmt.format(toDate(d));
}

/** Minutes écoulées depuis minuit (heure suisse) à l'instant `d`. */
export function zMinutes(d: DateLike): number {
  const p = zParts(d);
  return p.hour * 60 + p.minute;
}

/** « 09:30 » (heure suisse). */
export function zTime(d: DateLike): string {
  const p = zParts(d);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** « 09:30 » depuis un nombre de minutes depuis minuit. */
export function minutesToHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Clé de jour → minuit UTC (pour l'arithmétique de jours). */
export function keyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** Minuit UTC → clé de jour. */
export function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isDayKey(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = keyToUtc(s);
  return !Number.isNaN(d.getTime()) && utcToKey(d) === s;
}

export function addDaysKey(key: string, n: number): string {
  return utcToKey(new Date(keyToUtc(key).getTime() + n * 86_400_000));
}

/** Premier jour du mois décalé de `n` mois (clé « AAAA-MM-01 »). */
export function addMonthsKey(key: string, n: number): string {
  const d = keyToUtc(key);
  return utcToKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** Jour de la semaine d'une clé (0 = dimanche … 6 = samedi). */
export function dowOfKey(key: string): number {
  return keyToUtc(key).getUTCDay();
}

/** Lundi de la semaine (ISO) contenant le jour `key`. */
export function mondayOfKey(key: string): string {
  const dow = dowOfKey(key) || 7;
  return addDaysKey(key, -(dow - 1));
}

/** Premier jour du mois de `key`. */
export function monthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** « AAAA-MM » */
export function monthOfKey(key: string): string {
  return key.slice(0, 7);
}

/** Différence en jours entre deux clés (b - a). */
export function diffDaysKey(a: string, b: string): number {
  return Math.round((keyToUtc(b).getTime() - keyToUtc(a).getTime()) / 86_400_000);
}

/** Décalage (ms) entre l'heure de Zurich et UTC à l'instant `at`. */
function zurichOffsetMs(at: Date): number {
  const p = zParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant UTC correspondant à `key` à `minutes` après minuit, heure suisse. */
export function zInstant(key: string, minutes = 0): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

/** Instant UTC du minuit suisse du jour `key`. */
export function zStartOfDay(key: string): Date {
  return zInstant(key, 0);
}

/** Numéro de semaine ISO du jour `key`. */
export function isoWeekNumber(key: string): number {
  const d = keyToUtc(key);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// LIBELLÉS FRANÇAIS (format suisse 27.10.2026)
// ---------------------------------------------------------------------------

export const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const JOURS_ABBR = ["DIM.", "LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM."];
export const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const MOIS = [
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

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 27.10 » */
export function formatKeyShort(key: string): string {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
}

/** « 27.10.2026 » */
export function formatKeyDate(key: string): string {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;
}

/** « Mardi 27.10.2026 » */
export function formatKeyLong(key: string): string {
  return `${capitalize(JOURS[dowOfKey(key)])} ${formatKeyDate(key)}`;
}

/** « octobre 2026 » */
export function formatMonth(key: string): string {
  const d = keyToUtc(key);
  return `${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** « Aujourd'hui », « Demain », « Hier » ou « Jeudi 29.10 ». */
export function relativeDayLabel(key: string, todayKey: string): string {
  const diff = diffDaysKey(todayKey, key);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return `${capitalize(JOURS[dowOfKey(key)])} ${formatKeyShort(key)}`;
}

/** Compte à rebours lisible : « dans 45 min », « dans 2 h 05 », « dans 3 j 4 h ». */
export function countdownLabel(targetMs: number, nowMs: number): string {
  const diff = Math.round((targetMs - nowMs) / 60_000);
  const abs = Math.abs(diff);
  let txt: string;
  if (abs < 60) txt = `${abs} min`;
  else if (abs < 24 * 60) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    txt = m === 0 ? `${h} h` : `${h} h ${pad2(m)}`;
  } else {
    const days = Math.floor(abs / (24 * 60));
    const h = Math.floor((abs % (24 * 60)) / 60);
    txt = h === 0 ? `${days} j` : `${days} j ${h} h`;
  }
  return diff >= 0 ? `dans ${txt}` : `il y a ${txt}`;
}
