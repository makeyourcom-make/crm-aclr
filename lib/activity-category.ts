/**
 * Catégories d'activité (client-safe) pour le filtre agenda et les durées
 * d'affichage par type.
 */
import type { ActivityType } from "@prisma/client";

export type ActivityCategory = "rdv" | "mail" | "appel" | "autre";

export const ACTIVITY_CATEGORIES: { key: ActivityCategory; label: string }[] = [
  { key: "rdv", label: "RDV" },
  { key: "mail", label: "Mails" },
  { key: "appel", label: "Appels" },
  { key: "autre", label: "Autres" },
];

export const ALL_CATEGORY_KEYS: ActivityCategory[] = ACTIVITY_CATEGORIES.map(
  (c) => c.key,
);

/** Affichage par défaut de l'agenda : les rendez-vous seulement (demande
 *  d'Arthur) ; mails, appels et autres s'ajoutent d'un clic. */
export const DEFAULT_CATEGORY_KEYS: ActivityCategory[] = ["rdv"];

export function activityCategory(type: ActivityType): ActivityCategory {
  switch (type) {
    case "RDV_PHYSIQUE":
    case "RDV_VISIO":
    case "RDV_TELEPHONIQUE":
      return "rdv";
    case "EMAIL_ENVOYE":
    case "EMAIL_RECU":
      return "mail";
    case "APPEL_SORTANT":
    case "APPEL_ENTRANT":
      return "appel";
    default:
      return "autre"; // SMS, LINKEDIN, NOTE
  }
}

/**
 * Durée d'affichage par défaut sur l'agenda (en minutes), selon le type, quand
 * l'activité n'a pas de durée explicite : appels 30 min, mails et RDV 1 h.
 * Une durée saisie/redimensionnée à la main reste prioritaire.
 */
export function defaultDureeByType(type: ActivityType): number {
  switch (activityCategory(type)) {
    case "appel":
      return 30;
    case "mail":
    case "rdv":
      return 60;
    default:
      return 30;
  }
}
