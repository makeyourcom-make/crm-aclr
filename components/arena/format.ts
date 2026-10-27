/**
 * Petits helpers d'affichage (client-safe).
 * Les nombres passent par `formatNumber` de lib/format (convention suisse
 * du CRM) pour rester cohérents avec le reste de l'application.
 */
import { formatNumber } from "@/lib/format";

/** Nombre entier au format CRM, jamais de tiret si la valeur est absente. */
export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "0";
  return formatNumber(Math.round(n));
}

/** @deprecated Plus d'XP dans l'interface. « 3'420 XP » */
export function formatXp(xp: number | null | undefined): string {
  return `${formatInt(xp)} XP`;
}

/** @deprecated Plus d'XP dans l'interface. « +50 XP » (ou « -10 XP »). */
export function formatSignedXp(xp: number | null | undefined): string {
  const n = xp !== null && xp !== undefined && Number.isFinite(xp) ? Math.round(xp) : 0;
  return `${n < 0 ? "-" : "+"}${formatInt(Math.abs(n))} XP`;
}

/** Ratio borné 0-1 (0 si max nul). */
export function ratioOf(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

/** Pourcentage entier borné 0-100. */
export function pctOf(value: number, max: number): number {
  return Math.round(ratioOf(value, max) * 100);
}

/**
 * Clé de jour « AAAA-MM-JJ » (ex. `PlayerStats.records.bestDayDate`, déjà en
 * fuseau Europe/Zurich) → « 20.10.2026 ». Pur traitement de chaîne : aucun
 * décalage horaire possible. Chaîne vide si la clé est absente ou invalide.
 */
export function formatDayKey(key: string | null | undefined): string {
  if (!key) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** Accord simple : `plural(3, "appel")` → « 3 appels ». */
export function plural(n: number, singular: string, pluralForm?: string): string {
  const word = Math.abs(n) >= 2 ? (pluralForm ?? `${singular}s`) : singular;
  return `${formatInt(n)} ${word}`;
}
