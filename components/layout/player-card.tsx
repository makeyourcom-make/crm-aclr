/**
 * Carte « résultats » en bas de la sidebar navy : avatar, nom, rôle, puis
 * les deux chiffres qui comptent sur le mois (CA signé en CHF, RDV pris) et
 * la série (jours ouvrés d'affilée avec l'objectif d'appels atteint).
 * Alimentée par `getPlayerHeader` dans le layout (chiffres réels uniquement).
 */
import { Flame } from "lucide-react";

import { formatInt } from "@/components/arena/format";
import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { formatCHFCompact } from "@/lib/format";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { getRoleLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

const monthFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "UTC", month: "long" });

/** « AAAA-MM » → « octobre » (chaîne vide si invalide). */
function monthName(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  return m ? monthFmt.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))) : "";
}

const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export function PlayerCard({ player, role }: { player: PlayerHeader; role: Role }) {
  const streak = safe(player.streak);
  const ca = safe(player.month.caSigne);
  const rdv = safe(player.month.rdvPris);
  const month = monthName(player.month.monthKey);

  return (
    <div
      role="group"
      aria-label="Tes résultats du mois"
      className="flex flex-col gap-3 rounded-[16px] bg-navy-600 p-3.5"
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar initials={player.initials} tone={toneForRole(role)} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{player.name}</p>
          <p className="truncate text-xs font-semibold text-navy-300">{getRoleLabel(role)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase">
          Ce mois{month && ` · ${month}`}
        </p>
        <dl className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-[12px] bg-navy-700/60 px-2.5 py-2">
            <dt className="truncate text-[11px] font-semibold text-navy-300">
              CA signé
            </dt>
            <dd className="truncate font-display text-[17px] leading-tight font-extrabold text-white tabular-nums">
              {formatCHFCompact(ca)}
            </dd>
          </div>
          <div className="min-w-0 rounded-[12px] bg-navy-700/60 px-2.5 py-2">
            <dt className="truncate text-[11px] font-semibold text-navy-300">
              RDV pris
            </dt>
            <dd className="truncate font-display text-[17px] leading-tight font-extrabold text-white tabular-nums">
              {formatInt(rdv)}
            </dd>
          </div>
        </dl>
      </div>

      <p
        className="flex items-center gap-1.5 text-xs font-semibold text-navy-200"
        title="Série : jours ouvrés d'affilée avec l'objectif d'appels atteint"
      >
        <Flame
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            streak > 0 ? "fill-coral-400/25 text-coral-400" : "text-navy-400",
          )}
        />
        <span className="tabular-nums">
          <span className="sr-only">Série : </span>
          <span className="font-extrabold text-white">{formatInt(streak)}</span>{" "}
          {streak >= 2 ? "jours" : "jour"} de série
        </span>
      </p>
    </div>
  );
}
