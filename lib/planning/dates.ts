/**
 * Dates du planning de production. Toutes les dates de tâches sont stockées à
 * MINUIT UTC du jour concerné (Date.UTC) : un « jour » est une clé stable,
 * indépendante du fuseau du serveur (UTC) ou du navigateur (Europe/Zurich).
 */

/** Minuit UTC d'un jour donné (mois 0-11). */
export function utcDay(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** « Aujourd'hui » vu de Suisse, en minuit UTC. */
export function todayZurich(): Date {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
  }).format(new Date()); // AAAA-MM-JJ
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return utcDay(y, m - 1, d);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

export function addMonths(date: Date, n: number): Date {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth() + n, 1);
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000);
}

/** Clé de mois « AAAA-MM ». */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Clé « AAAA-MM-JJ ». */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Semaine ISO « AAAA-Www » (clé des tâches hebdomadaires). */
export function isoWeekKey(date: Date): string {
  const d = new Date(date.getTime());
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Semaine du mois (planning) : S1 = 1-7, S2 = 8-14, S3 = 15-21, S4 = 22-fin. */
export function weekOfMonth(date: Date): 1 | 2 | 3 | 4 {
  const d = date.getUTCDate();
  return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4;
}

/** Dimanche de Pâques (algorithme grégorien anonyme). */
function easter(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDay(y, month, day);
}

const holidayCache = new Map<number, Set<string>>();

/**
 * Jours fériés pris en compte (ACLR est à Torgon, VS) : fériés fédéraux +
 * valaisans + Vendredi saint / lundis de Pâques et de Pentecôte, Saint-Étienne.
 * Inclure un jour de trop ne fait que décaler une tâche d'un jour.
 */
export function holidays(y: number): Set<string> {
  const cached = holidayCache.get(y);
  if (cached) return cached;
  const e = easter(y);
  const list = [
    utcDay(y, 0, 1), // Nouvel An
    utcDay(y, 2, 19), // Saint-Joseph (VS)
    addDays(e, -2), // Vendredi saint
    addDays(e, 1), // Lundi de Pâques
    addDays(e, 39), // Ascension
    addDays(e, 50), // Lundi de Pentecôte
    addDays(e, 60), // Fête-Dieu (VS)
    utcDay(y, 7, 1), // Fête nationale
    utcDay(y, 7, 15), // Assomption (VS)
    utcDay(y, 10, 1), // Toussaint (VS)
    utcDay(y, 11, 8), // Immaculée Conception (VS)
    utcDay(y, 11, 25), // Noël
    utcDay(y, 11, 26), // Saint-Étienne
  ];
  const set = new Set(list.map(dayKey));
  holidayCache.set(y, set);
  return set;
}

/** Lundi-vendredi, hors jours fériés. */
export function isWorkingDay(date: Date): boolean {
  const wd = date.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !holidays(date.getUTCFullYear()).has(dayKey(date));
}

/**
 * Date réelle d'une tâche placée au jour `jour` d'un mois, ramenée sur un jour
 * ouvré :
 *  - date fixe (cycle RS) : jour ouvré PRÉCÉDENT (un 15 qui tombe un samedi
 *    → vendredi 14) ;
 *  - fenêtre : jour ouvré précédent s'il reste dans la fenêtre, sinon suivant
 *    dans la fenêtre, sinon le plus proche.
 */
export function resolveDay(
  y: number,
  m: number,
  jour: number,
  opts: { fixe: boolean; fenetreDebut: number; fenetreFin: number },
): Date {
  const dim = daysInMonth(y, m);
  const target = Math.min(Math.max(jour, 1), dim);
  const base = utcDay(y, m, target);
  if (isWorkingDay(base)) return base;

  if (opts.fixe) {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(base, -i);
      if (isWorkingDay(d)) return d;
    }
    return base;
  }

  const lo = Math.min(Math.max(opts.fenetreDebut, 1), dim);
  const hi = Math.min(Math.max(opts.fenetreFin, lo), dim);
  for (let d = target - 1; d >= lo; d--) {
    const c = utcDay(y, m, d);
    if (isWorkingDay(c)) return c;
  }
  for (let d = target + 1; d <= hi; d++) {
    const c = utcDay(y, m, d);
    if (isWorkingDay(c)) return c;
  }
  for (let i = 1; i <= 7; i++) {
    const before = addDays(base, -i);
    if (isWorkingDay(before)) return before;
    const after = addDays(base, i);
    if (isWorkingDay(after)) return after;
  }
  return base;
}
