"use client";

/**
 * Raccourcis clavier de « Ma journée ».
 *
 * - `c`               : lance le suivi d'appel du premier « Appeler » de la page
 *                       (bouton click-to-call marqué `data-today-call`)
 * - `Espace`/`Entrée` : marque faite la première action ouverte (premier bouton
 *                       `data-done-button` actif, hors RDV encore à venir)
 *
 * Garde-fous : rien ne se déclenche quand un champ de saisie a le focus ni
 * quand une boîte de dialogue est ouverte (modale de fin d'appel...) ; un
 * bouton (Espace / Entrée) ou un lien (Entrée) focalisé garde son
 * comportement natif (accessibilité clavier). « c » reste actif même si le
 * focus est resté sur un bouton cliqué à la souris.
 */
import { useEffect } from "react";

/** Champs de saisie : aucune touche ne doit être détournée. */
const TEXT_FIELDS = 'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]';
/** Éléments qu'Espace active nativement. */
const SPACE_ACTIVATES =
  'button, summary, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="tab"]';
/** Éléments qu'Entrée active nativement (liens compris). */
const ENTER_ACTIVATES = `${SPACE_ACTIVATES}, a[href], [role="link"]`;

function focusMatches(selector: string): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return false;
  return el.isContentEditable || !!el.closest(selector);
}

function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

export function TodayShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (focusMatches(TEXT_FIELDS) || dialogOpen()) return;

      // « c » n'a aucun effet natif : il marche même si le focus est resté
      // sur un lien ou un bouton cliqué à la souris (comportement historique).
      if (e.key === "c" || e.key === "C") {
        const callBtn = document.querySelector<HTMLButtonElement>(
          "[data-today-call] button:not([disabled])",
        );
        if (callBtn) {
          e.preventDefault();
          callBtn.click();
        }
        return;
      }

      if (e.key === " " || e.key === "Enter") {
        // Un élément focalisé qu'Espace / Entrée activent garde son
        // comportement natif (accessibilité clavier).
        if (focusMatches(e.key === "Enter" ? ENTER_ACTIVATES : SPACE_ACTIVATES)) return;
        const doneBtn = document.querySelector<HTMLButtonElement>(
          'button[data-done-button]:not([disabled]):not([data-future="true"])',
        );
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
