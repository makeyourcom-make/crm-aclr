"use client";

/**
 * Indicateurs du pipeline (étapes actives : Découverte, Proposition,
 * Négociation) : valeur totale avec répartition, valeur pondérée, taux de
 * transformation du mois, deals à réveiller (bouton = filtre « À relancer »).
 */
import {
  AlarmClock,
  BarChart3,
  Scale,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { ProgressRing } from "@/components/arena";
import { formatCHFCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

import { pluralize } from "./pipeline-meta";

interface PipelineKpisProps {
  activeCount: number;
  total: number;
  pondere: number;
  repartition: { decouverte: number; proposition: number; negociation: number };
  dealsSignes: number;
  dealsPerdus: number;
  monthLabel: string;
  dormantCount: number;
  dormantValue: number;
  relancerActive: boolean;
  onToggleRelancer: () => void;
}

function pctOfTotal(x: number, total: number): number {
  return total > 0 ? Math.round((x / total) * 100) : 0;
}

export function PipelineKpis({
  activeCount,
  total,
  pondere,
  repartition,
  dealsSignes,
  dealsPerdus,
  monthLabel,
  dormantCount,
  dormantValue,
  relancerActive,
  onToggleRelancer,
}: PipelineKpisProps) {
  const clos = dealsSignes + dealsPerdus;
  const taux = clos > 0 ? Math.round((dealsSignes / clos) * 100) : 0;
  const pondPct = pctOfTotal(pondere, total);

  return (
    <section
      aria-label="Indicateurs du pipeline"
      className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))]"
    >
      <Kpi icon={SquareKanban} tile="bg-lvl-50 text-lvl-700" title="Valeur totale du pipe" value={formatCHFCompact(total)}>
        <div
          role="img"
          aria-label={`Répartition : Découverte ${formatCHFCompact(repartition.decouverte)}, Proposition ${formatCHFCompact(repartition.proposition)}, Négociation ${formatCHFCompact(repartition.negociation)}`}
          className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-navy-50"
        >
          <span className="bg-subtle" style={{ width: `${pctOfTotal(repartition.decouverte, total)}%` }} />
          <span className="bg-info-500" style={{ width: `${pctOfTotal(repartition.proposition, total)}%` }} />
          <span className="bg-gold-500" style={{ width: `${pctOfTotal(repartition.negociation, total)}%` }} />
        </div>
        <p className="text-[13px] font-medium text-muted-foreground">
          {activeCount} {pluralize(activeCount, "deal actif", "deals actifs")} · panier moyen{" "}
          {formatCHFCompact(activeCount ? total / activeCount : 0)}
        </p>
      </Kpi>

      <Kpi icon={Scale} tile="bg-info-50 text-info-700" title="Valeur pondérée" value={formatCHFCompact(pondere)}>
        <div
          role="img"
          aria-label={`Valeur pondérée : ${pondPct} % de la valeur totale`}
          className="h-2 overflow-hidden rounded-full bg-info-50"
        >
          <div className="h-2 rounded-full bg-info-500" style={{ width: `${pondPct}%` }} />
        </div>
        <p className="text-[13px] font-medium text-muted-foreground">
          Montant x probabilité : ce que ton pipe vaut vraiment
        </p>
      </Kpi>

      <Kpi
        icon={BarChart3}
        tile="bg-win-50 text-win-700"
        title="Taux de transformation"
        value={clos > 0 ? `${taux} %` : "-"}
        aside={
          <ProgressRing
            value={taux}
            max={100}
            size={64}
            stroke={8}
            tone="green"
            label={`Taux de transformation : ${taux} %`}
          >
            <span />
          </ProgressRing>
        }
      >
        <p className="text-[13px] font-medium text-muted-foreground">
          {clos > 0
            ? `${dealsSignes} ${pluralize(dealsSignes, "gagné", "gagnés")} sur ${clos} ${pluralize(clos, "deal clôturé", "deals clôturés")} en ${monthLabel}`
            : "Aucun deal clôturé ce mois"}
        </p>
      </Kpi>

      <button
        type="button"
        onClick={onToggleRelancer}
        aria-pressed={relancerActive}
        className={cn(
          "flex min-w-0 flex-col gap-2.5 rounded-[20px] border bg-card p-5 text-left shadow-arena transition-[box-shadow,border-color] hover:shadow-arena-lg",
          relancerActive ? "border-alert-500 ring-2 ring-alert-500" : "border-border",
        )}
      >
        <KpiHead
          icon={AlarmClock}
          tile={dormantCount > 0 ? "bg-alert-50 text-alert-700" : "bg-win-50 text-win-700"}
          title="À réveiller"
          heading={false}
        />
        <span className="score-number text-[32px] text-foreground">{dormantCount}</span>
        <span className="text-[13px] font-medium text-muted-foreground">
          {dormantCount > 0
            ? `${formatCHFCompact(dormantValue)} dorment depuis plus de 7 jours`
            : "Aucun deal endormi. Propre."}
        </span>
        <span
          className={cn(
            "text-[13px] font-bold",
            dormantCount > 0 ? "text-alert-700" : "text-win-700",
          )}
        >
          {relancerActive ? "Afficher tous les deals" : "Voir les deals à relancer"}
        </span>
      </button>
    </section>
  );
}

function KpiHead({
  icon: Icon,
  tile,
  title,
  heading = true,
}: {
  icon: LucideIcon;
  tile: string;
  title: string;
  /** false dans un bouton (pas de titre de section dans un contrôle). */
  heading?: boolean;
}) {
  const Title = heading ? "h3" : "span";
  // Un <h3> ne peut pas vivre dans un <span> : conteneur <div> hors bouton.
  const Root = heading ? "div" : "span";
  return (
    <Root className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-[12px]", tile)}
      >
        <Icon className="size-[18px]" />
      </span>
      <Title className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </Title>
    </Root>
  );
}

function Kpi({
  icon,
  tile,
  title,
  value,
  aside,
  children,
}: {
  icon: LucideIcon;
  tile: string;
  title: string;
  value: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-[20px] border border-border bg-card p-5 shadow-arena">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <KpiHead icon={icon} tile={tile} title={title} />
        <p className="score-number text-[32px] break-words text-foreground">{value}</p>
        {children}
      </div>
      {aside}
    </div>
  );
}
