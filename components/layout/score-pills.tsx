/**
 * Pilules de la barre du haut : « Aujourd'hui : N RDV pris (objectif) · N appels » + « série » (flamme coral). Un seul lien vers
 * l'écran du jour (Ma journée pour la commerciale, Dashboard pour l'admin).
 *
 * Compactes sur téléphone (chiffres seuls, libellés lus par les lecteurs
 * d'écran), complètes sur grand écran.
 */
import { CalendarCheck, Flame, Phone } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import type { PlayerHeader } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import type { Role } from "@prisma/client";

const PILL =
  "flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-foreground shadow-[0_1px_2px_rgba(14,25,54,0.04)] transition-colors group-hover:border-border-strong sm:h-11 sm:gap-2 sm:px-3.5";

const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export function ScorePills({ player, role }: { player: PlayerHeader; role: Role }) {
  const href = role === "COMMERCIAL" ? "/aujourd-hui" : "/";
  const appels = safe(player.today.appels);
  const rdv = safe(player.today.rdvPris);
  const target = safe(player.dailyTargets.rdvPris);
  const streak = safe(player.streak);

  return (
    <Link
      href={href}
      className="group flex shrink-0 items-center gap-1.5 rounded-full sm:gap-2"
      title={`Aujourd'hui : ${formatInt(rdv)} RDV pris sur ${formatInt(target)} · ${formatInt(appels)} appel${appels >= 2 ? "s" : ""} · série en cours`}
    >
      <span className={PILL}>
        <span className="sr-only">Aujourd&apos;hui : </span>
        <span aria-hidden="true" className="hidden text-xs font-semibold text-muted-foreground xl:inline">
          Aujourd&apos;hui
        </span>
        <span className="flex items-center gap-1 text-sm font-extrabold tabular-nums sm:text-[15px]">
          <Phone aria-hidden="true" className="size-4 text-coral-500 sm:size-[17px]" />
          {formatInt(appels)}
          <span className="sr-only lg:not-sr-only lg:font-semibold lg:text-muted-foreground">
            {" "}
            appel{appels >= 2 ? "s" : ""}
          </span>
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span className="flex items-center gap-1 text-sm font-extrabold tabular-nums sm:text-[15px]">
          <CalendarCheck aria-hidden="true" className="size-4 text-gold-700 sm:size-[17px]" />
          {formatInt(rdv)}
          <span className="hidden font-semibold text-muted-foreground lg:inline">
            {" "}
            / {formatInt(target)}
          </span>
          <span className="sr-only lg:not-sr-only lg:font-semibold lg:text-muted-foreground"> RDV</span>
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
          <span className="sr-only sm:not-sr-only"> {streak >= 2 ? "jours" : "jour"}</span>
        </span>
      </span>
    </Link>
  );
}
