/**
 * Dates du Dashboard, toujours vues de Suisse (Europe/Zurich), au format de
 * la charte MYC Arena : « 27.10.2026 », « 15:40 », « Mar 27.10 ».
 *
 * Pur (aucune dépendance serveur) : importable côté client comme côté serveur.
 * Les dates sont stockées en UTC : sans fuseau explicite, un serveur en UTC
 * afficherait 12:00 pour un RDV à 13:00.
 */

const TZ = "Europe/Zurich";

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const WEEKDAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const MONTHS = [
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

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface ZParts {
  y: number;
  m: number; // 1-12
  d: number;
  hh: string;
  mm: string;
  /** 0 = dimanche */
  wd: number;
  key: string;
}

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

function zParts(input: Date | string): ZParts {
  const date = toDate(input);
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  const y = Number(p.year);
  const m = Number(p.month);
  const d = Number(p.day);
  const hh = String(Number(p.hour) % 24).padStart(2, "0");
  return {
    y,
    m,
    d,
    hh,
    mm: p.minute ?? "00",
    wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    key: `${p.year}-${p.month}-${p.day}`,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Clé « AAAA-MM-JJ » du jour (Zurich). */
export function zDayKey(d: Date | string): string {
  return zParts(d).key;
}

/** « 27.10.2026 » */
export function zDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const p = zParts(d);
  return `${pad(p.d)}.${pad(p.m)}.${p.y}`;
}

/** « 27.10 » */
export function zDateShort(d: Date | string): string {
  const p = zParts(d);
  return `${pad(p.d)}.${pad(p.m)}`;
}

/** « 15:40 » */
export function zTime(d: Date | string): string {
  const p = zParts(d);
  return `${p.hh}:${p.mm}`;
}

/** « Mar » */
export function zWeekdayShort(d: Date | string): string {
  return WEEKDAYS_SHORT[zParts(d).wd] ?? "";
}

/** « mardi » */
export function zWeekdayLong(d: Date | string): string {
  return WEEKDAYS[zParts(d).wd] ?? "";
}

/** « Mardi 27.10.2026 » */
export function zDateLong(d: Date | string): string {
  const w = zWeekdayLong(d);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${zDate(d)}`;
}

/** « Octobre 2026 » */
export function zMonthLabel(d: Date | string): string {
  const p = zParts(d);
  const name = MONTHS[p.m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${p.y}`;
}

/** Nom de jour d'une clé « AAAA-MM-JJ » (« vendredi »). */
export function weekdayOfKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

/** Écart en jours calendaires entre deux clés « AAAA-MM-JJ » (b - a). */
function keyDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Jour relatif : « Aujourd'hui », « Hier », « Demain », sinon « Mar 27.10 ».
 * `todayKey` = clé Zurich du jour (calculée une fois côté serveur).
 */
export function relativeDay(d: Date | string, todayKey: string): string {
  const key = zDayKey(d);
  const diff = keyDiff(todayKey, key);
  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return "Hier";
  if (diff === 1) return "Demain";
  return `${zWeekdayShort(d)} ${zDateShort(d)}`;
}

/** Nombre de jours entre aujourd'hui et `d` (0 = aujourd'hui, 1 = demain…). */
export function daysFromToday(d: Date | string, todayKey: string): number {
  return keyDiff(todayKey, zDayKey(d));
}
