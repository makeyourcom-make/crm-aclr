/**
 * Formats de date / heure (charte : « 27.10.2026 », « 13:00 »),
 * TOUJOURS en fuseau Europe/Zurich : le serveur (Vercel) tourne en UTC, le
 * navigateur en heure suisse ; un fuseau explicite donne le même texte des
 * deux côtés (pas de décalage d'hydratation, pas d'heure fausse de 1-2 h).
 *
 * Server-safe et client-safe (Intl uniquement).
 */
const TZ = "Europe/Zurich";

const dateFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayShortFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  weekday: "short",
});
const weekdayLongFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  weekday: "long",
});
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined) return null;
  const v = d instanceof Date ? d : new Date(d);
  return Number.isNaN(v.getTime()) ? null : v;
}

/** « 27.10.2026 » */
export function zDate(d: Date | string | number | null | undefined): string {
  const v = toDate(d);
  return v ? dateFmt.format(v) : "";
}

/** « 27.10 » */
export function zShortDate(d: Date | string | number | null | undefined): string {
  const v = toDate(d);
  return v ? shortDateFmt.format(v) : "";
}

/** « 15:40 » */
export function zTime(d: Date | string | number | null | undefined): string {
  const v = toDate(d);
  return v ? timeFmt.format(v) : "";
}

/** « mar. 27.10 » */
export function zWeekdayShort(d: Date | string | number | null | undefined): string {
  const v = toDate(d);
  return v ? `${weekdayShortFmt.format(v)} ${shortDateFmt.format(v)}` : "";
}

/** « mardi 27.10.2026 » */
export function zWeekdayLong(d: Date | string | number | null | undefined): string {
  const v = toDate(d);
  return v ? `${weekdayLongFmt.format(v)} ${dateFmt.format(v)}` : "";
}

/** Clé de jour « AAAA-MM-JJ » vue de Suisse. */
export function zDayKey(d: Date | string | number | null | undefined): string {
  const v = toDate(d);
  return v ? dayKeyFmt.format(v) : "";
}

/** Écart en jours calendaires (Zurich) entre deux instants : b - a. */
export function zDayDiff(
  a: Date | string | number,
  b: Date | string | number,
): number {
  const ka = zDayKey(a);
  const kb = zDayKey(b);
  if (!ka || !kb) return 0;
  const [ya, ma, da] = ka.split("-").map(Number) as [number, number, number];
  const [yb, mb, db] = kb.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** « aujourd'hui », « hier », « il y a 3 jours », « demain », « dans 2 jours ». */
export function zRelativeDay(
  d: Date | string | number | null | undefined,
  now: Date | string | number,
): string {
  const v = toDate(d);
  if (!v) return "";
  const diff = zDayDiff(now, v);
  if (diff === 0) return "aujourd'hui";
  if (diff === -1) return "hier";
  if (diff === 1) return "demain";
  if (diff < 0) return `il y a ${Math.abs(diff)} jours`;
  return `dans ${diff} jours`;
}

/** Durée en secondes → « 2:05 » / « 1:02:05 ». */
export function zDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
