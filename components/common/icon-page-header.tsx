/**
 * En-tête de page à tuile d'icône libre (Paramètres, Sécurité, Audit,
 * Documents…). Même gabarit que `PageHeader` (titre Bricolage 28 px 800,
 * description, actions à droite) mais l'icône et la teinte sont choisies par
 * la page quand aucune rubrique du jeu ne correspond.
 *
 * Pour les pages de la rubrique finance, préférer
 * `<PageHeader rubrique="finance" />`.
 *
 * Server-safe.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { cn } from "@/lib/utils";

interface IconPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}

export function IconPageHeader({
  title,
  description,
  actions,
  breadcrumb,
  icon: Icon,
  tone = "navy",
}: IconPageHeaderProps) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.navy;
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-[13px] sm:size-11 sm:rounded-[15px]",
              t.bg,
              t.text,
            )}
          >
            <Icon className="size-5 sm:size-[22px]" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] break-words text-foreground sm:text-[28px]">
              {title}
            </h1>
            {description && (
              <div className="mt-1 text-sm font-medium text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
