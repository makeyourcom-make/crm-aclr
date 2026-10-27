/**
 * Pastilles MYC Arena (12 px 700, rayon 999, fond clair + texte foncé).
 *
 *   <LevelPill level={LevelInfo} />   « Niv. 3 · Closer » (violet)
 *   <StreakPill days={6} />           flamme coral + « 6 jours »
 *   <XpPill xp={50} />                « +50 XP » (or)
 *   <StatusPill tone="green">Signé</StatusPill>  point de couleur + libellé
 *
 * Variantes `dark` pour les fonds navy (héros, sidebar). Server-safe.
 */
import { Flame, Star, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { LevelInfo } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { formatInt, formatSignedXp, formatXp } from "./format";
import { TONE_CLASSES, type Tone } from "./tones";

export type PillSize = "sm" | "md" | "lg";

const SIZE: Record<PillSize, string> = {
  sm: "h-6 gap-1 px-2.5 text-xs [&_svg]:size-3.5",
  md: "h-8 gap-1.5 px-3 text-[13px] [&_svg]:size-4",
  lg: "h-11 gap-2 px-3.5 text-[15px] [&_svg]:size-[18px]",
};

const BASE =
  "inline-flex shrink-0 items-center rounded-full font-bold leading-none whitespace-nowrap [&_svg]:shrink-0";

/*
 * Fond des pastilles `dark` portant un texte coloré (or, violet) : puce navy
 * semi-opaque (comme la pastille « Combo x2 » de la maquette) et non un voile
 * blanc. Sur l'extrémité claire du dégradé héros (#2F4470), un voile blanc
 * 10 % ferait tomber l'or à 3.5:1 et le violet clair à 4.1:1 ; avec ce fond,
 * ≥ 6:1 sur toutes les teintes navy.
 */
const DARK_TINTED_CHIP = "bg-navy-700/70 ring-1 ring-inset ring-white/10";

// ---------------------------------------------------------------------------
// Niveau
// ---------------------------------------------------------------------------

export interface LevelPillProps {
  level: LevelInfo;
  size?: PillSize;
  /** `dark` : sur fond navy. */
  variant?: "light" | "dark";
  className?: string;
}

export function LevelPill({
  level,
  size = "sm",
  variant = "light",
  className,
}: LevelPillProps) {
  return (
    <span
      className={cn(
        BASE,
        SIZE[size],
        variant === "dark"
          ? cn(DARK_TINTED_CHIP, "text-lvl-200")
          : "bg-lvl-50 text-lvl-700",
        className,
      )}
    >
      <Star aria-hidden="true" className="fill-current" />
      <span>
        <span className="sr-only">Niveau {level.level} : </span>
        <span aria-hidden="true">Niv. {level.level} · </span>
        {level.name}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Série
// ---------------------------------------------------------------------------

export interface StreakPillProps {
  days: number;
  size?: PillSize;
  /** `light` (fond coral clair) · `outline` (blanc + bord) · `dark` (sur navy). */
  variant?: "light" | "outline" | "dark";
  /** N'affiche que le chiffre (le mot « jours » reste lu par les lecteurs d'écran). */
  compact?: boolean;
  className?: string;
}

export function StreakPill({
  days,
  size = "sm",
  variant = "light",
  compact = false,
  className,
}: StreakPillProps) {
  const n = Number.isFinite(days) ? Math.max(0, Math.round(days)) : 0;
  const word = n >= 2 ? "jours" : "jour";
  const lit = n > 0;
  return (
    <span
      className={cn(
        BASE,
        SIZE[size],
        variant === "light" && "bg-coral-50 text-coral-600",
        variant === "outline" && "border border-border bg-card text-foreground",
        variant === "dark" && "bg-white/10 text-white",
        className,
      )}
    >
      <Flame
        aria-hidden="true"
        className={cn(
          lit
            ? variant === "light"
              ? "fill-coral-100 text-coral-600"
              : "fill-coral-100 text-coral-500"
            : "text-subtle",
        )}
      />
      <span className="tabular-nums">
        <span className="sr-only">Série : </span>
        {formatInt(n)}
        <span className={compact ? "sr-only" : undefined}> {word}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

export interface XpPillProps {
  xp: number;
  /** Complément après « XP » (« / appel », « aujourd'hui »…). */
  label?: string;
  /**
   * `reward` (défaut, or clair, « +50 XP ») · `solid` (or vif, texte navy,
   * pour les puces dans un bouton ou un toast) · `score` (blanc + éclair,
   * sans « + », pour un score) · `dark` (sur navy).
   */
  variant?: "reward" | "solid" | "score" | "dark";
  size?: PillSize;
  className?: string;
}

export function XpPill({
  xp,
  label,
  variant = "reward",
  size = "sm",
  className,
}: XpPillProps) {
  const isScore = variant === "score";
  const text = isScore ? formatXp(xp) : formatSignedXp(xp);
  return (
    <span
      className={cn(
        BASE,
        SIZE[size],
        "font-extrabold tabular-nums",
        variant === "reward" && "bg-gold-50 text-gold-700",
        variant === "solid" && "bg-gold-500 text-navy-700",
        variant === "score" && "border border-border bg-card text-foreground",
        variant === "dark" && cn(DARK_TINTED_CHIP, "text-gold-500"),
        className,
      )}
    >
      {(isScore || variant === "dark") && (
        <Zap aria-hidden="true" className="fill-gold-500 text-gold-500" />
      )}
      <span>{text}</span>
      {label && (
        <span
          className={cn(
            "font-semibold",
            isScore ? "text-muted-foreground" : "opacity-90",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Statut
// ---------------------------------------------------------------------------

export interface StatusPillProps {
  tone: Tone;
  children: ReactNode;
  /** Point de couleur devant le libellé (défaut true). */
  dot?: boolean;
  /** Icône Lucide à la place du point. */
  icon?: LucideIcon;
  size?: PillSize;
  className?: string;
}

export function StatusPill({
  tone,
  children,
  dot = true,
  icon: Icon,
  size = "sm",
  className,
}: StatusPillProps) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.navy;
  return (
    <span className={cn(BASE, SIZE[size], t.bg, t.text, className)}>
      {Icon ? (
        <Icon aria-hidden="true" />
      ) : dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", t.solid)}
        />
      ) : null}
      {children}
    </span>
  );
}
