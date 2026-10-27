/**
 * Anneau de progression SVG (missions, objectifs, CA…).
 *
 * - `circle` + `stroke-dasharray`, départ à midi, extrémités arrondies.
 * - Se remplit à l'affichage (animation CSS `myc-ring-fill`, sans JS) puis
 *   glisse en douceur quand la valeur change (transition).
 * - Accessible : `role="img"` + `aria-label` explicite ; le contenu central
 *   est décoratif (aria-hidden), toute l'info doit être dans `label`.
 *
 * Server-safe (aucun hook).
 */
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { formatInt, ratioOf } from "./format";
import { TONE_HEX, type Tone } from "./tones";

export interface ProgressRingProps {
  value: number;
  max: number;
  /** Diamètre en px (défaut 96). */
  size?: number;
  /** Épaisseur du trait en px (défaut ≈ size / 10). */
  stroke?: number;
  tone?: Tone;
  /** Texte lu par les lecteurs d'écran (défaut : « 27 sur 40, 68 % »). */
  label?: string;
  /** Contenu central (décoratif). Défaut : le pourcentage. */
  children?: ReactNode;
  className?: string;
  /** Couleur de piste personnalisée (ex. sur fond navy : "#2F4470"). */
  trackColor?: string;
}

export function ProgressRing({
  value,
  max,
  size = 96,
  stroke,
  tone = "coral",
  label,
  children,
  className,
  trackColor,
}: ProgressRingProps) {
  const sw = stroke ?? Math.max(4, Math.round(size / 10));
  const r = Math.max(1, (size - sw) / 2);
  const c = 2 * Math.PI * r;
  const ratio = ratioOf(value, max);
  const pct = Math.round(ratio * 100);
  const offset = c * (1 - ratio);
  const hex = TONE_HEX[tone] ?? TONE_HEX.coral;
  const center = size / 2;
  const aria = label ?? `${formatInt(value)} sur ${formatInt(max)}, ${pct} %`;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={aria}
        className="block overflow-visible"
      >
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={trackColor ?? hex.soft}
          strokeWidth={sw}
        />
        {ratio > 0 && (
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={hex.solid}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c}
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-[stroke-dashoffset] duration-700 ease-out motion-safe:animate-ring-fill"
            style={
              {
                strokeDashoffset: offset,
                "--ring-c": c,
              } as CSSProperties
            }
          />
        )}
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none"
      >
        {/* Couleur héritée : navy dans une carte, blanc dans un HeroPanel. */}
        {children ?? (
          <span
            className="score-number"
            style={{ fontSize: Math.max(12, Math.round(size * 0.22)) }}
          >
            {pct} %
          </span>
        )}
      </div>
    </div>
  );
}
