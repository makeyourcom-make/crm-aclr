"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (/sw.js) au chargement — rend le CRM
 * installable en PWA. Silencieux : aucun impact visible, best-effort.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencieux : l'app fonctionne sans SW */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
