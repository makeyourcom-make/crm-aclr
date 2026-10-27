/**
 * Calculs purs du cockpit de phoning : combo, stats de session.
 * Entrées = appels RÉELS du jour (base de données) + appel en cours.
 *
 * Combo : appels enchaînés à moins de COMBO_GAP_MINUTES entre la fin d'un
 * appel (début + durée réelle) et le début du suivant. Le combo est « vivant »
 * tant qu'un appel est en cours ou que le dernier s'est terminé il y a moins
 * de COMBO_GAP_MINUTES ; sinon il retombe à 0.
 */
import type { ActivityResultat } from "@prisma/client";

import { isConversation, xpForCall } from "@/components/call/call-results";
import { COMBO_GAP_MINUTES, COMBO_STEPS, comboFor } from "@/lib/gamification/rules";

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

const GAP_MS = COMBO_GAP_MINUTES * 60_000;

export interface ComboState {
  /** Appels enchaînés en cours (0 si le combo est retombé). */
  current: number;
  mult: number;
  next: { minCalls: number; mult: number } | null;
  /** Palier courant (minCalls) pour la jauge vers le suivant. */
  floor: number;
  /** Meilleur enchaînement du jour. */
  best: number;
  /** Heure de fin du meilleur enchaînement (epoch ms). */
  bestAt: number | null;
  alive: boolean;
}

export function computeCombo(calls: CallPoint[], nowMs: number): ComboState {
  const sorted = [...calls].sort((a, b) => a.start - b.start);
  let chain = 0;
  let best = 0;
  let bestAt: number | null = null;
  let prevEnd: number | null = null;
  let anyOngoing = false;
  for (const c of sorted) {
    const end = c.ongoing
      ? Math.max(c.start, nowMs || c.start)
      : c.start + Math.max(0, c.duree2 ?? 0) * 1000;
    if (c.ongoing) anyOngoing = true;
    chain = prevEnd !== null && c.start - prevEnd <= GAP_MS ? chain + 1 : 1;
    if (chain >= best) {
      best = chain;
      bestAt = end;
    }
    prevEnd = Math.max(prevEnd ?? 0, end);
  }
  const alive =
    chain > 0 && (anyOngoing || (prevEnd !== null && nowMs > 0 && nowMs - prevEnd <= GAP_MS));
  const current = alive ? chain : 0;
  const { mult, next } = comboFor(current);
  // Palier courant = plus grand palier atteint (pour la jauge).
  const floor = COMBO_STEPS.reduce((f, s) => (current >= s.minCalls ? Math.max(f, s.minCalls) : f), 0);
  return { current, mult, next, floor, best, bestAt, alive };
}

/** « x1.5 », « x2 » */
export function multLabel(mult: number): string {
  return `x${Number.isInteger(mult) ? mult : mult.toFixed(1)}`;
}

export interface SessionStats {
  calls: number;
  conversations: number;
  interesses: number;
  rdv: number;
  xp: number;
  /** Taux de conversation 0-100. */
  taux: number;
}

export function sessionStats(calls: CallPoint[]): SessionStats {
  let conversations = 0;
  let interesses = 0;
  let rdv = 0;
  let xp = 0;
  for (const c of calls) {
    if (isConversation(c.resultat)) conversations++;
    if (c.resultat === "RDV_PRIS" || c.resultat === "INTERESSE_PAS_PRET") interesses++;
    if (c.resultat === "RDV_PRIS") rdv++;
    xp += xpForCall(c.resultat);
  }
  const n = calls.length;
  return {
    calls: n,
    conversations,
    interesses,
    rdv,
    xp,
    taux: n > 0 ? Math.round((conversations / n) * 100) : 0,
  };
}
