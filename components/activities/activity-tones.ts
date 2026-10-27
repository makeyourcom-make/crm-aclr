/**
 * Teintes des activités. Server-safe et client-safe.
 */
import type { ActivityStatut } from "@prisma/client";

import type { Tone } from "@/lib/gamification/rules";

/** Pastille de statut d'activité. */
export const ACTIVITY_STATUT_TONE: Record<ActivityStatut, Tone> = {
  PLANIFIE: "blue",
  EN_COURS: "gold",
  FAIT: "green",
  MANQUE: "red",
  REPLANIFIE: "violet",
  ANNULE: "navy",
};
