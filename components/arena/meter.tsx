/**
 * Jauge horizontale : valeur, objectif, pourcentage et ce qui reste
 * (« toujours les quatre », Kit §Jauges).
 *
 * - Passe automatiquement au VERT quand l'objectif est atteint.
 * - `role="progressbar"` + aria-valuetext explicite.
 * - Mode `segmented` (petits objectifs : 3 / 5 contrats) : une pastille par unité.
 *
 * Server-safe (aucun hook).
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { formatInt, ratioOf } from "./format";
import { TONE_CLASSES, TONE_TRACK, type Tone } from "./tones";

export type MeterSize = "sm" | "md" | "lg";

export interface MeterProps {
  value: number;
  max: number;
  tone?: Tone;
  /** Libellé à gauche (aussi utilisé comme nom accessible). */
  label?: string;
  /** Valeur affichée à droite (défaut : « 27 / 40 »). */
  valueLabel?: ReactNode;
  /** Phrase coach sous la jauge (« Encore 13 appels… »). */
  hint?: ReactNode;
  size?: MeterSize;
  /** Une pastille par unité (si max ≤ 20). */
  segmented?: boolean;
  /** Sur fond sombre (HeroPanel navy) : libellés clairs, piste translucide. */
  onDark?: boolean;
  className?: string;
}

const HEIGHT: Record<MeterSize, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-2.5",
};

export function Meter({
  value,
  max,
  tone = "coral",
  label,
  valueLabel,
  hint,
  size = "md",
  segmented = false,
  onDark = false,
  className,
}: MeterProps) {
  const reached = max > 0 && value >= max;
  const t: Tone = reached ? "green" : tone;
  const classes = TONE_CLASSES[t] ?? TONE_CLASSES.coral;
  const ratio = ratioOf(value, max);
  const pct = Math.round(ratio * 100);
  const safeMax = Math.max(0, max);
  const valueText = `${formatInt(value)} sur ${formatInt(max)}, ${pct} %`;
  const useSegments = segmented && safeMax > 0 && safeMax <= 20;
  const filled = Math.min(Math.max(Math.floor(value), 0), safeMax);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {(label || valueLabel !== undefined) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {label && (
            <span className={cn("min-w-0 text-[13px] font-bold", onDark ? "text-white" : "text-foreground")}>
              {label}
            </span>
          )}
          <span className={cn("ml-auto text-[13px] font-semibold tabular-nums", onDark ? "text-[#D1D6E3]" : "text-muted-foreground")}>
            {valueLabel ?? (
              <>
                <strong className={cn("font-display text-base font-extrabold", onDark ? "text-white" : "text-foreground")}>
                  {formatInt(value)}
                </strong>{" "}
                / {formatInt(max)}
              </>
            )}
          </span>
        </div>
      )}

      <div
        role="progressbar"
        aria-label={label ?? "Progression"}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(Math.max(value, 0), safeMax)}
        aria-valuetext={valueText}
        className={cn(
          "w-full",
          useSegments
            ? "grid gap-1"
            : cn("relative overflow-hidden rounded-full", HEIGHT[size], onDark ? "bg-white/15" : TONE_TRACK[t]),
        )}
        style={
          useSegments
            ? { gridTemplateColumns: `repeat(${safeMax}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {useSegments ? (
          Array.from({ length: safeMax }, (_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full transition-colors duration-500",
                HEIGHT[size],
                i < filled ? classes.solid : onDark ? "bg-white/15" : "bg-border",
              )}
            />
          ))
        ) : (
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out motion-safe:animate-meter-fill",
              classes.solid,
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {hint && (
        <span className={cn("text-xs font-bold", onDark ? "text-[#D1D6E3]" : classes.text)}>{hint}</span>
      )}
    </div>
  );
}
