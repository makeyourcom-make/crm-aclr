"use client";

/**
 * Colonne du Kanban (zone de dépôt dnd-kit) : bandeau de couleur, tuile
 * d'icône, nom, nombre de deals, probabilité par défaut de l'étape, total et
 * pondéré, puis les cartes. La colonne Signé porte ses confettis et rappelle
 * la remise à zéro mensuelle.
 */
import { useDroppable } from "@dnd-kit/core";
import type { DealStage } from "@prisma/client";

import { formatCHFCompact } from "@/lib/format";
import { DEAL_STAGE_PROBA_DEFAUT } from "@/lib/labels";
import type { PipelineDeal } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import { DraggableDealCard, type DealCardHandlers } from "./deal-card";
import { STAGE_META, pluralize } from "./pipeline-meta";

interface PipelineColumnProps extends DealCardHandlers {
  stage: DealStage;
  /** Cartes visibles (après filtres). */
  deals: PipelineDeal[];
  /** Nombre total de deals de l'étape (avant filtres). */
  totalCount: number;
  totalMontant: number;
  totalPondere: number;
  nowMs: number;
  monthLabel: string;
  resetLabel: string;
  /** Masquée sur téléphone (onglets d'étape). */
  hiddenOnMobile?: boolean;
}

const CONFETTI = [
  { top: 2, left: 6, w: 6, h: 12, round: false, color: "#F47174", rot: 24 },
  { top: 20, left: 30, w: 7, h: 7, round: true, color: "#F5A524", rot: 0 },
  { top: 4, left: 52, w: 5, h: 11, round: false, color: "#7C5CFC", rot: -30 },
  { top: 28, left: 70, w: 6, h: 12, round: false, color: "#3B6FF6", rot: 60 },
  { top: 6, left: 92, w: 7, h: 7, round: true, color: "#12A150", rot: 0 },
  { top: 30, left: 108, w: 5, h: 10, round: false, color: "#F47174", rot: -12 },
];

export function PipelineColumn({
  stage,
  deals,
  totalCount,
  totalMontant,
  totalPondere,
  nowMs,
  monthLabel,
  resetLabel,
  hiddenOnMobile = false,
  onOpen,
  onMove,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  const signe = stage === "SIGNE";
  const hidden = totalCount - deals.length;

  return (
    <section
      ref={setNodeRef}
      aria-label={`Colonne ${meta.label} : ${totalCount} ${pluralize(totalCount, "deal")}, ${formatCHFCompact(totalMontant)}`}
      className={cn(
        "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[20px] border px-3 pb-3 transition-shadow",
        meta.column,
        isOver && "ring-2 ring-lvl-500 ring-offset-2 ring-offset-background",
        hiddenOnMobile && "max-sm:hidden",
      )}
    >
      <div aria-hidden="true" className={cn("-mx-3 h-[5px]", meta.bar)} />

      {signe && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 h-11 w-[120px]"
        >
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute"
              style={{
                top: c.top,
                left: c.left,
                width: c.w,
                height: c.h,
                borderRadius: c.round ? 999 : 2,
                background: c.color,
                transform: `rotate(${c.rot}deg)`,
              }}
            />
          ))}
        </div>
      )}

      <header className="relative z-[1] flex flex-col gap-2 pt-1.5">
        {/* flex-wrap : à 250 px de large, « Proba » passe à la ligne au lieu
            d'être rogné par l'overflow de la colonne. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
              meta.tile,
            )}
          >
            <Icon className="size-4" />
          </span>
          <h2 className="font-display text-[17px] font-extrabold tracking-[-0.02em]">
            {meta.label}
          </h2>
          <span className="rounded-full border border-border-strong bg-card px-2 py-0.5 text-xs font-extrabold tabular-nums">
            {totalCount}
          </span>
          <span className="ml-auto text-xs font-bold whitespace-nowrap text-muted-foreground">
            Proba {DEAL_STAGE_PROBA_DEFAUT[stage]} %
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="score-number text-[22px]">{formatCHFCompact(totalMontant)}</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {signe ? `signés en ${monthLabel}` : `pondéré ${formatCHFCompact(totalPondere)}`}
          </span>
        </div>
        {signe && (
          <p className="text-xs font-bold text-win-700">
            Trophées du mois · remise à zéro le {resetLabel}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        {deals.map((d) => (
          <DraggableDealCard
            key={d.id}
            deal={d}
            nowMs={nowMs}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
      </div>

      {deals.length === 0 && (
        <div className="rounded-[14px] border-2 border-dashed border-border-strong bg-card px-3.5 py-5 text-center text-[13px] font-semibold text-muted-foreground">
          {totalCount === 0 ? meta.empty : "Aucun deal ne correspond au filtre."}
          <span className="mt-1 block text-xs font-medium">Glisse un deal ici</span>
        </div>
      )}
      {hidden > 0 && deals.length > 0 && (
        <p className="text-center text-xs font-semibold text-muted-foreground">
          {hidden} {pluralize(hidden, "deal masqué", "deals masqués")} par le filtre
        </p>
      )}
    </section>
  );
}
