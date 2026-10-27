/**
 * Bandeau héros : dégradé navy, texte blanc, rayon 24 px, motif décoratif
 * discret (cercles coral / violet en haut à droite + halo coral).
 * Une zone héros par écran : « où j'en suis et quoi faire maintenant ».
 *
 * Accepte toutes les props d'un <section> (aria-labelledby, id…).
 * Server-safe.
 *
 * Focus clavier : sur le navy, l'anneau par défaut des boutons (navy 50 %)
 * est invisible et le contour bleu des liens tombe à 2.3:1. Le panneau
 * redéfinit donc localement `--ring` et `--focus-ring` en blanc.
 */
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type HeroPanelProps = ComponentProps<"section">;

export function HeroPanel({ className, children, ...props }: HeroPanelProps) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[24px] bg-gradient-navy p-5 text-white shadow-arena-lg [--focus-ring:#ffffff] [--ring:#ffffff] sm:p-7",
        className,
      )}
      {...props}
    >
      <svg
        aria-hidden="true"
        width="420"
        height="420"
        viewBox="0 0 420 420"
        fill="none"
        className="pointer-events-none absolute -top-36 -right-32 -z-10 opacity-50 sm:-right-28"
      >
        <circle
          cx="210"
          cy="210"
          r="200"
          stroke="#F47174"
          strokeOpacity="0.22"
          strokeWidth="2"
        />
        <circle
          cx="210"
          cy="210"
          r="150"
          stroke="#F47174"
          strokeOpacity="0.16"
          strokeWidth="18"
        />
        <circle
          cx="210"
          cy="210"
          r="96"
          stroke="#7C5CFC"
          strokeOpacity="0.22"
          strokeWidth="2"
        />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 -z-10 size-72 rounded-full bg-coral-400/10 blur-3xl"
      />
      {children}
    </section>
  );
}
