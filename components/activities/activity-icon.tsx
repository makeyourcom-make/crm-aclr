import { ActivityType } from "@prisma/client";

import { Icon } from "@/components/icon";
import { ACTIVITY_TYPE_ICONS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const COLORS: Record<ActivityType, { bg: string; fg: string }> = {
  APPEL_SORTANT: { bg: "bg-blue-100", fg: "text-blue-700" },
  APPEL_ENTRANT: { bg: "bg-cyan-100", fg: "text-cyan-700" },
  EMAIL_ENVOYE: { bg: "bg-violet-100", fg: "text-violet-700" },
  EMAIL_RECU: { bg: "bg-violet-100", fg: "text-violet-700" },
  RDV_PHYSIQUE: { bg: "bg-emerald-100", fg: "text-emerald-700" },
  RDV_VISIO: { bg: "bg-emerald-100", fg: "text-emerald-700" },
  RDV_TELEPHONIQUE: { bg: "bg-emerald-100", fg: "text-emerald-700" },
  SMS: { bg: "bg-amber-100", fg: "text-amber-700" },
  LINKEDIN: { bg: "bg-slate-100", fg: "text-slate-700" },
  NOTE: { bg: "bg-slate-100", fg: "text-slate-600" },
};

interface ActivityIconProps {
  type: ActivityType;
  className?: string;
  /** Taille du contenant (px). Default 36. */
  size?: number;
}

export function ActivityIcon({ type, className, size = 36 }: ActivityIconProps) {
  const palette = COLORS[type];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        palette.bg,
        palette.fg,
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon
        name={ACTIVITY_TYPE_ICONS[type]}
        className="h-4 w-4"
      />
    </div>
  );
}
