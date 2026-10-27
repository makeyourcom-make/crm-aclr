/**
 * Objectifs du mois : types et fonctions PURES (aucun accès base).
 *
 * Importable côté client comme côté serveur : statut de rythme, projection
 * fin de mois au rythme actuel, phrases coach, formats de date suisses.
 * Les requêtes vivent dans `lib/queries/objectifs-progress.ts`.
 */
import { formatCHFCompact, formatNumber } from "@/lib/format";

// ---------------------------------------------------------------------------
// FENÊTRE DU MOIS (jours ouvrés, Europe/Zurich)
// ---------------------------------------------------------------------------

export interface MonthWindow {
  /** « AAAA-MM » (mois calendaire vu de Suisse). */
  key: string;
  year: number;
  /** 0-11 */
  month: number;
  /** Minuit (Zurich) du 1er du mois, en instant UTC. */
  start: Date;
  /** Dernière milliseconde du mois (Zurich), en instant UTC. */
  end: Date;
  /** « Octobre 2026 » */
  label: string;
  /** « octobre » */
  monthName: string;
  /** « AAAA-MM-JJ » d'aujourd'hui (Zurich). */
  todayKey: string;
  workingDaysTotal: number;
  /** Jours ouvrés écoulés, aujourd'hui compris. */
  workingDaysElapsed: number;
  /** Jours ouvrés restants APRÈS aujourd'hui. */
  workingDaysLeft: number;
  /** Jours ouvrés restants, aujourd'hui compris s'il est ouvré. */
  daysLeftInclToday: number;
  todayIsWorkingDay: boolean;
  /** Part du mois écoulée (0-1) : repère or « où tu devrais être ». */
  timeRatio: number;
  /** Dernier jour ouvré du mois (minuit UTC du jour), null si aucun. */
  lastWorkingDay: Date | null;
}

// ---------------------------------------------------------------------------
// RYTHME
// ---------------------------------------------------------------------------

export type PaceStatus = "atteint" | "avance" | "rythme" | "accelerer";

export const PACE_META: Record<
  PaceStatus,
  { label: string; tone: "green" | "blue" | "red"; bar: string }
> = {
  atteint: { label: "Atteint", tone: "green", bar: "bg-win-500" },
  avance: { label: "En avance", tone: "green", bar: "bg-win-500" },
  rythme: { label: "Dans le rythme", tone: "blue", bar: "bg-info-500" },
  accelerer: { label: "À accélérer", tone: "red", bar: "bg-coral-400" },
};

/** Projection fin de mois = rythme actuel prolongé sur les jours ouvrés. */
export function projectionOf(value: number, w: Pick<MonthWindow, "workingDaysElapsed" | "workingDaysTotal">): number {
  if (w.workingDaysElapsed <= 0) return value;
  return (value / w.workingDaysElapsed) * w.workingDaysTotal;
}

export function paceOf(value: number, target: number, projection: number): PaceStatus {
  if (target > 0 && value >= target) return "atteint";
  const r = target > 0 ? projection / target : 0;
  if (r >= 1.1) return "avance";
  if (r >= 1) return "rythme";
  return "accelerer";
}

// ---------------------------------------------------------------------------
// MÉTRIQUES D'OBJECTIF
// ---------------------------------------------------------------------------

export type MetricKey =
  | "appels"
  | "contacts"
  | "rdv"
  | "propositions"
  | "signatures"
  | "ca"
  | "commission";

export interface ObjectiveMetric {
  key: MetricKey;
  label: string;
  value: number;
  target: number;
  projection: number;
  unit: "count" | "chf";
  /** Pourcentage réel (peut dépasser 100). */
  pct: number;
  status: PaceStatus;
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  appels: "Appels passés",
  contacts: "Contacts (mails + RS)",
  rdv: "RDV effectués",
  propositions: "Propositions envoyées",
  signatures: "Contrats signés",
  ca: "CA signé",
  commission: "Commissions",
};

/** Unités pour les phrases coach (« Encore 38 appels »). */
const METRIC_UNIT: Record<MetricKey, [string, string]> = {
  appels: ["appel", "appels"],
  contacts: ["contact", "contacts"],
  rdv: ["RDV", "RDV"],
  propositions: ["proposition", "propositions"],
  signatures: ["contrat", "contrats"],
  ca: ["CHF", "CHF"],
  commission: ["CHF", "CHF"],
};

/** Valeurs réalisées sur le mois (définitions : voir objectifs-progress.ts). */
export interface MonthRealised {
  appels: number;
  contacts: number;
  /** RDV effectués (honorés). */
  rdv: number;
  rdvPris: number;
  propositions: number;
  signatures: number;
  /** Valeur totale des contrats signés (one-shot + mensuel × durée). */
  ca: number;
  /** Versements de commission du mois (acquis + à venir, hors annulés). */
  commission: number;
  /** Somme des commissions totales des contrats signés ce mois. */
  commissionSigned: number;
}

/** Cibles d'un objectif MENSUEL (null = non fixée). */
export interface ObjectiveTargets {
  appels: number | null;
  contacts: number | null;
  rdv: number | null;
  propositions: number | null;
  signatures: number | null;
  ca: number | null;
  commission: number | null;
}

