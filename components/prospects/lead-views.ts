/**
 * Vues rapides et filtre de fraîcheur de la liste Entreprises (paramètres
 * d'URL `vue` et `fraicheur`, en plus de ceux de ProspectListParamsSchema).
 * Client-safe : partagé entre la page (serveur) et la barre de filtres.
 */

export const PROSPECT_VUES = [
  "toutes",
  "chaudes",
  "jamais",
  "rdv",
  "relancer",
  "refroidit",
] as const;
export type ProspectVue = (typeof PROSPECT_VUES)[number];

export const VUE_META: Record<ProspectVue, { label: string; hint: string }> = {
  toutes: { label: "Toutes", hint: "Toute ta base" },
  chaudes: {
    label: "Les plus chaudes",
    hint: "RDV à venir, ou fiche engagée avec une action récente",
  },
  jamais: { label: "Jamais appelées", hint: "Leads en cours sans aucun appel" },
  rdv: { label: "RDV à venir", hint: "Un RDV est planifié dans le futur" },
  relancer: {
    label: "Propositions à relancer",
    hint: "Proposition envoyée sans nouvelle action depuis 3 jours",
  },
  refroidit: {
    label: "Qui refroidissent",
    hint: "Fiches contactées sans action depuis 7 à 30 jours",
  },
};

export const PROSPECT_FRAICHEURS = ["chaud", "tiede", "froid"] as const;
export type ProspectFraicheur = (typeof PROSPECT_FRAICHEURS)[number];

export const FRAICHEUR_LABEL: Record<ProspectFraicheur, string> = {
  chaud: "Moins de 7 jours",
  tiede: "7 à 30 jours (refroidit)",
  froid: "Plus de 30 jours ou jamais",
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseVue(v: string | string[] | undefined): ProspectVue {
  const s = first(v);
  return (PROSPECT_VUES as readonly string[]).includes(s ?? "")
    ? (s as ProspectVue)
    : "toutes";
}

export function parseFraicheur(
  v: string | string[] | undefined,
): ProspectFraicheur | undefined {
  const s = first(v);
  return (PROSPECT_FRAICHEURS as readonly string[]).includes(s ?? "")
    ? (s as ProspectFraicheur)
    : undefined;
}
