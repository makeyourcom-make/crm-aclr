"use client";

/**
 * Classements de la période en onglets : Produits / Secteurs B2B / Cantons.
 * (Même contenu que les trois cartes d'avant, regroupé dans une seule carte.)
 */
import { useState } from "react";

import { RankingList, type RankingItem } from "./ranking-list";
import { SegmentGroup, segmentClass } from "./ui";

type TabKey = "produits" | "secteurs" | "cantons";

const TABS: { key: TabKey; label: string; tone: "violet" | "blue" | "teal"; empty: string; hint: string }[] = [
  {
    key: "produits",
    label: "Produits",
    tone: "violet",
    empty: "Aucun produit vendu sur cette période.",
    hint: "% = part des contrats signés contenant ce produit. CA = part de valeur an 1 attribuée (répartie à parts égales entre les produits du contrat).",
  },
  {
    key: "secteurs",
    label: "Secteurs B2B",
    tone: "blue",
    empty: "Aucun contrat signé sur cette période.",
    hint: "% = part des signatures dans ce secteur d'activité.",
  },
  {
    key: "cantons",
    label: "Cantons",
    tone: "teal",
    empty: "Aucune signature sur cette période.",
    hint: "% = part des signatures dans ce canton (selon la fiche entreprise).",
  },
];

export function RankingsTabs({
  produits,
  secteurs,
  cantons,
}: {
  produits: RankingItem[];
  secteurs: RankingItem[];
  cantons: RankingItem[];
}) {
  const [tab, setTab] = useState<TabKey>("produits");
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const items = tab === "produits" ? produits : tab === "secteurs" ? secteurs : cantons;

  return (
    <div className="flex flex-col gap-4">
      <SegmentGroup label="Type de classement" muted className="w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={segmentClass(tab === t.key, "flex-1")}
          >
            {t.label}
          </button>
        ))}
      </SegmentGroup>
      <RankingList items={items} tone={current.tone} emptyMessage={current.empty} hint={current.hint} />
    </div>
  );
}
