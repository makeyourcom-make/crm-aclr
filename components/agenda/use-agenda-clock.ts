"use client";

/**
 * Horloge et requêtes média de l'agenda, sans setState dans un effet :
 * `useSyncExternalStore` lit une source externe (l'heure, matchMedia).
 *
 * - Pendant l'hydratation, React utilise l'instantané SERVEUR : l'heure
 *   transmise par la page (`serverNowMs`), donc aucun écart de rendu entre le
 *   HTML serveur et le premier rendu client. L'heure réelle prend le relais
 *   juste après, puis se met à jour toutes les 30 s (ligne « maintenant »,
 *   comptes à rebours, RDV qui passent « à valider »).
 */
import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

function subscribeClock(onChange: () => void) {
  const id = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(id);
}

/** Minute courante (stable entre deux appels dans la même minute). */
function clockSnapshot(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/** Instant courant arrondi à la minute (ms). */
export function useNowMs(serverNowMs: number): number {
  return useSyncExternalStore(subscribeClock, clockSnapshot, () =>
    Math.floor(serverNowMs / 60_000) * 60_000,
  );
}

/** Vrai si la requête média correspond (faux côté serveur). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
