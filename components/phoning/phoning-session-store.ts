"use client";

/**
 * Session de phoning (côté navigateur) : début, pauses, prospects passés.
 *
 * Store externe adossé à localStorage (survit à la navigation et au
 * rechargement, synchronisé entre onglets), lu via useSyncExternalStore :
 * aucun setState synchrone dans un effet, aucun décalage d'hydratation.
 *
 * Une session est valable pour la journée (Europe/Zurich) : le lendemain,
 * elle repart de zéro. Les appels, XP et résultats affichés viennent TOUJOURS
 * de la base (appels du jour), la session ne fait que les borner dans le temps.
 */
import { useSyncExternalStore } from "react";

import { zDayKey } from "@/components/call/zurich";

const KEY = "myc.phoning.session";

export interface PhoningSession {
  /** Jour (AAAA-MM-JJ, Zurich) auquel se rapporte la session. */
  day: string;
  /** Début du chrono (epoch ms), null tant que la session n'est pas lancée. */
  startedAt: number | null;
  /** Début de la pause en cours (epoch ms), null si pas en pause. */
  pausedAt: number | null;
  /** Cumul des pauses terminées (ms). */
  pausedMs: number;
  /** Prospects « passés » sans appel pendant la session. */
  skipped: string[];
}

let state: PhoningSession | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function today(): string {
  return zDayKey(Date.now());
}

function isSession(v: unknown): v is PhoningSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.day === "string" &&
    (s.startedAt === null || typeof s.startedAt === "number") &&
    (s.pausedAt === null || typeof s.pausedAt === "number") &&
    typeof s.pausedMs === "number" &&
    Array.isArray(s.skipped)
  );
}

function read(): PhoningSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isSession(parsed) && parsed.day === today()) {
      return { ...parsed, skipped: parsed.skipped.filter((x) => typeof x === "string") };
    }
    localStorage.removeItem(KEY);
  } catch {
    /* corrompu / refusé */
  }
  return null;
}

function write(next: PhoningSession | null) {
  state = next;
  hydrated = true;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* mémoire seulement */
  }
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return;
  state = read();
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): PhoningSession | null {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    state = read();
  }
  // Session d'un autre jour : considérée comme absente (nettoyée à l'écriture).
  if (state && state.day !== today()) return null;
  return state;
}

const getServerSnapshot = () => null;

/** Session de phoning courante (null si aucune aujourd'hui). */
export function usePhoningSession(): PhoningSession | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function base(): PhoningSession {
  const cur = getSnapshot();
  return cur ?? { day: today(), startedAt: null, pausedAt: null, pausedMs: 0, skipped: [] };
}

/** Lance le chrono (sans effet si déjà lancé). */
export function startPhoningSession() {
  const cur = base();
  if (cur.startedAt) return;
  write({ ...cur, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
}

/** Pause / reprise du chrono. */
export function togglePhoningPause() {
  const cur = base();
  if (!cur.startedAt) return;
  const now = Date.now();
  if (cur.pausedAt) {
    write({ ...cur, pausedMs: cur.pausedMs + (now - cur.pausedAt), pausedAt: null });
  } else {
    write({ ...cur, pausedAt: now });
  }
}

/** Termine la session : remet le chrono et les prospects passés à zéro. */
export function endPhoningSession() {
  write(null);
}

/** Passe un prospect (il revient à la prochaine session). */
export function skipProspect(id: string) {
  const cur = base();
  if (cur.skipped.includes(id)) return;
  write({ ...cur, skipped: [...cur.skipped, id] });
}

/** Remet les prospects passés dans la file. */
export function clearSkipped() {
  const cur = base();
  write({ ...cur, skipped: [] });
}

/** Durée active de la session (ms), pauses déduites. */
export function activeDurationMs(s: PhoningSession | null, nowMs: number): number {
  if (!s?.startedAt || !nowMs) return 0;
  const paused = s.pausedMs + (s.pausedAt ? Math.max(0, nowMs - s.pausedAt) : 0);
  return Math.max(0, nowMs - s.startedAt - paused);
}
