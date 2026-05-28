"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Icon } from "@/components/icon";
import { formatCHFCompact, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DealForKanban } from "@/lib/queries/deals";

interface DealCardProps {
  deal: DealForKanban;
  onOpen: (dealId: string) => void;
}

export function DealCard({ deal, onOpen }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue =
    deal.closeAttenduLe &&
    deal.closeAttenduLe < new Date() &&
    deal.stage !== "SIGNE" &&
    deal.stage !== "PERDU";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Évite d'ouvrir si on est en train de drag
        if (isDragging) return;
        // Bypass le drag listener si pointer move est court (click pur)
        e.stopPropagation();
        onOpen(deal.id);
      }}
      className={cn(
        "cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "ring-2 ring-primary",
      )}
    >
      {/* Titre du deal */}
      <p className="line-clamp-2 text-sm font-medium leading-snug">
        {deal.titre}
      </p>

      {/* Prospect */}
      <p className="mt-1 text-xs text-muted-foreground">
        {deal.prospect.raisonSociale}
      </p>

      {/* Badge "En attente validation" si stage SIGNE */}
      {deal.stage === "SIGNE" && (
        <p className="mt-1 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
          ⏳ En attente validation admin
        </p>
      )}

      {/* Montant + probabilité */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatCHFCompact(Number(deal.montantPrevu))}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            deal.probabilite >= 70
              ? "bg-emerald-100 text-emerald-700"
              : deal.probabilite >= 40
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {deal.probabilite}%
        </span>
      </div>

      {/* Date close attendue */}
      {deal.closeAttenduLe && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px]",
            isOverdue ? "text-red-600" : "text-muted-foreground",
          )}
        >
          <Icon name="Calendar" className="h-3 w-3" />
          {formatDate(deal.closeAttenduLe)}
          {isOverdue && " · en retard"}
        </p>
      )}

      {/* Commerciale en bas (vue admin) */}
      {deal.assigneA && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          → {deal.assigneA.name}
        </p>
      )}
    </div>
  );
}
