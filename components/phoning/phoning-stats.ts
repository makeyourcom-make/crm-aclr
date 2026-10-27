/**
 * Calculs purs du cockpit de phoning : stats de session.
 * Entrées = appels RÉELS du jour (base de données) + appel en cours.
 */
import type { ActivityResultat } from "@prisma/client";

import { isConversation } from "@/components/call/call-results";

export interface CallPoint {
  id: string;
  /** Début (epoch ms). */
  start: number;
  /** Durée réelle en secondes, null si inconnue. */
  duree2: number | null;
  resultat: ActivityResultat | null;
  /** Appel en cours (session active). */
  ongoing?: boolean;
  prospectId: string | null;
  raisonSociale: string | null;
}

export interface SessionStats {
  calls: number;
  conversations: number;
  interesses: number;
  rdv: number;
  /** Taux de conversation 0-100 (décrochés / appels). */
  taux: number;
}

export function sessionStats(calls: CallPoint[]): SessionStats {
  let conversations = 0;
  let interesses = 0;
  let rdv = 0;
  for (const c of calls) {
    if (isConversation(c.resultat)) conversations++;
    if (c.resultat === "RDV_PRIS" || c.resultat === "INTERESSE_PAS_PRET") interesses++;
    if (c.resultat === "RDV_PRIS") rdv++;
  }
  const n = calls.length;
  return {
    calls: n,
    conversations,
    interesses,
    rdv,
    taux: n > 0 ? Math.round((conversations / n) * 100) : 0,
  };
}
