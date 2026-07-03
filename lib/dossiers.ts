/**
 * Constantes partagées (client-safe) du module Dossiers / suivi de tâches.
 * Aucun import serveur ici — utilisable dans les composants client du kanban.
 */
import type { DossierStatut, DossierPriorite } from "@prisma/client";

/** Ordre des colonnes du kanban (gauche → droite). */
export const DOSSIER_STATUTS: DossierStatut[] = [
  "A_FAIRE",
  "EN_COURS",
  "EN_ATTENTE",
  "TERMINE",
];

export const DOSSIER_STATUT_LABELS: Record<DossierStatut, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  EN_ATTENTE: "En attente",
  TERMINE: "Terminé",
};

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
