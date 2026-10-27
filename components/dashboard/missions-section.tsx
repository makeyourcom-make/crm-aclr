/**
 * Missions du jour (3 quêtes, +100 XP chacune) : anneaux de progression
 * alimentés par le moteur de jeu (objectifs QUOTIDIEN, sinon défauts).
 * Server-safe.
 */
import { ArrowRight, Check, Target } from "lucide-react";
import Link from "next/link";

import { MissionCard } from "@/components/arena/mission-card";
import { StatusPill, XpPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import type { Mission } from "@/lib/gamification/rules";

const ACTIONS: Record<Mission["key"], { href: string; label: (m: Mission) => string }> = {
  appels: {
    href: "/phoning",
    label: (m) => (m.current > 0 ? "Reprendre le phoning" : "Lancer le phoning"),
  },
  rdvPris: { href: "/prospects", label: () => "Voir mes entreprises" },
  propositions: { href: "/pipeline", label: () => "Ouvrir le pipeline" },
};

export function MissionsSection({ missions }: { missions: Mission[] }) {
  const done = missions.filter((m) => m.done).length;
  const enJeu = missions
    .filter((m) => !m.done)
    .reduce((s, m) => s + m.xpReward, 0);
  const gagnes = missions
    .filter((m) => m.done)
    .reduce((s, m) => s + m.xpReward, 0);

  return (
    <SectionCard
      title="Missions du jour"
      icon={Target}
      tone="coral"
      description={`${missions.length} quêtes · +${missions[0]?.xpReward ?? 100} XP chacune · ${done} / ${missions.length} terminée${missions.length > 1 ? "s" : ""} · la mission appels prolonge ta série`}
      action={
        enJeu > 0 ? (
          <XpPill xp={enJeu} label="en jeu" size="md" />
        ) : (
          <StatusPill tone="green" icon={Check} size="md">
            {`+${gagnes} XP gagnés`}
          </StatusPill>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {missions.map((m) => {
          const a = ACTIONS[m.key];
          return (
            <MissionCard
              key={m.key}
              mission={m}
              action={
                !m.done && a ? (
                  <Link
                    href={a.href}
                    className="inline-flex min-h-6 items-center gap-1 text-info-700 hover:underline"
                  >
                    {a.label(m)}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </SectionCard>
  );
}
