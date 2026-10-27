/**
 * Encart d'information MYC Arena (Kit : « padding 12 × 14, radius 14,
 * fond clair de la teinte, icône foncée, texte ink 13 px »).
 *
 * Remplace les anciennes astuces à emoji et les cartes ambrées.
 *
 *   <Callout tone="gold" icon={Lightbulb} title="Hors impôts">…</Callout>
 *
 * Server-safe.
 */
import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { cn } from "@/lib/utils";

export interface CalloutProps {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
  /** `role="status"` pour un message qui change (résultat d'action). */
  live?: boolean;
}

export function Callout({
  tone = "blue",
  icon: Icon = Info,
  title,
  className,
  children,
  live,
}: CalloutProps) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.blue;
  return (
    <div
      role={live ? "status" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[13px] leading-relaxed text-foreground",
        t.bg,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", t.text)} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-extrabold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
