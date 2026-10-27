"use client";

/**
 * État partagé "sidebar réduite" (mode client) : permet de masquer le bandeau
 * latéral pour centrer l'écran sur le contrat / la vente quand on est face
 * client. L'état est persisté dans localStorage (clé "sidebar-collapsed").
 *
 * Lu via useSyncExternalStore (pas de setState dans un effet) : rendu serveur
 * = déplié, puis valeur mémorisée dès l'hydratation. Synchronisé entre
 * onglets via l'événement `storage`. Si localStorage est indisponible
 * (navigation privée stricte), l'état reste en mémoire pour la session.
 */
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

const STORAGE_KEY = "sidebar-collapsed";

const listeners = new Set<() => void>();
let cached: boolean | null = null;

function readStorage(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getSnapshot(): boolean {
  if (cached === null) cached = readStorage();
  return cached;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = e.newValue === "1";
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function toggleCollapsed() {
  const next = !getSnapshot();
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Stockage indisponible : on garde l'état en mémoire.
  }
  for (const l of listeners) l();
}

const SidebarCtx = createContext<SidebarState>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebar(): SidebarState {
  return useContext(SidebarCtx);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle: toggleCollapsed }}>
      {children}
    </SidebarCtx.Provider>
  );
}
