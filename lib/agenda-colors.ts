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
