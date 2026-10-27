/**
 * Barre XP de niveau (dégradé coral, charte §2 : réservé aux CTA héros et aux
 * jauges XP).
 *
 * `className` s'applique à la PISTE : pour un fond navy, passer par exemple
 * `className="h-1.5 bg-navy-500"`. Option `shine` : reflet animé discret
 * (à réserver aux zones héros, désactivé si mouvement réduit).
 *
 * Server-safe (aucun hook).
 */
import { cn } from "@/lib/utils";

export interface XpBarProps {
  /** Progression 0-100 dans le niveau (LevelInfo.pct). */
  pct: number;
  className?: string;
  /** Nom accessible (défaut « Progression du niveau »). */
  label?: string;
  /** Reflet animé (héros uniquement). */
  shine?: boolean;
}

export function XpBar({ pct, className, label, shine = false }: XpBarProps) {
  const p = Number.isFinite(pct) ? Math.min(Math.max(Math.round(pct), 0), 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label ?? "Progression du niveau"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-valuetext={`${p} %`}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-navy-50",
        className,
      )}
    >
      <div
        className="relative h-full overflow-hidden rounded-full bg-gradient-coral transition-[width] duration-700 ease-out motion-safe:animate-meter-fill"
        style={{ width: `${p}%` }}
      >
        {shine && p > 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-white/35 motion-safe:animate-sheen motion-reduce:hidden"
          />
        )}
      </div>
    </div>
  );
}
