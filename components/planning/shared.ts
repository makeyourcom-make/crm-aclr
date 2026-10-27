/**
 * Constantes et helpers partagés du planning de production (côté client).
 * Les dates sont des chaînes « AAAA-MM-JJ » (jour calendaire, sans fuseau).
 */
import type { PlanningTacheDTO } from "@/lib/planning/queries";

export type Statut = PlanningTacheDTO["statut"];

/** Couleurs validées avec Arthur : gris à faire, jaune en cours, violet
 *  attente client, vert fait ; le rouge (retard) est calculé, jamais choisi. */
export const STATUT_META: Record<Statut, { label: string; chip: string; dot: string }> = {
  A_FAIRE: { label: "À faire", chip: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  EN_COURS: { label: "En cours", chip: "bg-yellow-100 text-yellow-900 border-yellow-300", dot: "bg-yellow-400" },
  ATTENTE_CLIENT: { label: "Attente client", chip: "bg-violet-100 text-violet-800 border-violet-300", dot: "bg-violet-500" },
  FAIT: { label: "Fait", chip: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
  ABANDONNEE: { label: "Abandonnée", chip: "bg-slate-50 text-slate-400 border-slate-200 line-through", dot: "bg-slate-300" },
};
export const RETARD_CHIP = "bg-red-100 text-red-800 border-red-300";
export const CRITIQUE_CHIP = "bg-red-600 text-white border-red-700";

export const FREQUENCE_LABEL: Record<string, string> = {
  MENSUELLE: "1 fois par mois",
  BIMENSUELLE: "Tous les 15 jours",
  HEBDO: "Chaque semaine",
  BIMESTRIELLE: "Tous les 2 mois",
  TRIMESTRIELLE: "Tous les 3 mois",
  ANNUELLE: "1 fois par an",
  PONCTUELLE: "Une seule fois",
};

export const JOURS_SEMAINE = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const toUtc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const toStr = (d: Date) => d.toISOString().slice(0, 10);

export function addDaysStr(s: string, n: number): string {
  return toStr(new Date(toUtc(s).getTime() + n * 86_400_000));
}
export function addMonthsStr(s: string, n: number): string {
  const d = toUtc(s);
  return toStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}
/** « AAAA-MM » d'une date « AAAA-MM-JJ ». */
export const monthOf = (s: string) => s.slice(0, 7);
export const dayOf = (s: string) => Number(s.slice(8, 10));
export function weekOfMonthStr(s: string): 1 | 2 | 3 | 4 {
  const d = dayOf(s);
  return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4;
}
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${MOIS[m - 1]} ${String(y).slice(2)}`;
}
export function dayLabel(s: string): string {
  const d = toUtc(s);
  return `${JOURS_COURTS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/**
 * Retard : non faite et date passée. Critique : plus d'un mois de retard
 * (le report d'un mois est toléré, au-delà la tâche reste rouge + alerte).
 */
export function etatTache(t: { date: string; statut: Statut }, today: string): "ok" | "retard" | "critique" {
  if (t.statut === "FAIT" || t.statut === "ABANDONNEE") return "ok";
  if (t.date >= today) return "ok";
  const d = toUtc(today);
  const limite = toStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, d.getUTCDate())));
  return t.date < limite ? "critique" : "retard";
}

export function chipClass(t: { date: string; statut: Statut }, today: string): string {
  const e = etatTache(t, today);
  if (e === "critique") return CRITIQUE_CHIP;
  if (e === "retard") return RETARD_CHIP;
  return STATUT_META[t.statut].chip;
}

export function fmtDuree(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
