"use client";

/**
 * Horloge partagée (store externe) pour les chronos d'appel et de session.
 *
 * Pourquoi un store plutôt qu'un `setInterval` + `useState` dans un effet :
 *  - le compilateur React interdit le setState synchrone dans un effet et
 *    l'appel à `Date.now()` pendant le rendu (fonction impure) ;
 *  - un seul intervalle par période, quel que soit le nombre d'abonnés.
 *
 * Rendu serveur / hydratation : `getServerSnapshot` renvoie 0, le client
 * prend le relais dès l'abonnement (pas de décalage d'hydratation).
 */
import { useCallback, useSyncExternalStore } from "react";

interface Ticker {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const tickers = new Map<number, Ticker>();

function tickerFor(periodMs: number): Ticker {
  let t = tickers.get(periodMs);
  if (!t) {
    t = { now: 0, listeners: new Set(), timer: null };
    tickers.set(periodMs, t);
  }
  return t;
}

function subscribeTo(periodMs: number, listener: () => void): () => void {
  const t = tickerFor(periodMs);
  t.listeners.add(listener);
  if (!t.timer) {
    t.now = Date.now();
    t.timer = setInterval(() => {
      t.now = Date.now();
      for (const l of t.listeners) l();
    }, periodMs);
    // Valeur fraîche immédiate pour le premier abonné.
    queueMicrotask(() => {
      for (const l of t.listeners) l();
    });
  }
  return () => {
    t.listeners.delete(listener);
    if (t.listeners.size === 0 && t.timer) {
      clearInterval(t.timer);
      t.timer = null;
      // Plus personne à l'écoute : valeur « inconnue » (0) plutôt qu'une
      // heure périmée au prochain montage.
      t.now = 0;
    }
  };
}

const noopUnsubscribe = () => {};
const serverSnapshot = () => 0;

/**
 * Instant courant (epoch ms), rafraîchi toutes les `periodMs` millisecondes.
 * `enabled = false` : pas d'intervalle (renvoie la dernière valeur connue).
 * Vaut 0 au rendu serveur et pendant l'hydratation.
 */
export function useNow(periodMs = 1000, enabled = true): number {
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled ? subscribeTo(periodMs, listener) : noopUnsubscribe,
    [periodMs, enabled],
  );
  const getSnapshot = useCallback(() => tickerFor(periodMs).now, [periodMs]);
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
