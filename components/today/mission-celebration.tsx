"use client";

/**
 * Célébration « Mission pliée ! » (reprend et étend les cotillons de l'ancien
 * bandeau d'objectifs, qui fêtait l'objectif de RDV pris du jour).
 *
 * Quand une mission du jour (moteur de jeu) passe à « terminée », une rafale
 * de confettis + carte de victoire, UNE fois par mission et par jour (garde-fou
 * localStorage, comme avant). Rien n'est rendu : l'effet alimente le store de
 * `<CelebrationHost />` (layout), aucun état local.
 */
import { useEffect } from "react";

import { celebrate } from "@/components/arena/celebrate";
import type { Mission } from "@/lib/gamification/rules";

interface MissionCelebrationProps {
  missions: Mission[];
  /** Clé du jour « AAAA-MM-JJ » (Zurich). */
  todayKey: string;
  firstName: string;
}

interface DoneMission {
  key: Mission["key"];
  label: string;
  xp: number;
}

export function MissionCelebration({ missions, todayKey, firstName }: MissionCelebrationProps) {
  // Signature primitive des missions terminées : l'effet ne se relance que si
  // la liste change (le tableau `missions` change d'identité à chaque refresh).
  const doneSig = JSON.stringify(
    missions
      .filter((m) => m.done)
      .map((m): DoneMission => ({ key: m.key, label: m.label, xp: m.xpReward })),
  );

  useEffect(() => {
    const done = JSON.parse(doneSig) as DoneMission[];
    const fresh: DoneMission[] = [];
    for (const m of done) {
      const storageKey = `myc-mission-${todayKey}-${m.key}`;
      try {
        if (localStorage.getItem(storageKey)) continue;
        localStorage.setItem(storageKey, "1");
      } catch {
        // localStorage indisponible : on célèbre quand même.
      }
      fresh.push(m);
    }
    if (fresh.length === 0) return;
    celebrate({
      eyebrow: firstName ? `Bravo ${firstName}` : undefined,
      title: fresh.length > 1 ? `${fresh.length} missions pliées !` : "Mission pliée !",
      subtitle: fresh.map((m) => m.label).join(" · "),
      xp: fresh.reduce((s, m) => s + m.xp, 0),
    });
  }, [doneSig, todayKey, firstName]);

  return null;
}
