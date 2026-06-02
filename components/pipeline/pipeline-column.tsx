"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { DealCard } from "@/components/pipeline/deal-card";
import { formatCHFCompact } from "@/lib/format";
import { getDealStageLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { DealStage } from "@prisma/client";
import type { DealForKanban } from "@/lib/queries/deals";

interface PipelineColumnProps {
  stage: DealStage;
  deals: DealForKanban[];
  totalMontant: number;
  totalPondere: number;
  onOpenDeal: (dealId: string) => void;
}

const STAGE_ACCENTS: Record<DealStage, string> = {
  DECOUVERTE: "border-t-slate-400",
  PROPOSITION: "border-t-blue-500",
  NEGOCIATION: "border-t-amber-500",
  SIGNE: "border-t-emerald-500",
  PERDU: "border-t-red-400",
};

export function PipelineColumn({
  stage,
  deals,
  totalMontant,
  totalPondere,
  onOpenDeal,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-full shrink-0 flex-col rounded-lg border border-border border-t-4 bg-muted/30 transition-colors sm:w-72",
        STAGE_ACCENTS[stage],
        isOver && "bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      {/* Header */}
      <div className="px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{getDealStageLabel(stage)}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {deals.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {formatCHFCompact(totalMontant)}
          {totalPondere !== totalMontant && (
            <span className="opacity-70">
              {" "}
              · pondéré {formatCHFCompact(totalPondere)}
            </span>
          )}
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} onOpen={onOpenDeal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-background/50 px-3 py-6 text-center text-xs text-muted-foreground">
            Glisse un deal ici
          </p>
        )}
      </div>
    </div>
  );
}
