/**
 * Petits helpers d'affichage de la rubrique Emails (client-safe, purs).
 *
 * - `uiText` : retire les grands tirets des messages renvoyés par les actions
 *   serveur avant de les afficher (règle d'Arthur : jamais de « — » visible).
 * - Dates au format suisse de la charte (« 27.10.2026 · 15:12 »), en fuseau
 *   Europe/Zurich pour que le rendu serveur et le rendu client concordent.
 * - Classes de champs / libellés communes aux composants de la boîte.
 */
const TZ = "Europe/Zurich";

/** Remplace les grands tirets (— –) par « - » dans un texte affiché. */
export function uiText(s: string | null | undefined, fallback = ""): string {
  const v = s ?? fallback;
  return v.replace(/\s*[—–]\s*/g, " - ");
}

/** Initiales d'un nom (ou d'une adresse email) : « Nadia Perrin » → « NP ». */
export function initialsFrom(nameOrEmail: string | null | undefined): string {
  const raw = (nameOrEmail ?? "").trim();
  if (!raw) return "?";
  const base = raw.includes("@") && !raw.includes(" ") ? raw.split("@")[0]! : raw;
  const words = base
    .replace(/[()<>"]/g, " ")
    .split(/[\s._&-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

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

/** « 27.10.2026 » */
export function mailDate(d: string | Date): string {
  const [y, m, day] = dayKeyFmt.format(new Date(d)).split("-");
  return `${day}.${m}.${y}`;
}

/** « 15:12 » */
export function mailTime(d: string | Date): string {
  return timeFmt.format(new Date(d));
}

/** « 27.10.2026 · 15:12 » */
export function mailDateTime(d: string | Date): string {
  return `${mailDate(d)} · ${mailTime(d)}`;
}

/**
 * Date courte de liste : l'heure si c'est aujourd'hui, « 26.10 » cette année,
 * sinon « 26.10.2025 ». `nowMs` vient du serveur (rendu pur, sans Date.now()).
 */
export function mailShortDate(d: string | Date, nowMs: number): string {
  const key = dayKeyFmt.format(new Date(d));
  const todayKey = dayKeyFmt.format(new Date(nowMs));
  if (key === todayKey) return mailTime(d);
  const [y, m, day] = key.split("-");
  return y === todayKey.slice(0, 4) ? `${day}.${m}` : `${day}.${m}.${y}`;
}

/** Durée lisible : « 38 min », « 2 h 10 », « 3 j ». */
export function formatWait(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) {
    const rest = min % 60;
    return rest > 0 && h < 10 ? `${h} h ${String(rest).padStart(2, "0")}` : `${h} h`;
  }
  const days = Math.floor(h / 24);
  return `${days} j`;
}

/** Champ de saisie standard de la rubrique (44 px, rayon 12). */
export const FIELD_CLASS =
  "h-11 w-full min-w-0 rounded-[12px] border border-border-strong bg-card px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25 disabled:opacity-60";

/** Libellé en petites majuscules (11 px 700, espacement 0.08em). */
export const CAPS_CLASS =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground";
