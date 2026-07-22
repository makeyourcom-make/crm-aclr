/**
 * Constantes partagées (client-safe) du module Dossiers / suivi de tâches.
 * Aucun import serveur ici — utilisable dans les composants client du kanban.
 */
import type { DossierStatut, DossierPriorite } from "@prisma/client";

/**
 * Statuts proposés dans l'UI (ordre gauche → droite).
 *
 * EN_ATTENTE existe toujours dans l'enum Prisma (on ne retire pas une valeur
 * d'un enum Postgres en prod) mais n'est PLUS proposé : décision Arthur du
 * 17.07.2026 — le kanban se lit « à faire / à vérifier / terminé » par personne,
 * un dossier bloqué reste « à faire » chez son responsable. Plus aucune ligne
 * ne porte ce statut (migration scripts/migrate-dossiers-en-attente.ts).
 */
export const DOSSIER_STATUTS: DossierStatut[] = [
  "A_FAIRE",
  "EN_COURS",
  "TERMINE",
];

/** Statuts éclatés par collaborateur dans le kanban (TERMINE reste commun). */
export const DOSSIER_STATUTS_PAR_PERSONNE: DossierStatut[] = [
  "A_FAIRE",
  "EN_COURS",
];

export const DOSSIER_STATUT_LABELS: Record<DossierStatut, string> = {
  A_FAIRE: "À faire",
  // Libellé « À vérifier » (demande Arthur, 22.07.2026) : la colonne sert au
  // travail fait par la commerciale qui attend une relecture, pas au travail
  // en cours. La valeur d'enum reste EN_COURS — renommer une valeur d'enum
  // Postgres en prod n'apporterait rien et casserait les lignes existantes.
  EN_COURS: "À vérifier",
  EN_ATTENTE: "En attente",
  TERMINE: "Terminé",
};

/**
 * Clé d'une colonne du kanban. Les colonnes par personne encodent le couple
 * (collaborateur, statut) — déposer une carte dedans fixe donc les DEUX.
 * TERMINE est une colonne unique, commune : on y garde l'assignation d'origine.
 */
export function dossierColumnKey(
  statut: DossierStatut,
  assigneAId: string | null,
): string {
  return assigneAId ? `${assigneAId}:${statut}` : statut;
}

/** Inverse de `dossierColumnKey`. Renvoie null si la clé n'est pas une colonne. */
export function parseDossierColumnKey(
  key: string,
): { statut: DossierStatut; assigneAId: string | null } | null {
  const idx = key.lastIndexOf(":");
  if (idx === -1) {
    return DOSSIER_STATUTS.includes(key as DossierStatut)
      ? { statut: key as DossierStatut, assigneAId: null }
      : null;
  }
  const statut = key.slice(idx + 1) as DossierStatut;
  if (!DOSSIER_STATUTS_PAR_PERSONNE.includes(statut)) return null;
  return { statut, assigneAId: key.slice(0, idx) };
}

/** Liseré de couleur en haut de chaque colonne. */
export const DOSSIER_STATUT_ACCENTS: Record<DossierStatut, string> = {
  A_FAIRE: "border-t-slate-400",
  EN_COURS: "border-t-blue-500",
  EN_ATTENTE: "border-t-amber-500",
  TERMINE: "border-t-emerald-500",
};

export const DOSSIER_PRIORITE_LABELS: Record<DossierPriorite, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
};

/** Pastille de priorité (fond + texte). */
export const DOSSIER_PRIORITE_BADGE: Record<DossierPriorite, string> = {
  BASSE: "bg-slate-100 text-slate-600",
  NORMALE: "bg-blue-100 text-blue-700",
  HAUTE: "bg-red-100 text-red-700",
};

export function getDossierStatutLabel(s: DossierStatut): string {
  return DOSSIER_STATUT_LABELS[s];
}
