import { ActivityType } from "@prisma/client";

import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { Icon } from "@/components/icon";
import { ACTIVITY_TYPE_ICONS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Teinte par type d'activité (couleurs de rubrique de la charte) :
 * appels = coral, emails = teal, RDV = or (agenda), SMS = violet,
 * LinkedIn = bleu, note = navy.
 */
export const ACTIVITY_TYPE_TONE: Record<ActivityType, Tone> = {
  APPEL_SORTANT: "coral",
  APPEL_ENTRANT: "coral",
  EMAIL_ENVOYE: "teal",
  EMAIL_RECU: "teal",
  RDV_PHYSIQUE: "gold",
  RDV_VISIO: "gold",
  RDV_TELEPHONIQUE: "gold",
  SMS: "violet",
  LINKEDIN: "blue",
  NOTE: "navy",
};

interface ActivityIconProps {
  type: ActivityType;
  className?: string;
  /** Taille du contenant (px). Default 36. */
  size?: number;
}

/**
 * Tuile d'icône colorée du type d'activité (fond clair + icône foncée).
 * Rayon proportionnel (tuile arrondie, ronde en très petit) ;
 * l'icône suit la taille du contenant (lisible de 12 à 44 px).
 */
export function ActivityIcon({ type, className, size = 36 }: ActivityIconProps) {
  const t = TONE_CLASSES[ACTIVITY_TYPE_TONE[type]] ?? TONE_CLASSES.navy;
  const iconPx = size >= 28 ? Math.min(20, Math.round(size * 0.46)) : Math.max(8, Math.round(size * 0.62));
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        t.bg,
        t.text,
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size >= 28 ? Math.round(size / 3) : 999,
      }}
      aria-hidden
    >
      <Icon
        name={ACTIVITY_TYPE_ICONS[type]}
        className="shrink-0"
        style={{ width: iconPx, height: iconPx }}
      />
    </div>
  );
}
