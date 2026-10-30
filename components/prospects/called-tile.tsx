"use client";

/**
 * Tuile « Entreprises appelées » avec mini-filtre de fenêtre (7 / 15 / 30 j).
 * Les trois valeurs sont pré-calculées côté serveur ; le toggle ne fait que
 * basculer l'affichage (aucun refetch). La tendance (vs 7 j précédents) n'a
 * de sens que sur la fenêtre 7 j, elle n'est montrée que dans ce cas.
 */
import { useState } from "react";

import { formatInt } from "@/components/arena";
import { cn } from "@/lib/utils";

type Fenetre = 7 | 15 | 30;

export interface CalledTileProps {
  d7: number;
  d15: number;
  d30: number;
  /** Nombre d'entreprises appelées sur les 7 jours précédant les 7 derniers. */
  prev7: number;
}

export function CalledTile({ d7, d15, d30, prev7 }: CalledTileProps) {
  const [fenetre, setFenetre] = useState<Fenetre>(7);
  const valeur = fenetre === 7 ? d7 : fenetre === 15 ? d15 : d30;
  const trend =
    fenetre === 7 && prev7 > 0 ? Math.round(((d7 - prev7) / prev7) * 100) : null;

  return (
    <div className="min-w-0 rounded-[14px] bg-white/8 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-navy-200">Entreprises appelées</p>
        <div
          role="group"
          aria-label="Fenêtre de temps"
          className="flex items-center gap-0.5 rounded-full bg-white/8 p-0.5"
        >
          {([7, 15, 30] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFenetre(f)}
              aria-pressed={fenetre === f}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors",
                fenetre === f
                  ? "bg-white text-navy-700"
                  : "text-navy-200 hover:text-white",
              )}
            >
              {f} j
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="score-number text-2xl">{formatInt(valeur)}</span>
        {trend !== null && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              trend > 0
                ? "bg-win-50 text-win-700"
                : trend < 0
                  ? "bg-alert-50 text-alert-700"
                  : "bg-navy-50 text-navy-500",
            )}
          >
            {trend > 0 ? "+" : ""}
            {trend} % vs 7 j précédents
          </span>
        )}
      </div>
    </div>
  );
}
