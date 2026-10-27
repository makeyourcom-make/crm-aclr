/**
 * Constantes et helpers partagés du planning de production (côté client).
 * Les dates sont des chaînes « AAAA-MM-JJ » (jour calendaire, sans fuseau).
 *
 * MYC Arena : couleurs des statuts (gris à faire, jaune en cours, violet
 * attente client, vert fait ; rouge = retard calculé, rouge foncé = « boss »,
 * plus d'un mois de retard) et pastilles de services colorées.
 */
import type { PlanningTacheDTO } from "@/lib/planning/queries";
import { SERVICES, type ServiceCode } from "@/lib/planning/templates";

export type Statut = PlanningTacheDTO["statut"];

/** Couleurs validées avec Arthur : gris à faire, jaune en cours, violet
 *  attente client, vert fait ; le rouge (retard) est calculé, jamais choisi. */
export const STATUT_META: Record<Statut, { label: string; chip: string; dot: string }> = {
  A_FAIRE: { label: "À faire", chip: "bg-card text-foreground border-border-strong", dot: "bg-subtle" },
  EN_COURS: { label: "En cours", chip: "bg-[#FEF9C3] text-[#713F12] border-[#F5E08A]", dot: "bg-[#CA8A04]" },
  ATTENTE_CLIENT: { label: "Attente client", chip: "bg-lvl-50 text-lvl-700 border-[#D9CEFF]", dot: "bg-lvl-500" },
  FAIT: { label: "Fait", chip: "bg-win-50 text-win-700 border-[#BFE9CF]", dot: "bg-win-500" },
  ABANDONNEE: { label: "Abandonnée", chip: "bg-navy-50 text-muted-foreground border-border line-through", dot: "bg-subtle" },
};
export const RETARD_CHIP = "bg-alert-50 text-alert-700 border-[#F6B9BC]";
export const CRITIQUE_CHIP = "bg-alert-700 text-white border-alert-700";

