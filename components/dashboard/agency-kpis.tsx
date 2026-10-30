/**
 * KPI agence (vue admin) : signatures du mois, CA récurrent
 * mensuel, CA annuel vs même période l'an dernier. Pas de « commissions
 * acquises » ni « salaire prévu » ici : c'est la rémunération des
 * commerciales, pas pertinent au niveau direction.
 * Server-safe.
 */
import { FileSignature, Repeat, TrendingDown, TrendingUp } from "lucide-react";

import { StatusPill } from "@/components/arena/pills";
import { StatTile } from "@/components/arena/stat-tile";
import { formatNumber } from "@/lib/format";
import type { DashboardData } from "@/lib/queries/dashboard";

/**
 * Montant CHF en gros chiffre : « 186'400 CHF » (unité plus petite). Le
 * nombre et l'unité restent chacun d'un bloc mais l'unité peut passer à la
 * ligne : sur 4 colonnes (~1280 px) « 21'350 CHF / mois » débordait la tuile.
 */
function Chf({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <>
      <span className="whitespace-nowrap">{formatNumber(Math.round(value))}</span>{" "}
      <span className="font-sans text-base font-bold tracking-normal whitespace-nowrap text-muted-foreground">
        CHF{suffix ? ` ${suffix}` : ""}
      </span>
    </>
  );
}

export function AgencyKpis({ data }: { data: DashboardData }) {
  const yoy = data.caAnnuel;
  const yoySub = !yoy ? undefined : yoy.variationPct === null ? (
    `depuis le 1er janvier ${yoy.annee}`
  ) : (
    <StatusPill
      tone={yoy.variationPct >= 0 ? "green" : "red"}
      icon={yoy.variationPct >= 0 ? TrendingUp : TrendingDown}
    >
      {`${yoy.variationPct >= 0 ? "+" : ""}${yoy.variationPct.toFixed(0)} % vs ${yoy.annee - 1}`}
    </StatusPill>
  );

  return (
    <section aria-label="Chiffres de l'agence" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
      <StatTile
        label="Signatures du mois"
        value={data.signaturesMois.count}
        sub="voir les contrats"
        icon={FileSignature}
        tone="navy"
        href="/contrats"
      />
      <StatTile
        label="CA récurrent mensuel"
        value={<Chf value={data.caRecurrentTotalMensuel ?? 0} suffix="/ mois" />}
        sub="facturé chaque mois"
        icon={Repeat}
        tone="violet"
      />
      <StatTile
        label={`CA ${yoy?.annee ?? ""} (annuel)`}
        value={<Chf value={yoy?.courant ?? 0} />}
        sub={yoySub}
        icon={TrendingUp}
        tone="gold"
      />
    </section>
  );
}
