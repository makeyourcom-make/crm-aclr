/**
 * Dates de la rubrique Entreprises au format de la charte MYC Arena
 * (« 28.10.2026 », « 28.10 », « 09:30 »), TOUJOURS en fuseau Europe/Zurich.
 *
 * Pourquoi pas `formatDate` de lib/format ? Il formate dans le fuseau du
 * runtime (UTC sur le serveur Vercel, local dans le navigateur) et en
 * « 28/10/2026 ». Ici le fuseau est explicite : le rendu serveur et
 * l'hydratation client produisent exactement le même texte.
 *
 * Fonctions pures, client-safe.
 */

const TZ = "Europe/Zurich";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const weekdayFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  weekday: "long",
});

const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

export type DateInput = Date | string | number | null | undefined;

export function toDate(d: DateInput): Date | null {
  if (d === null || d === undefined || d === "") return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Clé « AAAA-MM-JJ » du jour (vu de Suisse). */
export function zurichDayKey(d: DateInput): string {
  const date = toDate(d);
  return date ? dayKeyFmt.format(date) : "";
}

function keyParts(key: string): [string, string, string] {
  const [y = "", m = "", day = ""] = key.split("-");
  return [y, m, day];
}

/** « 28.10.2026 » (chaîne vide si date absente). */
export function fmtDate(d: DateInput): string {
  const key = zurichDayKey(d);
  if (!key) return "";
  const [y, m, day] = keyParts(key);
  return `${day}.${m}.${y}`;
}

/** « 28.10 » */
export function fmtDayMonth(d: DateInput): string {
  const key = zurichDayKey(d);
  if (!key) return "";
  const [, m, day] = keyParts(key);
  return `${day}.${m}`;
}

/** « 09:30 » */
export function fmtTime(d: DateInput): string {
  const date = toDate(d);
  return date ? timeFmt.format(date) : "";
}

/** « 28.10 · 09:30 » */
export function fmtDayTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "";
  return `${fmtDayMonth(date)} · ${fmtTime(date)}`;
}

/** « mardi » */
export function fmtWeekday(d: DateInput): string {
  const date = toDate(d);
  return date ? weekdayFmt.format(date) : "";
}

function keyToUtcMs(key: string): number {
  const [y, m, day] = keyParts(key).map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
}

/**
 * Écart en JOURS CALENDAIRES (Zurich) entre `d` et `now` :
 * 0 = aujourd'hui, 1 = hier, -1 = demain. null si date absente.
 */
export function calendarDaysAgo(d: DateInput, nowMs: number): number | null {
  const date = toDate(d);
  if (!date) return null;
  const a = keyToUtcMs(zurichDayKey(date));
  const b = keyToUtcMs(zurichDayKey(nowMs));
  return Math.round((b - a) / 86_400_000);
}

/** « aujourd'hui » · « hier » · « il y a 5 j » · « demain » · « dans 3 j ». */
export function relativeDayLabel(d: DateInput, nowMs: number): string {
  const n = calendarDaysAgo(d, nowMs);
  if (n === null) return "";
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "hier";
  if (n === -1) return "demain";
  if (n > 1) return `il y a ${n} j`;
  return `dans ${-n} j`;
}

/**
 * Début (instant UTC) du jour Zurich contenant `nowMs`, décalé de `offsetDays`.
 * Sert aux fenêtres « aujourd'hui », « demain », « ce mois ».
 */
export function zurichStartOfDay(nowMs: number, offsetDays = 0): Date {
  const key = zurichDayKey(nowMs);
  const base = keyToUtcMs(key) + offsetDays * 86_400_000;
  // Minuit Zurich = minuit UTC moins le décalage (1 h l'hiver, 2 h l'été) :
  // l'heure affichée à Zurich à minuit UTC donne exactement ce décalage
  // (y compris les jours de changement d'heure, qui basculent à 01:00 UTC).
  const hourPart = hourFmt
    .formatToParts(new Date(base))
    .find((p) => p.type === "hour");
  const offsetH = Number(hourPart?.value ?? 0) % 24;
  return new Date(base - offsetH * 3_600_000);
}

/** Premier jour du mois Zurich contenant `nowMs` (instant UTC de minuit). */
export function zurichStartOfMonth(nowMs: number): Date {
  const key = zurichDayKey(nowMs);
  const [, , day] = keyParts(key);
  return zurichStartOfDay(nowMs, -(Number(day) - 1));
}

const MONTHS = [
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

/** « octobre » (mois Zurich de `nowMs`). */
export function zurichMonthName(nowMs: number): string {
  const [, m] = keyParts(zurichDayKey(nowMs));
  return MONTHS[Number(m) - 1] ?? "";
}
