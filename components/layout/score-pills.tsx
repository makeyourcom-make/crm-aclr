/**
 * Pilules de la barre du haut : « XP du jour » (éclair or) + « série »
 * (flamme coral). Un seul lien vers l'écran du jour (Ma journée pour la
 * commerciale, Dashboard pour l'admin).
 *
 * Compactes sur téléphone (chiffres seuls, libellés lus par les lecteurs
 * d'écran), complètes sur grand écran.
 */
import { Flame, Zap } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

const PILL =
  "flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-foreground shadow-[0_1px_2px_rgba(14,25,54,0.04)] transition-colors group-hover:border-border-strong sm:h-11 sm:gap-2 sm:px-3.5";

export function ScorePills({
  player,
  role,
}: {
  player: PlayerHeader;
  role: Role;
}) {
  const href = role === "COMMERCIAL" ? "/aujourd-hui" : "/";
  const xp = Number.isFinite(player.xpToday) ? Math.max(0, player.xpToday) : 0;
  const streak = Number.isFinite(player.streak) ? Math.max(0, player.streak) : 0;

  return (
    <Link
      href={href}
      className="group flex shrink-0 items-center gap-1.5 rounded-full sm:gap-2"
      title="Score du jour et série en cours"
    >
      <span className={PILL}>
        <Zap
          aria-hidden="true"
          className="size-4 fill-gold-500 text-gold-500 sm:size-[18px]"
        />
        <span className="text-sm font-extrabold tabular-nums sm:text-[15px]">
          <span className="sr-only">Score du jour : </span>
          {formatInt(xp)} XP
        </span>
        <span className="hidden text-xs font-medium text-muted-foreground xl:inline">
          aujourd&apos;hui
        </span>
      </span>
      <span className={PILL}>
        <Flame
          aria-hidden="true"
          className={cn(
            "size-4 sm:size-[18px]",
            streak > 0 ? "fill-coral-100 text-coral-500" : "text-subtle",
          )}
        />
        <span className="text-sm font-extrabold tabular-nums sm:text-[15px]">
          <span className="sr-only">Série : </span>
          {formatInt(streak)}
          <span className="sr-only sm:not-sr-only">
            {" "}
            {streak >= 2 ? "jours" : "jour"}
          </span>
        </span>
      </span>
    </Link>
  );
}
