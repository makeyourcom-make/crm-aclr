/**
 * Teintes et XP des activités (MYC Arena). Server-safe et client-safe.
 */
import type { ActivityStatut, ActivityType } from "@prisma/client";

import { XP_RULES, type Tone } from "@/lib/gamification/rules";

/** Pastille de statut d'activité. */
export const ACTIVITY_STATUT_TONE: Record<ActivityStatut, Tone> = {
  PLANIFIE: "blue",
  EN_COURS: "gold",
  FAIT: "green",
  MANQUE: "red",
  REPLANIFIE: "violet",
  ANNULE: "navy",
};

const RDV_TYPES: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];

/**
 * XP crédités par le moteur quand une activité passe à « fait » (même
 * barème que lib/gamification) : appel sortant +5, email envoyé +3,
 * RDV effectué +80 (rattaché à un client et déjà passé). 0 sinon.
 * Un appel sortant EN_COURS est déjà compté par le moteur (FAIT ou EN_COURS) :
 * le passer à « fait » ne rapporte rien de plus.
 */
export function xpForDone(a: {
  type: ActivityType;
  date: Date | string;
  statut?: ActivityStatut;
  prospectId?: string | null;
  prospect?: unknown;
}): number {
  if (a.type === "APPEL_SORTANT") return a.statut === "EN_COURS" ? 0 : XP_RULES.appel;
  if (a.type === "EMAIL_ENVOYE") return XP_RULES.email;
  if (RDV_TYPES.includes(a.type)) {
    const hasProspect = !!a.prospectId || !!a.prospect;
    const passed = new Date(a.date).getTime() <= Date.now();
    return hasProspect && passed ? XP_RULES.rdvEffectue : 0;
  }
  return 0;
}
