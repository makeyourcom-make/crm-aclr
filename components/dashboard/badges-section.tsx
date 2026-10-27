/**
 * Badges du joueur (8 médaillons, obtenus d'abord, grisés sinon), calculés
 * par le moteur de jeu (getPlayerStats().badges). Infobulle = condition.
 */
import { Medal } from "lucide-react";

import { BadgeMedal } from "@/components/arena/badge-medal";
import { SectionCard } from "@/components/arena/section-card";
import type { BadgeState } from "@/lib/gamification/rules";

export function BadgesSection({
  badges,
  className,
}: {
  badges: BadgeState[];
  className?: string;
}) {
  const earned = badges.filter((b) => b.earned);
  const next = badges.find((b) => !b.earned);
  const ordered = [...earned, ...badges.filter((b) => !b.earned)];

  return (
    <SectionCard
      title="Badges"
      icon={Medal}
      tone="violet"
      className={className}
      description={
        next
          ? `${earned.length} badge${earned.length > 1 ? "s" : ""} sur ${badges.length} · prochain à débloquer : ${next.label}`
          : `Les ${badges.length} badges sont à toi, légendaire`
      }
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
        {ordered.map((b) => (
          <li
            key={b.key}
            className={
              b.earned
                ? "flex justify-center rounded-[14px] bg-ground px-2 py-3"
                : "flex justify-center rounded-[14px] px-2 py-3"
            }
          >
            <BadgeMedal badge={b} />
          </li>
        ))}
      </ul>
      {next && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Pour débloquer {next.label} : {next.description.charAt(0).toLowerCase()}
          {next.description.slice(1)}.
        </p>
      )}
    </SectionCard>
  );
}
