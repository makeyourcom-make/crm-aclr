"use client";

/**
 * Raccourcis clavier pour la vue Aujourd'hui.
 *
 * - `c`     : déclenche le clic sur le premier bouton "Appeler" visible
 * - `Espace`/`Enter` : marque la première activité comme faite (clic le 1er bouton "Marquer fait")
 *
 * Note : on évite les conflits — ne tire pas tant qu'un input/textarea/select
 * est focus, et ne se déclenche pas si une modale est ouverte (la modale
 * intercepte d'office le focus).
 */
import { useEffect } from "react";

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable === true
  );
}

export function TodayShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTextInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // `c` → premier bouton "Appeler" cliquable
      if (e.key === "c" || e.key === "C") {
        const callBtn = document.querySelector<HTMLElement>(
          'a[href^="tel:"]',
        );
        if (callBtn) {
          e.preventDefault();
          callBtn.click();
        }
      }

      // Espace ou Enter → premier bouton "Marquer fait"
      if (e.key === " " || e.key === "Enter") {
        const doneBtn = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button"),
        ).find((b) => b.textContent?.trim().toLowerCase().startsWith("marquer fait"));
        if (doneBtn) {
          e.preventDefault();
          doneBtn.click();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
