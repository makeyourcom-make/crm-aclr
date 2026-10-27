/**
 * Teintes MYC Arena du kanban des dossiers (client-safe).
 * Étapes : à faire (navy) · en cours (bleu) · en attente du client (violet,
 * comme l'attente client du planning) · à vérifier (or) · terminé (vert).
 */
import type { DossierPriorite, DossierStatut } from "@prisma/client";

import type { Tone } from "@/lib/gamification/rules";

export const DOSSIER_STATUT_TONE: Record<DossierStatut, Tone> = {
  A_FAIRE: "navy",
  EN_COURS: "blue",
  EN_ATTENTE: "violet",
  A_VERIFIER: "gold",
  TERMINE: "green",
};

/** Bouton de statut actif (fond clair + bord + texte de la teinte). */
export const DOSSIER_STATUT_ON: Record<DossierStatut, string> = {
  A_FAIRE: "border-navy-700 bg-navy-100 text-navy-700",
  EN_COURS: "border-info-500 bg-info-50 text-info-700",
  EN_ATTENTE: "border-lvl-500 bg-lvl-50 text-lvl-700",
  A_VERIFIER: "border-gold-500 bg-gold-50 text-gold-700",
  TERMINE: "border-win-500 bg-win-50 text-win-700",
};

export const DOSSIER_PRIORITE_TONE: Record<DossierPriorite, Tone> = {
  BASSE: "navy",
  NORMALE: "blue",
  HAUTE: "red",
};

/** Initiales « Arthur Chazelle » → « AC ». */
export function initialesDe(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "");
  return s.toUpperCase() || "?";
}
