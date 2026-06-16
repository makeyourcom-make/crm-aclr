"use client";

/**
 * État partagé "sidebar réduite" (mode client) : permet de masquer le bandeau
 * latéral pour centrer l'écran sur le contrat / la vente quand on est face
 * client. L'état est persisté dans localStorage.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarCtx = createContext<SidebarState>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebar(): SidebarState {
  return useContext(SidebarCtx);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarCtx.Provider>
  );
}
