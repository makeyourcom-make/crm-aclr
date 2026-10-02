/**
 * Constantes partagées (client-safe) du module Dossiers / suivi de tâches.
 * Aucun import serveur ici — utilisable dans les composants client du kanban.
 */
import type { DossierStatut, DossierPriorite } from "@prisma/client";

/**
 * Étapes du kanban, dans l'ordre gauche → droite (refonte « espaces », 02.10.2026).
 * Les colonnes sont désormais des ÉTAPES ; la PERSONNE est choisie via le
 * sélecteur d'espace (commercial = son espace, admin = n'importe lequel ou Tous).
 */
export const DOSSIER_STATUTS: DossierStatut[] = [
  "A_FAIRE",
  "EN_COURS",
  "EN_ATTENTE",
  "A_VERIFIER",
  "TERMINE",
];

export const DOSSIER_STATUT_LABELS: Record<DossierStatut, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  EN_ATTENTE: "En attente",
  A_VERIFIER: "À vérifier",
  TERMINE: "Terminé",
};

/**
 * Clé d'une colonne du kanban = le statut (l'espace sélectionne la personne).
 * Déposer une carte dans une colonne fixe donc son ÉTAPE, sans changer son
 * assignation.
 */
export function dossierColumnKey(statut: DossierStatut): string {
  return statut;
}

/** Inverse de `dossierColumnKey`. Renvoie null si la clé n'est pas une étape. */
export function parseDossierColumnKey(
  key: string,
): { statut: DossierStatut } | null {
  return DOSSIER_STATUTS.includes(key as DossierStatut)
    ? { statut: key as DossierStatut }
    : null;
}

/** Liseré de couleur en haut de chaque colonne. */
export const DOSSIER_STATUT_ACCENTS: Record<DossierStatut, string> = {
  A_FAIRE: "border-t-slate-400",
  EN_COURS: "border-t-blue-500",
  EN_ATTENTE: "border-t-amber-500",
  A_VERIFIER: "border-t-violet-500",
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

// ---------------------------------------------------------------------------
// ARCHIVAGE
// ---------------------------------------------------------------------------

/** Une tâche terminée depuis plus de N jours sort du kanban. */
export const ARCHIVE_APRES_JOURS = 7;

/**
 * Une tâche est « archivée » si elle est TERMINÉE depuis plus de
 * ARCHIVE_APRES_JOURS jours (décision Arthur, 22.07.2026).
 *
 * DÉLIBÉRÉMENT CALCULÉ, pas stocké : ni colonne, ni migration, et surtout pas
 * de cron nocturne qui pourrait échouer en silence et laisser la colonne
 * « Terminé » se remplir indéfiniment. La règle est donc toujours exacte.
 *
 * `termineLe` est renseigné à chaque passage en TERMINÉ (moveDossierStatut) ;
 * on retombe sur `updatedAt` par sécurité pour d'éventuelles lignes anciennes.
 */
export function estArchive(
  statut: DossierStatut,
  termineLe: Date | string | null,
  updatedAt: Date | string,
  maintenant: Date = new Date(),
): boolean {
  if (statut !== "TERMINE") return false;
  const ref = new Date(termineLe ?? updatedAt);
  const jours = (maintenant.getTime() - ref.getTime()) / 86_400_000;
  return jours > ARCHIVE_APRES_JOURS;
}
