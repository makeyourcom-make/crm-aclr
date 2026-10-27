/**
 * Libellés partagés du module Charges (liste, détail, récurrences, filtres).
 * Valeurs identiques aux anciens dictionnaires locaux des pages.
 */
import type { Tone } from "@/components/arena/tones";

/** Libellé court d'une catégorie de charge (listes, pastilles). */
export const CATEGORIE_LABEL: Record<string, string> = {
  LOYER: "Loyer",
  SOFTWARE_SAAS: "Software",
  MARKETING: "Marketing",
  PUBLICITE: "Publicité",
  DEPLACEMENTS: "Déplacements",
  RESTAURATION: "Restauration",
  MATERIEL_BUREAU: "Matériel",
  ASSURANCES: "Assurances",
  TELECOM: "Télécom",
  FORMATION: "Formation",
  HONORAIRES: "Honoraires",
  IMPOTS: "Impôts",
  BANQUE_FRAIS: "Frais bancaires",
  AUTRE: "Autre",
};

/** Statut de paiement : libellé + teinte de pastille. */
export const STATUT_PAIEMENT_META: Record<string, { label: string; tone: Tone }> = {
  EN_ATTENTE: { label: "En attente", tone: "gold" },
  PAYE: { label: "Payé", tone: "green" },
  LITIGE: { label: "Litige", tone: "red" },
  REMBOURSE: { label: "Remboursé", tone: "blue" },
};

/** Fréquences des modèles récurrents. */
export const FREQ_LABEL: Record<string, string> = {
  MENSUEL: "Mensuel",
  BIMESTRIEL: "Bi-mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};