/** Capacité de production de référence (affichage des jauges de charge). */
export const CAPACITE_JOUR_MIN = 6 * 60;

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
const MOIS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_LONGS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const JOURS_ABR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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
/** « oct. 26 » */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${MOIS[m - 1]} ${String(y).slice(2)}`;
}
/** « octobre 2026 » */
export function monthLong(ym: string): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${MOIS_LONG[m - 1]} ${y}`;
}
/** « octobre » */
export function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MOIS_LONG[m - 1] ?? "";
}
/** « mar. 27 oct. » */
export function dayLabel(s: string): string {
  const d = toUtc(s);
  return `${JOURS_COURTS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
/** « 27.10 » */
export function ddmm(s: string): string {
  return `${s.slice(8, 10)}.${s.slice(5, 7)}`;
}
/** « 27.10.2026 » */
export function ddmmyyyy(s: string): string {
  return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
}
/** « Mardi 27.10 » */
export function dayLong(s: string): string {
  return `${JOURS_LONGS[toUtc(s).getUTCDay()]} ${ddmm(s)}`;
}
/** « Mar » */
export function dayAbbr(s: string): string {
  return JOURS_ABR[toUtc(s).getUTCDay()] ?? "";
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

/**
 * Retard « production » (maquette MYC Arena validée) : une tâche en attente
 * du client n'est pas un retard de l'équipe, la balle est chez le client.
 */
export function etatProd(t: { date: string; statut: Statut }, today: string): "ok" | "retard" | "critique" {
  if (t.statut === "ATTENTE_CLIENT") return "ok";
  return etatTache(t, today);
}

export function chipClass(t: { date: string; statut: Statut }, today: string): string {
  const e = etatProd(t, today);
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

// ---------------------------------------------------------------------------
// MYC Arena : visuels des tâches
// ---------------------------------------------------------------------------

export type Visuel = "fait" | "boss" | "retard" | "attente" | "encours" | "afaire";

export function visuelTache(t: { date: string; statut: Statut }, today: string): Visuel {
  if (t.statut === "FAIT") return "fait";
  const e = etatProd(t, today);
  if (e === "critique") return "boss";
  if (e === "retard") return "retard";
  if (t.statut === "ATTENTE_CLIENT") return "attente";
  if (t.statut === "EN_COURS") return "encours";
  return "afaire";
}

export interface VisuelStyle {
  label: string;
  /** Pastille compacte (vue mois) : fond + bord + texte. */
  pill: string;
  /** Texte secondaire dans la pastille. */
  sub: string;
  /** Carte (vues semaine / jour) : fond + bord. */
  card: string;
  /** Titre de la carte. */
  cardText: string;
  /** Pastille de statut. */
  status: string;
  /** Rond de validation : bord + fond + couleur de la coche. */
  ring: string;
}

export const VISUEL_STYLE: Record<Visuel, VisuelStyle> = {
  fait: {
    label: "Fait",
    pill: "bg-win-50 border-[#BFE9CF] text-win-700",
    sub: "text-win-700",
    card: "bg-[#F2FBF5] border-[#BFE9CF]",
    cardText: "text-win-700",
    status: "bg-win-50 text-win-700",
    ring: "border-win-500 bg-win-500 text-white",
  },
  boss: {
    label: "Boss · retard > 1 mois",
    pill: "bg-alert-700 border-alert-700 text-white",
    sub: "text-coral-100",
    card: "bg-coral-50 border-[#F6B9BC]",
    cardText: "text-alert-700",
    status: "bg-alert-700 text-white",
    ring: "border-alert-700 bg-white text-alert-700",
  },
  retard: {
    label: "En retard",
    pill: "bg-alert-50 border-[#F6B9BC] text-alert-700",
    sub: "text-alert-700",
    card: "bg-alert-50 border-[#F6B9BC]",
    cardText: "text-alert-700",
    status: "bg-white text-alert-700",
    ring: "border-alert-500 bg-white text-alert-700",
  },
  attente: {
    label: "Attente client",
    pill: "bg-lvl-50 border-[#D9CEFF] text-lvl-700",
    sub: "text-lvl-700",
    card: "bg-lvl-50 border-[#D9CEFF]",
    cardText: "text-lvl-700",
    status: "bg-white text-lvl-700",
    ring: "border-lvl-500 bg-white text-lvl-700",
  },
  encours: {
    label: "En cours",
    pill: "bg-[#FEF9C3] border-[#F5E08A] text-[#713F12]",
    sub: "text-[#854D0E]",
    card: "bg-[#FEF9C3] border-[#F5E08A]",
    cardText: "text-[#713F12]",
    status: "bg-white text-[#854D0E]",
    ring: "border-[#CA8A04] bg-white text-[#854D0E]",
  },
  afaire: {
    label: "À faire",
    pill: "bg-card border-border-strong text-foreground",
    sub: "text-muted-foreground",
    card: "bg-card border-border-strong",
    cardText: "text-foreground",
    status: "bg-navy-50 text-muted-foreground",
    ring: "border-subtle bg-white text-foreground",
  },
};

// ---------------------------------------------------------------------------
// MYC Arena : pastilles de services
// ---------------------------------------------------------------------------

export interface ServiceStyle {
  /** Point de couleur. */
  dot: string;
  /** Pastille (fond clair + texte foncé, contraste ≥ 4.5:1). */
  pill: string;
  /** Libellé court (cartes, filtres). */
  court: string;
}

const SERVICE_STYLE: Record<string, ServiceStyle> = {
  SITE: { dot: "bg-info-500", pill: "bg-info-50 text-info-700", court: "Site - SEO" },
  SEO: { dot: "bg-info-500", pill: "bg-info-50 text-info-700", court: "Site - SEO" },
  RS: { dot: "bg-[#EC4899]", pill: "bg-[#FCE7F3] text-[#A3195B]", court: "Réseaux sociaux" },
  ADS: { dot: "bg-[#F97316]", pill: "bg-[#FFEDD5] text-[#9A3D07]", court: "Ads" },
  CMO: { dot: "bg-[#6366F1]", pill: "bg-[#E0E7FF] text-[#3730A3]", court: "CMO" },
  STRATEGIE: { dot: "bg-gold-500", pill: "bg-gold-50 text-gold-700", court: "Stratégie" },
  LICENCE: { dot: "bg-subtle", pill: "bg-navy-50 text-muted-foreground", court: "Licence" },
  PACK: { dot: "bg-lvl-500", pill: "bg-lvl-50 text-lvl-700", court: "Pack" },
  A_CONFIGURER: { dot: "bg-gold-500", pill: "bg-gold-50 text-gold-700", court: "À préciser" },
  AUTRE: { dot: "bg-subtle", pill: "bg-navy-50 text-foreground", court: "Autre" },
};

export function serviceStyle(code: string): ServiceStyle {
  return SERVICE_STYLE[code] ?? SERVICE_STYLE.AUTRE!;
}

/** Libellé complet d'un service (« Site internet - SEO »). */
export function serviceLabelOf(code: string): string {
  return SERVICES[code as ServiceCode]?.label ?? code;
}

/** Lignes « à préciser » : aucun service livrable tant qu'on ne les détaille pas. */
export const PLACEHOLDERS = new Set(["A_CONFIGURER", "PACK"]);

/** Filtre de statut de la barre « Afficher ». */
export type StatutFiltre = "tous" | "retard" | "attente" | "quick";