const METRIC_ORDER: MetricKey[] = [
  "appels",
  "contacts",
  "rdv",
  "propositions",
  "signatures",
  "ca",
  "commission",
];

/** Construit les métriques (uniquement celles dont la cible est > 0). */
export function buildMetrics(
  targets: ObjectiveTargets,
  realised: MonthRealised,
  w: Pick<MonthWindow, "workingDaysElapsed" | "workingDaysTotal">,
): ObjectiveMetric[] {
  const out: ObjectiveMetric[] = [];
  for (const key of METRIC_ORDER) {
    const target = targets[key];
    if (target == null || !(target > 0)) continue;
    const value = realised[key];
    const projection = projectionOf(value, w);
    out.push({
      key,
      label: METRIC_LABELS[key],
      value,
      target,
      projection,
      unit: key === "ca" || key === "commission" ? "chf" : "count",
      pct: Math.round((value / target) * 100),
      status: paceOf(value, target, projection),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// FORMATS
// ---------------------------------------------------------------------------

const DMY = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "Europe/Zurich",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DM = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "Europe/Zurich",
  day: "2-digit",
  month: "2-digit",
});
const HM = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "Europe/Zurich",
  hour: "2-digit",
  minute: "2-digit",
});

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const x = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? null : x;
}

/** « 27.10.2026 » (charte : dates au format suisse). */
export function formatDateCH(d: Date | string | null | undefined): string {
  const x = toDate(d);
  return x ? DMY.format(x) : "";
}

/** « 27.10 » */
export function formatDayMonthCH(d: Date | string | null | undefined): string {
  const x = toDate(d);
  return x ? DM.format(x) : "";
}

/** « 13:00 » */
export function formatTimeCH(d: Date | string | null | undefined): string {
  const x = toDate(d);
  return x ? HM.format(x) : "";
}

/** Valeur d'une métrique : « 412 » ou « CHF 4'850 ». */
export function formatMetricValue(value: number, unit: "count" | "chf"): string {
  return unit === "chf"
    ? formatCHFCompact(value)
    : formatNumber(Math.round(value));
}

/** Nombre sans le préfixe « CHF » (gros chiffres : « 4'850 »). */
export function formatAmountShort(value: number): string {
  return formatNumber(Math.round(value));
}

function unitWord(key: MetricKey, n: number): string {
  const [s, p] = METRIC_UNIT[key];
  return n >= 2 ? p : s;
}

/**
 * Phrase coach d'une métrique. `audience` = « tu » pour la commerciale,
 * phrasé neutre pour l'admin qui regarde l'équipe.
 */
export function metricCoach(
  m: ObjectiveMetric,
  w: Pick<MonthWindow, "daysLeftInclToday" | "lastWorkingDay">,
  audience: "me" | "admin",
  panierMoyen?: number | null,
): string {
  const me = audience === "me";
  if (m.status === "atteint") {
    return me
      ? "Objectif plié ! Tout ce qui vient en plus, c'est du bonus."
      : "Objectif atteint.";
  }
  const left = Math.max(0, m.target - m.value);
  const leftTxt =
    m.unit === "chf"
      ? formatCHFCompact(left)
      : `${formatNumber(Math.ceil(left))} ${unitWord(m.key, Math.ceil(left))}`;
  const days = w.daysLeftInclToday;
  const until = w.lastWorkingDay ? ` d'ici le ${formatDayMonthCH(w.lastWorkingDay)}` : "";

  if (days <= 0) {
    return me
      ? `Mois bouclé à ${m.pct} % : il manquait ${leftTxt}.`
      : `Clôturé à ${m.pct} % (manque ${leftTxt}).`;
  }

  if (m.key === "ca" && panierMoyen && panierMoyen > 0) {
    const k = Math.max(1, Math.ceil(left / panierMoyen));
    return me
      ? `Encore ${leftTxt} : environ ${k} ${k >= 2 ? "contrats" : "contrat"} à ton panier moyen (${formatCHFCompact(panierMoyen)})${until}.`
      : `Manque ${leftTxt} · environ ${k} ${k >= 2 ? "contrats" : "contrat"} au panier moyen.`;
  }

  if (m.unit === "chf") {
    return me
      ? `Encore ${leftTxt}${until} et c'est plié.`
      : `Manque ${leftTxt}${until}.`;
  }

  const perDay = Math.ceil(left / days);
  if (days === 1) {
    return me
      ? `Dernier jour : encore ${leftTxt} pour boucler.`
      : `Dernier jour : manque ${leftTxt}.`;
  }
  return me
    ? `Encore ${leftTxt} : ${formatNumber(perDay)} par jour ouvré${until} et c'est plié.`
    : `Manque ${leftTxt} · ${formatNumber(perDay)} par jour ouvré${until}.`;
}

/** Taux 0-1 → « 25 % » (une décimale si besoin : « 12.5 % »). */
export function formatPercentRate(rate: number): string {
  const v = Math.round(rate * 1000) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} %`;
}

/** Première lettre en majuscule (« octobre 2026 » → « Octobre 2026 »). */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
