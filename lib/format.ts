/**
 * Helpers de formatage — convention suisse / UI française.
 *
 * Montants : convention suisse (apostrophe milliers, point décimal)
 *   ex. CHF 2'500.00, CHF 1'490.00
 *
 * Dates : convention française pour l'UI
 *   ex. "28 mai 2026", "28/05/2026", "28/05/2026 14:30"
 *
 * IMPORTANT : pour le format apostrophe `2'500` on utilise la locale `de-CH`
 * (allemand suisse). La locale `fr-CH` utilise un espace insécable comme
 * séparateur de milliers, ce qui n'est PAS la convention demandée par la spec.
 */

import { format as dfnsFormat, formatDistanceToNow, isValid } from "date-fns";
import { fr } from "date-fns/locale";

// ---------------------------------------------------------------------------
// MONTANTS
// ---------------------------------------------------------------------------

const chfFormatter = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const chfFormatterCompact = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("de-CH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formate un montant en CHF avec convention suisse.
 * @example formatCHF(2500.5) → "CHF 2'500.50"
 * @example formatCHF(1490)  → "CHF 1'490.00"
 */
export function formatCHF(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return chfFormatter.format(n);
}

/**
 * Formate un montant dans une devise arbitraire (CHF par défaut).
 * @example formatMoney(2500.5, "CHF") → "CHF 2'500.50"
 * @example formatMoney(2500.5, "EUR") → "EUR 2 500,50" (FR locale)
 */
export function formatMoney(
  amount: number | string | null | undefined,
  devise?: string | null,
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  const cur = (devise ?? "CHF").toUpperCase();
  if (cur === "EUR") {
    // Intl.NumberFormat fr-FR utilise U+202F (narrow no-break space) comme
    // séparateur de milliers, qui s'affiche en `/` dans plusieurs polices
    // (Helvetica de @react-pdf notamment). On normalise vers espace standard.
    const formatted = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    // Remplace NBSP (U+00A0) et NNBSP (U+202F) par une espace classique
    return formatted.replace(/[  ]/g, " ");
  }
  // CHF (et fallback) : format suisse avec apostrophe
  return chfFormatter.format(n);
}

/**
 * Variante compacte sans décimales (utile dans les KPI/dashboards).
 * @example formatCHFCompact(2500) → "CHF 2'500"
 */
export function formatCHFCompact(
  amount: number | string | null | undefined,
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return chfFormatterCompact.format(n);
}

/**
 * Nombre sans devise, format suisse (apostrophe milliers).
 * @example formatNumber(2500.5) → "2'500.5"
 */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return numberFormatter.format(n);
}

/**
 * Formate un pourcentage (ex: 0.071 → "7.1 %").
 */
export function formatPercent(
  ratio: number | null | undefined,
  decimals = 1,
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio))
    return "—";
  return `${(ratio * 100).toFixed(decimals).replace(".", ".")} %`;
}

// ---------------------------------------------------------------------------
// DATES
// ---------------------------------------------------------------------------

/**
 * Date longue en français : "28 mai 2026".
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return dfnsFormat(d, "d MMMM yyyy", { locale: fr });
}

/**
 * Date courte numérique : "28/05/2026".
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return dfnsFormat(d, "dd/MM/yyyy", { locale: fr });
}

/**
 * Date + heure : "28/05/2026 14:30".
 */
export function formatDateTime(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return dfnsFormat(d, "dd/MM/yyyy HH:mm", { locale: fr });
}

/**
 * Heure seule : "14:30".
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return dfnsFormat(d, "HH:mm", { locale: fr });
}

/**
 * Distance relative au présent en français : "il y a 3 minutes", "dans 2 jours".
 */
export function formatRelative(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "—";
  return formatDistanceToNow(d, { locale: fr, addSuffix: true });
}

// ---------------------------------------------------------------------------
// DURÉES (pour les appels)
// ---------------------------------------------------------------------------

/**
 * Durée en secondes → format "MM:SS" ou "H:MM:SS".
 * @example formatDuration(125) → "2:05"
 * @example formatDuration(3725) → "1:02:05"
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

// ---------------------------------------------------------------------------
// TÉLÉPHONES SUISSES
// ---------------------------------------------------------------------------

/**
 * Formate un numéro de téléphone CH pour l'affichage.
 * Accepte plusieurs formats d'entrée, normalise vers "+41 XX XXX XX XX".
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  // Cas +41XXXXXXXXX
  if (digits.startsWith("41") && digits.length === 11) {
    return `+41 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }
  // Cas national 0XXXXXXXXX → afficher en +41
  if (digits.startsWith("0") && digits.length === 10) {
    return `+41 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return raw; // fallback : afficher tel quel si format inconnu
}

/**
 * Normalise un numéro CH au format international `+41XXXXXXXXX` (sans espaces).
 * Utile pour les liens `tel:` et la persistence DB.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("41") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+41${digits.slice(1)}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}
