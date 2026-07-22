"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Icon } from "@/components/icon";
import { DOSSIER_PRIORITE_BADGE, DOSSIER_PRIORITE_LABELS } from "@/lib/dossiers";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DossierForKanban } from "@/lib/queries/dossiers";

interface DossierCardProps {
  dossier: DossierForKanban;
  onOpen: (id: string) => void;
}

export function DossierCard({ dossier, onOpen }: DossierCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dossier.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue =
    dossier.echeance &&
    dossier.echeance < new Date() &&
    dossier.statut !== "TERMINE";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen(dossier.id);
      }}
      className={cn(
        "cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "ring-2 ring-primary",
        // Visible uniquement via « Voir les projets archivés » : on la distingue
        // du travail vivant sans la rendre illisible.
        dossier.archive && "bg-muted/40 opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
          {dossier.titre}
        </p>
        {dossier.priorite !== "NORMALE" && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
              DOSSIER_PRIORITE_BADGE[dossier.priorite],
            )}
          >
            {DOSSIER_PRIORITE_LABELS[dossier.priorite]}
          </span>
        )}
      </div>

      {dossier.prospect && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Icon name="Users" className="h-3 w-3" />
          {dossier.prospect.raisonSociale}
        </p>
      )}

      {dossier.echeance && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px]",
            isOverdue ? "text-red-600" : "text-muted-foreground",
          )}
        >
          <Icon name="Calendar" className="h-3 w-3" />
          {formatDate(dossier.echeance)}
          {isOverdue && " · en retard"}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="truncate">→ {dossier.assigneA.name}</span>
        <span className="flex shrink-0 items-center gap-2">
          {dossier.archive && (
            <span className="rounded-full bg-slate-200 px-1.5 text-[9px] font-medium text-slate-600">
              Archivée
            </span>
          )}
          {dossier.nbDocuments > 0 && (
            <span className="flex items-center gap-1" title="Documents joints">
              <Icon name="FileText" className="h-3 w-3" />
              {dossier.nbDocuments}
            </span>
          )}
          {dossier.nbUpdates > 0 && (
            <span className="flex items-center gap-1" title="Mises à jour">
              <Icon name="MessageSquare" className="h-3 w-3" />
              {dossier.nbUpdates}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
