/**
 * Couleurs des tags d'entreprise (valeur stockée en base : slate, blue,
 * emerald, amber, rose, purple, cyan, orange) → pastille.
 * Source unique pour la liste, la fiche et la gestion des tags.
 * Classes écrites en entier pour le scan Tailwind.
 */
export const TAG_COLOR_CLASSES: Record<string, string> = {
  slate: "bg-navy-50 text-navy-500",
  blue: "bg-info-50 text-info-700",
  emerald: "bg-win-50 text-win-700",
  amber: "bg-gold-50 text-gold-700",
  rose: "bg-coral-50 text-coral-600",
  purple: "bg-lvl-50 text-lvl-700",
  cyan: "bg-mail-50 text-mail-700",
  orange: "bg-orange-100 text-orange-800",
};

/** Pastille de couleur pleine (sélecteur de couleur de la gestion des tags). */
export const TAG_SWATCH_CLASSES: Record<string, string> = {
  slate: "bg-navy-100",
  blue: "bg-info-500",
  emerald: "bg-win-500",
  amber: "bg-gold-500",
  rose: "bg-coral-400",
  purple: "bg-lvl-500",
  cyan: "bg-mail-500",
  orange: "bg-orange-400",
};

/** Libellés français des couleurs (accessibilité du sélecteur). */
export const TAG_COLOR_LABELS: Record<string, string> = {
  slate: "Gris",
  blue: "Bleu",
  emerald: "Vert",
  amber: "Or",
  rose: "Corail",
  purple: "Violet",
  cyan: "Turquoise",
  orange: "Orange",
};
