/**
 * Présentation des statuts d'entreprise (pastilles colorées,
 * étapes de l'entonnoir). Client-safe, sans dépendance serveur.
 *
 * Couleurs (charte §2, texte foncé sur fond clair, contraste ≥ 4.5:1) :
 * Nouveau navy · À attaquer coral pointillé · Contacté bleu · Qualifié teal ·
 * RDV pris violet · Proposition or · Signé vert · Perdu gris ·
 * Numéro invalide or pointillé · Ne pas rappeler gris.
 */
import type { ProspectStatut } from "@prisma/client";

import type { Tone } from "@/lib/gamification/rules";

export interface StatutMeta {
  /** Libellé affiché dans les pastilles. */
  label: string;
  /** Libellé court (entonnoir, étapes). */
  short: string;
  tone: Tone;
  /** Classes de la pastille (fond + texte + bord). */
  pill: string;
  /** Couleur vive (point, barre d'entonnoir). */
  solid: string;
  /** Couleur de texte seule (sur blanc). */
  text: string;
}

export const STATUT_META: Record<ProspectStatut, StatutMeta> = {
  NOUVEAU: {
    label: "Nouveau",
    short: "Nouveau",
    tone: "navy",
    pill: "bg-navy-50 text-navy-500 border-border-strong",
    solid: "bg-subtle",
    text: "text-navy-500",
  },
  VIERGE: {
    label: "À attaquer",
    short: "Vierge",
    tone: "coral",
    pill: "bg-coral-50 text-coral-600 border-dashed border-coral-400",
    solid: "bg-coral-400",
    text: "text-coral-600",
  },
  CONTACTE: {
    label: "Contacté",
    short: "Contacté",
    tone: "blue",
    pill: "bg-info-50 text-info-700 border-info-50",
    solid: "bg-info-500",
    text: "text-info-700",
  },
  QUALIFIE: {
    label: "Qualifié",
    short: "Qualifié",
    tone: "teal",
    pill: "bg-mail-50 text-mail-700 border-mail-50",
    solid: "bg-mail-500",
    text: "text-mail-700",
  },
  RDV_PRIS: {
    label: "RDV pris",
    short: "RDV pris",
    tone: "violet",
    pill: "bg-lvl-50 text-lvl-700 border-lvl-50",
    solid: "bg-lvl-500",
    text: "text-lvl-700",
  },
  PROPOSITION_ENVOYEE: {
    label: "Proposition envoyée",
    short: "Proposition",
    tone: "gold",
    pill: "bg-gold-50 text-gold-700 border-gold-50",
    solid: "bg-gold-500",
    text: "text-gold-700",
  },
  SIGNE: {
    label: "Signé",
    short: "Signé",
    tone: "green",
    pill: "bg-win-50 text-win-700 border-win-50",
    solid: "bg-win-500",
    text: "text-win-700",
  },
  PERDU: {
    label: "Perdu",
    short: "Perdu",
    tone: "navy",
    pill: "bg-navy-50 text-muted-foreground border-border-strong",
    solid: "bg-subtle",
    text: "text-muted-foreground",
  },
  NUMERO_INVALIDE: {
    label: "Numéro invalide",
    short: "Numéro invalide",
    tone: "gold",
    pill: "bg-gold-50 text-gold-700 border-dashed border-gold-500",
    solid: "bg-gold-500",
    text: "text-gold-700",
  },
  NE_PAS_RAPPELER: {
    label: "Ne pas rappeler",
    short: "Ne pas rappeler",
    tone: "navy",
    pill: "bg-muted text-muted-foreground border-border-strong",
    solid: "bg-subtle",
    text: "text-muted-foreground",
  },
};

/** Étapes de l'entonnoir (dans l'ordre du parcours commercial). */
export const FUNNEL_STEPS: ProspectStatut[] = [
  "NOUVEAU",
  "VIERGE",
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
  "SIGNE",
];

/** Sorties de l'entonnoir. */
export const FUNNEL_EXITS: ProspectStatut[] = [
  "PERDU",
  "NUMERO_INVALIDE",
  "NE_PAS_RAPPELER",
];

/** Étapes « un clic » de la fiche (progression vers la signature). */
export const STEPPER_STEPS: ProspectStatut[] = [
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
  "SIGNE",
];

/** Tous les statuts, dans l'ordre d'affichage du sélecteur complet. */
export const ALL_STATUTS: ProspectStatut[] = [
  "NOUVEAU",
  "VIERGE",
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
  "SIGNE",
  "PERDU",
  "NUMERO_INVALIDE",
  "NE_PAS_RAPPELER",
];

/** Libellé « long » du sélecteur (Vierge garde son nom métier). */
export function statutOptionLabel(s: ProspectStatut): string {
  if (s === "VIERGE") return "Vierge · à attaquer";
  return STATUT_META[s].label;
}
