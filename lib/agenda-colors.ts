/**
 * Palette de couleurs pour classer les tâches / activités de l'agenda.
 *
 * La couleur est stockée en clair (hex) sur `Activity.couleur`. Une valeur
 * NULL = pas de couleur choisie → l'agenda retombe sur la couleur dérivée du
 * statut (bleu = planifié, vert = fait, etc.).
 *
 * On garde une petite liste fixe (et non un color-picker libre) pour que les
 * couleurs restent cohérentes d'une tâche à l'autre et faciles à filtrer.
 */
export interface AgendaColor {
  /** Valeur stockée en base (hex, minuscules). */
  value: string;
  /** Libellé affiché (tooltip / légende). */
  label: string;
}

export const AGENDA_COLORS: AgendaColor[] = [
  { value: "#2563eb", label: "Bleu" },
  { value: "#0e1936", label: "Marine" },
  { value: "#f47174", label: "Corail" },
  { value: "#10b981", label: "Vert" },
  { value: "#f59e0b", label: "Ambre" },
  { value: "#a855f7", label: "Violet" },
  { value: "#ec4899", label: "Rose" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#64748b", label: "Ardoise" },
];

const COLOR_SET = new Set(AGENDA_COLORS.map((c) => c.value));

/** Normalise une valeur reçue du formulaire (hex minuscule) ou null. */
export function normalizeAgendaColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return COLOR_SET.has(v) ? v : null;
}

/** Libellé humain d'une couleur (ou null si inconnue). */
export function agendaColorLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return AGENDA_COLORS.find((c) => c.value === value.toLowerCase())?.label ?? null;
}

// ---------------------------------------------------------------------------
// Couleur dérivée du STATUT (quand aucune couleur n'a été choisie)
// ---------------------------------------------------------------------------

/**
 * Couleur pleine du bloc (vue Semaine/Jour) et de la pastille (vue Mois), par
 * statut — partagée pour qu'un même statut ait la même couleur partout.
 *
 * Teintes reprises de Google Agenda : rendu familier, et surtout des couleurs
 * déjà éprouvées pour porter du texte.
 */
export const STATUT_FILL: Record<string, string> = {
  PLANIFIE: "#1a73e8", // Bleuet
  EN_COURS: "#f9ab00", // Banane
  FAIT: "#0b8043", // Basilic — le "Sauge" (#33b679), plus clair, ne tient pas
  //                  le contraste avec du texte blanc (2.6:1).
  MANQUE: "#d93025", // Tomate
  REPLANIFIE: "#616161", // Graphite
  ANNULE: "#9e9e9e",
};

export const INK_DARK = "#1f2937";
export const INK_LIGHT = "#ffffff";

/** Luminance relative (formule W3C) d'une couleur #rrggbb ; null si invalide. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
}

/**
 * Encre (blanc ou gris foncé) offrant le MEILLEUR contraste sur `hex`.
 *
 * On compare les deux ratios plutôt que de trancher sur un seuil de luminance :
 * un seuil se règle bien pour les couleurs de statut, mais les teintes moyennes
 * d'AGENDA_COLORS (Vert #10b981, Ardoise #64748b…) tombent pile là où il se
 * trompe. Ici le pire cas reste le meilleur des deux, quelle que soit la teinte.
 */
export function textOn(hex: string): string {
  const L = luminance(hex);
  if (L === null) return INK_LIGHT;
  const ratio = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(L, luminance(INK_DARK)!) > ratio(L, luminance(INK_LIGHT)!)
    ? INK_DARK
    : INK_LIGHT;
}
