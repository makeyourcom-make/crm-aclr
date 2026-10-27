/**
 * Médaillon de badge (56 px par défaut) : anneau de la teinte du badge,
 * icône au centre, pastille verte cochée si obtenu ; grisé + cadenas sinon.
 * Infobulle (survol / focus clavier) avec la condition du badge.
 *
 *   <BadgeMedal badge={badge} />
 *   <BadgeMedal badge={badge} size="lg" showLabel={false} interactive={false} />
 *
 * `interactive={false}` : pas d'infobulle ni de focus (à utiliser quand le
 * médaillon est déjà dans un bouton ou un lien).
 */
import {
  Check,
  Crosshair,
  Crown,
  FileCheck,
  Flame,
  Inbox,
  Lock,
  PhoneCall,
  Star,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BadgeState } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { TONE_HEX } from "./tones";

export const BADGE_ICONS: Record<BadgeState["key"], LucideIcon> = {
  "premier-sang": FileCheck,
  sniper: Crosshair,
  marathon: PhoneCall,
  "serie-de-feu": Flame,
  "closer-du-mois": Trophy,
  "inbox-zero": Inbox,
  legende: Crown,
  "grand-chelem": Star,
};

export type BadgeMedalSize = "sm" | "md" | "lg" | number;

const PX: Record<Exclude<BadgeMedalSize, number>, number> = {
  sm: 40,
  md: 56,
  lg: 72,
};

export interface BadgeMedalProps {
  badge: BadgeState;
  size?: BadgeMedalSize;
  /** Nom + statut sous le médaillon (défaut true). */
  showLabel?: boolean;
  /** Infobulle + focus clavier (défaut true). */
  interactive?: boolean;
  className?: string;
}

export function BadgeMedal({
  badge,
  size = "md",
  showLabel = true,
  interactive = true,
  className,
}: BadgeMedalProps) {
  const px = typeof size === "number" ? size : PX[size];
  const ring = Math.max(2, Math.round(px / 18));
  const iconPx = Math.round(px * 0.43);
  const chip = Math.max(16, Math.round(px * 0.39));
  const earned = badge.earned;
  const hex = TONE_HEX[badge.tone] ?? TONE_HEX.gold;
  const Icon = BADGE_ICONS[badge.key] ?? Star;
  const status = earned ? "Obtenu" : "À débloquer";
  const a11y = `Badge ${badge.label} : ${earned ? "obtenu" : "à débloquer"}. ${badge.description}`;

  const content = (
    <span
      className={cn(
        "inline-flex min-w-0 flex-col items-center gap-1.5 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="relative inline-flex shrink-0"
        style={{ width: px, height: px }}
      >
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full transition-transform duration-200",
            earned && "group-hover/medal:scale-105",
          )}
          style={{
            border: `${ring}px solid ${earned ? hex.solid : "#D5DAE6"}`,
            background: earned ? hex.soft : "#EEF0F6",
            color: earned ? hex.text : "#8A93A6",
            boxShadow: earned
              ? `inset 0 0 0 3px #FFFFFF, 0 6px 16px ${hex.solid}38`
              : "inset 0 0 0 3px #FFFFFF",
          }}
        >
          <Icon style={{ width: iconPx, height: iconPx }} strokeWidth={2} />
        </span>
        <span
          className={cn(
            "absolute -right-1 -bottom-0.5 flex items-center justify-center rounded-full border-2 border-white",
            earned ? "bg-win-700 text-white" : "bg-card text-muted-foreground ring-1 ring-border-strong",
          )}
          style={{ width: chip, height: chip }}
        >
          {earned ? (
            <Check style={{ width: chip * 0.55, height: chip * 0.55 }} strokeWidth={3.5} />
          ) : (
            <Lock style={{ width: chip * 0.5, height: chip * 0.5 }} strokeWidth={2.5} />
          )}
        </span>
      </span>
      {showLabel && (
        <>
          <span aria-hidden="true" className="text-[13px] leading-tight font-extrabold text-foreground">
            {badge.label}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold",
              earned ? "bg-win-50 text-win-700" : "bg-navy-50 text-muted-foreground",
            )}
          >
            {status}
          </span>
        </>
      )}
    </span>
  );

  if (!interactive) {
    return (
      <span role="img" aria-label={a11y} className="group/medal inline-flex">
        {content}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} role="img" aria-label={a11y} />}
        className="group/medal inline-flex cursor-default rounded-[14px] outline-none focus-visible:ring-3 focus-visible:ring-info-500/50"
      >
        {content}
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] flex-col items-start gap-0.5 rounded-[10px] bg-navy-700 px-3 py-2 text-left text-white">
        <span className="font-bold">
          {badge.label} · {status}
        </span>
        <span className="text-navy-200">{badge.description}</span>
      </TooltipContent>
    </Tooltip>
  );
}
