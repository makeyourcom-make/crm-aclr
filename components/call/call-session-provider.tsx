"use client";

/**
 * Provider du contexte d'appel en cours.
 *
 * Un seul appel actif possible à la fois (la commerciale ne peut pas être
 * sur deux lignes simultanément). État stocké dans un petit store externe
 * adossé à localStorage pour survivre à une navigation interne (et à un
 * rechargement) pendant l'appel ; synchronisé entre onglets.
 *
 * Store externe + useSyncExternalStore (et non useState + effet) : pas de
 * setState synchrone dans un effet (règle du compilateur React), et pas de
 * décalage d'hydratation (le serveur ne voit jamais de session).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { cancelCall, startCall } from "@/app/(app)/activites/actions";
import { useNow } from "@/components/call/clock";

const STORAGE_KEY = "myc.call.session";
/** Garde-fou : une session de plus de 2 h est considérée comme corrompue. */
const MAX_SESSION_MS = 2 * 3600_000;

export interface CallSession {
  /** id de l'Activity APPEL_SORTANT créée au démarrage */
  activityId: string;
  prospectId: string;
  prospectRaisonSociale: string;
  numero: string;
  /** timestamp de début (epoch ms) */
  startedAt: number;
}

interface CallSessionContextValue {
  session: CallSession | null;
  /** Durée écoulée en secondes (live). 0 si pas d'appel actif. */
  elapsedSeconds: number;
  startCallSession: (input: {
    prospectId: string;
    prospectRaisonSociale: string;
    numero: string;
  }) => Promise<void>;
  /** Termine la session côté client (après enregistrement du résultat). */
  endCallSession: () => void;
  /**
   * Annule la session SANS résultat : supprime l'appel EN_COURS créé au
   * démarrage (il ne compte plus comme appel passé) puis termine la session.
   */
  cancelCallSession: () => Promise<boolean>;
  /** Ouvre/ferme la modale de résultat sans tuer le state */
  resultModalOpen: boolean;
  openResultModal: () => void;
  closeResultModal: () => void;
}

const CallSessionContext = createContext<CallSessionContextValue | null>(null);

export function useCallSession() {
  const ctx = useContext(CallSessionContext);
  if (!ctx) {
    throw new Error(
      "useCallSession() doit être utilisé dans un <CallSessionProvider>.",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Store externe (module) adossé à localStorage
// ---------------------------------------------------------------------------

let current: CallSession | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function isValidSession(v: unknown): v is CallSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.activityId === "string" &&
    typeof s.prospectId === "string" &&
    typeof s.prospectRaisonSociale === "string" &&
    typeof s.numero === "string" &&
    typeof s.startedAt === "number"
  );
}

function readStorage(): CallSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValidSession(parsed) && Date.now() - parsed.startedAt < MAX_SESSION_MS) {
      return parsed;
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* corrompu / refusé → ignore */
  }
  return null;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  current = readStorage();
}

function emit() {
  for (const l of listeners) l();
}

function setStoredSession(next: CallSession | null) {
  current = next;
  hydrated = true;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota/refus → on continue en mémoire seulement */
  }
  emit();
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  current = readStorage();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): CallSession | null {
  ensureHydrated();
  return current;
}

function getServerSnapshot(): CallSession | null {
  return null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CallSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const now = useNow(1000, !!session);
  const elapsedSeconds =
    session && now > 0
      ? Math.max(0, Math.floor((now - session.startedAt) / 1000))
      : 0;

  const startCallSession = useCallback(
    async (input: {
      prospectId: string;
      prospectRaisonSociale: string;
      numero: string;
    }) => {
      const { toast } = await import("sonner");
      try {
        const res = await startCall({
          prospectId: input.prospectId,
          numero: input.numero,
        });
        if (!res.ok || !res.activityId) {
          toast.error(res.error ?? "Impossible de démarrer la session d'appel.");
          return;
        }
        setStoredSession({
          activityId: res.activityId,
          prospectId: input.prospectId,
          prospectRaisonSociale: input.prospectRaisonSociale,
          numero: input.numero,
          startedAt: Date.now(),
        });
      } catch (e) {
        console.error("[startCallSession] échec:", e);
        toast.error("Impossible de démarrer le suivi d'appel. Réessaie.");
      }
    },
    [],
  );

  const endCallSession = useCallback(() => {
    setStoredSession(null);
    setResultModalOpen(false);
  }, []);

  const cancelCallSession = useCallback(async () => {
    const s = current;
    if (!s) {
      endCallSession();
      return true;
    }
    const { toast } = await import("sonner");
    try {
      const res = await cancelCall(s.activityId);
      if (!res.ok) {
        toast.error(res.error ?? "Impossible d'annuler l'appel.");
        return false;
      }
    } catch (e) {
      console.error("[cancelCallSession] échec:", e);
      toast.error("Impossible d'annuler l'appel. Réessaie.");
      return false;
    }
    endCallSession();
    return true;
  }, [endCallSession]);

  const openResultModal = useCallback(() => setResultModalOpen(true), []);
  const closeResultModal = useCallback(() => setResultModalOpen(false), []);

  const value = useMemo<CallSessionContextValue>(
    () => ({
      session,
      elapsedSeconds,
      startCallSession,
      endCallSession,
      cancelCallSession,
      resultModalOpen,
      openResultModal,
      closeResultModal,
    }),
    [
      session,
      elapsedSeconds,
      startCallSession,
      endCallSession,
      cancelCallSession,
      resultModalOpen,
      openResultModal,
      closeResultModal,
    ],
  );

  return (
    <CallSessionContext.Provider value={value}>
      {children}
    </CallSessionContext.Provider>
  );
}
