"use client";

/**
 * Provider du contexte d'appel en cours.
 *
 * Un seul appel actif possible à la fois (la commerciale ne peut pas être
 * sur deux lignes simultanément). État stocké en React + localStorage pour
 * survivre à une navigation interne pendant l'appel.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { startCall } from "@/app/(app)/activites/actions";

const STORAGE_KEY = "myc.call.session";

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
  endCallSession: () => void;
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

export function CallSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<CallSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restauration depuis localStorage au mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = JSON.parse(raw) as CallSession;
        // Garde-fou : on n'accepte que les sessions < 2h (sinon corruption)
        if (Date.now() - restored.startedAt < 2 * 3600_000) {
          setSession(restored);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      /* corrupted → ignore */
    }
  }, []);

  // Timer live
  useEffect(() => {
    if (!session) {
      setElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)),
      );
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  const startCallSession = useCallback(
    async (input: {
      prospectId: string;
      prospectRaisonSociale: string;
      numero: string;
    }) => {
      const res = await startCall({
        prospectId: input.prospectId,
        numero: input.numero,
      });
      if (!res.ok || !res.activityId) {
        const msg = res.error ?? "Impossible de démarrer la session d'appel.";
        const { toast } = await import("sonner");
        toast.error(msg);
        return;
      }
      const newSession: CallSession = {
        activityId: res.activityId,
        prospectId: input.prospectId,
        prospectRaisonSociale: input.prospectRaisonSociale,
        numero: input.numero,
        startedAt: Date.now(),
      };
      setSession(newSession);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      } catch {
        /* quota/refus → on continue en mémoire seulement */
      }
    },
    [],
  );

  const endCallSession = useCallback(() => {
    setSession(null);
    setResultModalOpen(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value: CallSessionContextValue = {
    session,
    elapsedSeconds,
    startCallSession,
    endCallSession,
    resultModalOpen,
    openResultModal: () => setResultModalOpen(true),
    closeResultModal: () => setResultModalOpen(false),
  };

  return (
    <CallSessionContext.Provider value={value}>
      {children}
    </CallSessionContext.Provider>
  );
}
