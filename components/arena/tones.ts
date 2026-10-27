/**
 * Teintes Make Your Com (charte §2) : une teinte = un fond clair, un texte foncé,
 * une couleur vive pour les barres / anneaux.
 *
 * Toutes les classes sont écrites EN ENTIER (pas de concaténation) pour que
 * Tailwind v4 les détecte au scan des sources.
 *
 * Contrastes vérifiés (texte sur `bg`) : tous ≥ 4.5:1.
 */
import type { Tone } from "@/lib/gamification/rules";

export type { Tone };

export interface ToneClasses {
  /** Fond clair (pastilles, tuiles d'icône). */
  bg: string;
  /** Texte / icône foncé lisible sur `bg` et sur blanc. */
  text: string;
  /** Fond vif (remplissage de barre, point de statut). */
  solid: string;
  /** Couleur d'anneau / de contour (`ring-2 ${ring}`). */
  ring: string;
  /** Hex de la teinte vive (SVG, recharts, styles inline). */
  hex: string;
}

export const TONES: readonly Tone[] = [
  "coral",
  "navy",
  "green",
  "gold",
  "blue",
  "violet",
  "teal",
  "red",
] as const;

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  coral: {
    bg: "bg-coral-50",
    text: "text-coral-600",
    solid: "bg-coral-400",
    ring: "ring-coral-400",
    hex: "#F47174",
  },
  navy: {
    bg: "bg-navy-100",
    text: "text-navy-700",
    solid: "bg-navy-700",
    ring: "ring-navy-700",
    hex: "#0E1936",
  },
  green: {
    bg: "bg-win-50",
    text: "text-win-700",
    solid: "bg-win-500",
    ring: "ring-win-500",
    hex: "#12A150",
  },
  gold: {
    bg: "bg-gold-50",
    text: "text-gold-700",
    solid: "bg-gold-500",
    ring: "ring-gold-500",
    hex: "#F5A524",
  },
  blue: {
    bg: "bg-info-50",
    text: "text-info-700",
    solid: "bg-info-500",
    ring: "ring-info-500",
    hex: "#3B6FF6",
  },
  violet: {
    bg: "bg-lvl-50",
    text: "text-lvl-700",
    solid: "bg-lvl-500",
    ring: "ring-lvl-500",
    hex: "#7C5CFC",
  },
  teal: {
    bg: "bg-mail-50",
    text: "text-mail-700",
    solid: "bg-mail-500",
    ring: "ring-mail-500",
    hex: "#0EA5A4",
  },
  red: {
    bg: "bg-alert-50",
    text: "text-alert-700",
    solid: "bg-alert-500",
    ring: "ring-alert-500",
    hex: "#E5484D",
  },
};

/** Piste (fond) des jauges et anneaux, une teinte plus douce que la barre. */
export const TONE_TRACK: Record<Tone, string> = {
  coral: "bg-coral-100",
  navy: "bg-navy-50",
  green: "bg-win-50",
  gold: "bg-gold-50",
  blue: "bg-info-50",
  violet: "bg-lvl-50",
  teal: "bg-mail-50",
  red: "bg-alert-50",
};

/** Hex pour le SVG : piste douce, couleur vive, texte foncé. */
export const TONE_HEX: Record<Tone, { soft: string; solid: string; text: string }> = {
  coral: { soft: "#FFE0E1", solid: "#F47174", text: "#C8323A" },
  navy: { soft: "#E3E7F2", solid: "#0E1936", text: "#0E1936" },
  green: { soft: "#E3F7EB", solid: "#12A150", text: "#0B7A3B" },
  gold: { soft: "#FFF4DC", solid: "#F5A524", text: "#8A5300" },
  blue: { soft: "#E8EEFF", solid: "#3B6FF6", text: "#2350C9" },
  violet: { soft: "#EFEAFF", solid: "#7C5CFC", text: "#5B3FD6" },
  teal: { soft: "#DDF6F5", solid: "#0EA5A4", text: "#0A6F6E" },
  red: { soft: "#FDE7E8", solid: "#E5484D", text: "#B42328" },
};

/** Couleurs des confettis (charte §4). */
export const CONFETTI_COLORS = [
  "#F47174",
  "#F5A524",
  "#7C5CFC",
  "#3B6FF6",
  "#12A150",
] as const;
