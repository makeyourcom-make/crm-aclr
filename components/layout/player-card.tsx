/**
 * Carte joueur en bas de la sidebar navy : avatar, nom, niveau, barre XP,
 * série (flamme coral). Alimentée par `getPlayerHeader` dans le layout.
 */
import { Flame } from "lucide-react";

import { formatInt } from "@/components/arena/format";
import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { XpBar } from "@/components/arena/xp-bar";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  role,
}: {
  player: PlayerHeader;
  role: string;
}) {
  const { level } = player;
  const streak = Number.isFinite(player.streak) ? Math.max(0, player.streak) : 0;
  const isMax = level.nextXp === null;
  const progressText = isMax
    ? `${formatInt(level.xp)} XP · niveau max`
    : `${formatInt(level.xp)} / ${formatInt(level.nextXp)} XP`;
  const toNext =
    !isMax && level.xpToNext !== null && level.nextName
      ? `${formatInt(level.xpToNext)} XP avant ${level.nextName}`
      : undefined;

  return (
    <div
      role="group"
      aria-label="Ta carte joueur"
      className="flex flex-col gap-2.5 rounded-[16px] bg-navy-600 p-3.5"
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar initials={player.initials} tone={toneForRole(role)} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{player.name}</p>
          <p className="truncate text-xs font-semibold text-lvl-200">
            <span className="sr-only">Niveau {level.level} : </span>
            <span aria-hidden="true">Niv. {level.level} · </span>
            {level.name}
          </p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-white tabular-nums"
          title="Série : jours ouvrés d'affilée avec l'objectif d'appels atteint"
        >
          <Flame
            aria-hidden="true"
            className={cn(
              "size-[18px]",
              streak > 0 ? "fill-coral-400/25 text-coral-400" : "text-navy-400",
            )}
          />
          <span className="sr-only">Série : </span>
          {formatInt(streak)}
          <span className="sr-only"> {streak >= 2 ? "jours" : "jour"}</span>
        </span>
      </div>
      <XpBar
        pct={level.pct}
        className="h-1.5 bg-navy-500"
        label={isMax ? "Niveau maximum atteint" : `Progression vers ${level.nextName ?? "le niveau suivant"}`}
      />
      <p
        className="text-[11px] font-semibold text-navy-300 tabular-nums"
        title={toNext}
      >
        {progressText}
      </p>
    </div>
  );
}
