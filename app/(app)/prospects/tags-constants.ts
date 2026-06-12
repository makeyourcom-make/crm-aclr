/**
 * Constantes des tags entreprises — sorties du fichier "use server" pour
 * respecter la règle Next.js 16 :
 * https://nextjs.org/docs/messages/invalid-use-server-value
 *
 * Un fichier marqué "use server" ne peut exporter QUE des async functions.
 * Les constantes runtime (arrays, objects) et leurs types doivent vivre
 * ailleurs. Cf. bug du 11/06/2026 où ce fichier crashait la fiche prospect
 * (et donc le suivi d'appel click-to-call) sur l'erreur RSC
 * "found object" → digest 4171760897@E352.
 */

export const AVAILABLE_TAG_COLORS = [
  "slate",
  "blue",
  "emerald",
  "amber",
  "rose",
  "purple",
  "cyan",
  "orange",
] as const;

export type TagColorOption = (typeof AVAILABLE_TAG_COLORS)[number];
