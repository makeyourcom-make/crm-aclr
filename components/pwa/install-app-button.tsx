"use client";

/**
 * Bouton « Installer l'application » pour la PWA.
 *
 * - Chrome/Edge/Android : capte l'événement `beforeinstallprompt`, puis
 *   déclenche l'invite d'installation native au clic.
 * - iOS/Safari : pas de `beforeinstallprompt` → on affiche les instructions
 *   « Partager → Sur l'écran d'accueil ».
 * - Déjà installé (mode standalone) : le bouton se cache tout seul.
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Déjà installé / lancé en standalone → rien à proposer.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // empêche l'invite auto → on la déclenche au clic
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Rien à afficher : déjà installé, ou navigateur sans invite ni cas iOS.
  if (installed) return null;
  if (!deferred && !isIos) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    // iOS : pas d'invite programmatique → afficher les instructions.
    setShowIosHint((v) => !v);
  };

  return (
    <div className="mt-3 border-t border-sidebar-border px-1 pt-2">
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
      >
        <Icon name="Download" className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Installer l&apos;application</span>
      </button>
      {showIosHint && (
        <p className="mt-1 rounded-md bg-muted px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
          Sur iPhone/iPad : appuie sur <strong>Partager</strong> (carré avec une
          flèche) puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
        </p>
      )}
    </div>
  );
}
