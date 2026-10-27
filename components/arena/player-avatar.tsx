/**
 * Avatar joueur rond à initiales (charte : LB coral, AC navy).
 *
 * Décoratif par défaut (aria-hidden : le nom est affiché à côté). Passer
 * `label` pour en faire une image nommée. Server-safe.
 */
import { cn } from "@/lib/utils";

import type { Tone } from "./tones";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | number;

const PX: Record<Exclude<AvatarSize, number>, number> = {
  xs: 28,
  sm: 36,
  md: 40,
  lg: 56,
};

/** Fond + texte par teinte, contraste ≥ 4.5:1 pour des initiales en 700-800. */
const AVATAR_TONE: Record<Tone, string> = {
  coral: "bg-coral-400 text-navy-700",
  navy: "bg-navy-100 text-navy-700",
  gold: "bg-gold-500 text-navy-700",
  green: "bg-win-50 text-win-700",
  blue: "bg-info-50 text-info-700",
  violet: "bg-lvl-50 text-lvl-700",
  teal: "bg-mail-50 text-mail-700",
  red: "bg-alert-50 text-alert-700",
};

export interface PlayerAvatarProps {
  initials: string;
  tone?: Tone;
  size?: AvatarSize;
  /** Nom accessible (sinon l'avatar est masqué aux lecteurs d'écran). */
  label?: string;
  className?: string;
}

export function PlayerAvatar({
  initials,
  tone = "coral",
  size = "md",
  label,
  className,
}: PlayerAvatarProps) {
  const px = typeof size === "number" ? size : PX[size];
  const text = (initials || "?").slice(0, 2).toUpperCase();
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-extrabold leading-none",
        AVATAR_TONE[tone] ?? AVATAR_TONE.coral,
        className,
      )}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(10, Math.round(px * 0.35)),
      }}
    >
      {text}
    </span>
  );
}

/** Teinte d'avatar par rôle : commerciale = coral, admin = navy. */
export function toneForRole(role: string | null | undefined): Tone {
  return role === "ADMIN" ? "navy" : "coral";
}

