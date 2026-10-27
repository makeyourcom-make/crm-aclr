/**
 * Pipeline MYC Arena : métadonnées des étapes et petites règles PURES
 * (client-safe : aucune dépendance serveur, imports de types uniquement).
 */
import type { ActivityType, DealStage } from "@prisma/client";
import {
  Flame,
  Search,
  Send,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { XP_RULES } from "@/lib/gamification/rules";
import { getActivityTypeLabel, getDealStageLabel } from "@/lib/labels";
import type { PipelineDeal } from "@/lib/queries/deals";

/** Étapes affichées en colonnes (Perdu vit dans « Leçons du mois »). */
export const BOARD_STAGES: DealStage[] = [
  "DECOUVERTE",
  "PROPOSITION",
  "NEGOCIATION",
  "SIGNE",
];

export const ALL_STAGES: DealStage[] = [...BOARD_STAGES, "PERDU"];

export const ACTIVE_STAGES: DealStage[] = [
  "DECOUVERTE",
  "PROPOSITION",
  "NEGOCIATION",
];

export function isActiveStage(s: DealStage): boolean {
  return s === "DECOUVERTE" || s === "PROPOSITION" || s === "NEGOCIATION";
}

export interface StageMeta {
  label: string;
  icon: LucideIcon;
  /** Barre de couleur (haut de colonne, segments de progression des cartes). */
  bar: string;
  /** Tuile d'icône de la colonne. */
  tile: string;
  /** Fond et bord de la colonne. */
  column: string;
  /** Étape suivante du bouton « Avancer ». */
  next: DealStage | null;
  /** Texte de colonne vide. */
  empty: string;
}

export const STAGE_META: Record<DealStage, StageMeta> = {
  DECOUVERTE: {
    label: getDealStageLabel("DECOUVERTE"),
    icon: Search,
    bar: "bg-subtle",
    tile: "bg-card text-muted-foreground",
    column: "bg-navy-50 border-border",
    next: "PROPOSITION",
    empty: "Rien en découverte. Une session de phoning et ça repart.",
  },
  PROPOSITION: {
    label: getDealStageLabel("PROPOSITION"),
    icon: Send,
    bar: "bg-info-500",
    tile: "bg-info-50 text-info-700",
    column: "bg-navy-50 border-border",
    next: "NEGOCIATION",
    empty: "Aucune proposition en cours. Avance un deal de Découverte.",
  },
  NEGOCIATION: {
    label: getDealStageLabel("NEGOCIATION"),
    icon: Flame,
    bar: "bg-gold-500",
    tile: "bg-coral-100 text-coral-600",
    column: "bg-navy-50 border-border",
    next: "SIGNE",
    empty: "Rien en négociation pour l'instant.",
  },
  SIGNE: {
    label: getDealStageLabel("SIGNE"),
    icon: Trophy,
    bar: "bg-win-500",
    tile: "bg-gold-50 text-gold-700",
    column: "bg-win-50 border-[#B5E5C8]",
    next: null,
    empty: "Pas encore de trophée ce mois. Le premier vaut +200 XP.",
  },
  PERDU: {
    label: getDealStageLabel("PERDU"),
    icon: XCircle,
    bar: "bg-alert-500",
    tile: "bg-alert-50 text-alert-700",
    column: "bg-card border-border",
    next: null,
    empty: "Zéro deal perdu ce mois sur cette vue. Propre.",
  },
};

// ---------------------------------------------------------------------------
// Temps
// ---------------------------------------------------------------------------

export const DAY_MS = 86_400_000;

/** Au-delà : alerte rouge « N j sans action » et filtre « À relancer ». */
export const DORMANT_DAYS = 7;

function toMs(d: Date | string): number {
  return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}

/** Jours pleins écoulés entre deux instants (jamais négatif). */
export function daysBetween(from: Date | string, toMsValue: number): number {
  return Math.max(0, Math.floor((toMsValue - toMs(from)) / DAY_MS));
}

export function daysSinceAction(d: PipelineDeal, nowMs: number): number {
  return daysBetween(d.lastActionAt, nowMs);
}

export function isDormant(d: PipelineDeal, nowMs: number): boolean {
  return isActiveStage(d.stage) && daysSinceAction(d, nowMs) > DORMANT_DAYS;
}

/**
 * Deal chaud : en Proposition / Négociation, suivi récent (≤ 7 j sans action)
 * ET soit une probabilité ≥ 70 %, soit un close attendu dans les 14 jours.
 */
export function isHot(d: PipelineDeal, nowMs: number): boolean {
  if (d.stage !== "PROPOSITION" && d.stage !== "NEGOCIATION") return false;
  if (daysSinceAction(d, nowMs) > DORMANT_DAYS) return false;
  if (d.probabilite >= 70) return true;
  if (d.closeAttenduLe) {
    const t = toMs(d.closeAttenduLe);
    return t >= nowMs - DAY_MS && t <= nowMs + 14 * DAY_MS;
  }
  return false;
}

export function isCloseOverdue(d: PipelineDeal, nowMs: number): boolean {
  return (
    isActiveStage(d.stage) &&
    !!d.closeAttenduLe &&
    toMs(d.closeAttenduLe) < nowMs
  );
}

// ---------------------------------------------------------------------------
// Montants et XP
// ---------------------------------------------------------------------------

export function dealMensuel(d: PipelineDeal): number {
  return d.products.reduce((s, p) => s + p.mensuel, 0);
}

export function dealOneShot(d: PipelineDeal): number {
  return d.products.reduce((s, p) => s + p.oneShot, 0);
}

/** XP d'une signature : 200 + 1 XP par tranche de 10 CHF mensuels. */
export function signXp(d: PipelineDeal): number {
  return (
    XP_RULES.signature +
    Math.floor(dealMensuel(d) / 10) * XP_RULES.signatureParTranche10ChfMensuel
  );
}

/** Libellé court de l'offre (« Google Ads + 1 »), null sans produit. */
export function offerLabel(d: PipelineDeal): string | null {
  if (d.products.length === 0) return null;
  const first = d.products[0].nom;
  return d.products.length > 1 ? `${first} + ${d.products.length - 1}` : first;
}

// ---------------------------------------------------------------------------
// Signature (même logique que l'ancienne carte)
// ---------------------------------------------------------------------------

export type SignatureState =
  | "client-signed"
  | "contract-ready"
  | "marked-signed"
  | null;

export function signatureState(d: PipelineDeal): SignatureState {
  const sig = d.signature;
  if (sig && sig.signeParClient && !sig.signeParAclr) return "client-signed";
  if (d.contract && (!sig || (!sig.signeParClient && !sig.signeParAclr))) {
    return "contract-ready";
  }
  if (d.stage === "SIGNE") return "marked-signed";
  return null;
}

// ---------------------------------------------------------------------------
// Raisons de perte (« Leçons du mois »)
// ---------------------------------------------------------------------------

export const LOST_REASONS = [
  "Prix",
  "Timing",
  "Concurrent",
  "Pas de besoin",
  "Injoignable",
  "Autre",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

const REASON_SEP = " : ";

export function formatRaisonPerte(raison: LostReason, note: string): string {
  const n = note.trim();
  return n ? `${raison}${REASON_SEP}${n}` : raison;
}

/** « Prix : budget plafonné » → { raison: "Prix", lecon: "budget plafonné" }. */
export function parseRaisonPerte(text: string | null): {
  raison: LostReason | null;
  lecon: string | null;
} {
  const t = (text ?? "").trim();
  if (!t) return { raison: null, lecon: null };
  for (const r of LOST_REASONS) {
    if (t === r) return { raison: r, lecon: null };
    if (t.startsWith(`${r}${REASON_SEP}`)) {
      const rest = t.slice(r.length + REASON_SEP.length).trim();
      return { raison: r, lecon: rest || null };
    }
  }
  return { raison: "Autre", lecon: t };
}

// ---------------------------------------------------------------------------
// Dates (fuseau Europe/Zurich explicite : rendu serveur = rendu navigateur)
// ---------------------------------------------------------------------------

const DM = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Zurich",
});
const DMY = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Zurich",
});
const HM = new Intl.DateTimeFormat("fr-CH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Zurich",
});

/** « 28.10 » */
export function formatDayMonth(d: Date | string): string {
  return DM.format(typeof d === "string" ? new Date(d) : d);
}

/** « 28.10.2026 » */
export function formatDayMonthYear(d: Date | string): string {
  return DMY.format(typeof d === "string" ? new Date(d) : d);
}

/** « 09:30 » */
export function formatHourMinute(d: Date | string): string {
  return HM.format(typeof d === "string" ? new Date(d) : d);
}

/** Libellé court d'une action planifiée (« Appel prévu », « RDV visio »...). */
export function nextActionLabel(type: ActivityType): string {
  if (type === "APPEL_SORTANT") return "Appel prévu";
  if (type === "NOTE") return "Tâche";
  return getActivityTypeLabel(type);
}

export function pluralize(n: number, singular: string, pluralForm?: string): string {
  return n >= 2 ? (pluralForm ?? `${singular}s`) : singular;
}
