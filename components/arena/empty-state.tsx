/**
 * État vide sympathique : icône dans une tuile flottante, titre Bricolage,
 * phrase d'encouragement et action.
 *
 *   <EmptyState icon={Inbox} title="Inbox zéro !"
 *               description="Plus aucun mail à traiter. Badge en vue."
 *               action={<Button>Lancer le phoning</Button>} />
 *
 * Server-safe.
 */
import { Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TONE_CLASSES, type Tone } from "./tones";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "blue",
  className,
}: EmptyStateProps) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.blue;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-border-strong bg-card/70 px-6 py-10 text-center",
        className,
      )}
    >
      <span aria-hidden="true" className="relative mb-1 flex size-16 items-center justify-center">
        <span className={cn("absolute inset-0 rotate-6 rounded-[20px]", t.bg)} />
        <span className="relative flex size-14 items-center justify-center rounded-[18px] border border-border bg-card shadow-arena">
          <Icon className={cn("size-7", t.text)} strokeWidth={2} />
        </span>
        <Sparkles className="absolute -top-1.5 -right-2 size-4 fill-gold-50 text-gold-500" />
      </span>
      <div className="font-display text-lg font-extrabold tracking-[-0.01em] text-foreground">
        {title}
      </div>
      {description && (
        <div className="max-w-sm text-sm text-muted-foreground">{description}</div>
      )}
      {action && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
