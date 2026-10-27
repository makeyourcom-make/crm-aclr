/**
 * Carte de section : tuile d'icône colorée + titre Bricolage 20 px +
 * description, action à droite, contenu dessous.
 *
 *   <SectionCard title="Missions du jour" icon={Target} tone="coral"
 *                description="3 quêtes · +100 XP chacune"
 *                action={<XpPill xp={300} label="en jeu" />}>
 *     …
 *   </SectionCard>
 *
 * Server-safe.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TONE_CLASSES, type Tone } from "./tones";

export interface SectionCardProps {
  title: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  action?: ReactNode;
  description?: ReactNode;
  className?: string;
  /** Classes du conteneur de contenu (sous l'en-tête). */
  contentClassName?: string;
  id?: string;
  children?: ReactNode;
}

export function SectionCard({
  title,
  icon: Icon,
  tone = "navy",
  action,
  description,
  className,
  contentClassName,
  id,
  children,
}: SectionCardProps) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.navy;
  return (
    <section
      id={id}
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-[20px] border border-border bg-card p-5 text-card-foreground shadow-arena sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
                t.bg,
                t.text,
              )}
            >
              <Icon className="size-[18px]" strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-tight font-extrabold tracking-[-0.02em] text-foreground sm:text-xl">
              {title}
            </h2>
            {description && (
              <div className="mt-0.5 text-[13px] font-medium text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
        {action && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        )}
      </div>
      {children !== undefined && children !== null && children !== false && (
        <div className={cn("min-w-0", contentClassName)}>{children}</div>
      )}
    </section>
  );
}
