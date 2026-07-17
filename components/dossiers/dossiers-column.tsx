"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { DossierCard } from "@/components/dossiers/dossier-card";
import { DOSSIER_STATUT_ACCENTS, DOSSIER_STATUT_LABELS } from "@/lib/dossiers";
import { cn } from "@/lib/utils";

import type { DossierStatut } from "@prisma/client";
import type { DossierForKanban } from "@/lib/queries/dossiers";

interface DossiersColumnProps {
  /** Identifiant droppable — `${userId}:${statut}`, ou "TERMINE". */
  columnKey: string;
  statut: DossierStatut;
  /** Prénom du collaborateur ; vide pour la colonne commune « Terminé ». */
  assigneNom: string;
  dossiers: DossierForKanban[];
  onOpen: (id: string) => void;
}

export function DossiersColumn({
  columnKey,
  statut,
  assigneNom,
  dossiers,
  onOpen,
}: DossiersColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-full shrink-0 flex-col rounded-lg border border-border border-t-4 bg-muted/30 transition-colors sm:w-72",
        DOSSIER_STATUT_ACCENTS[statut],
        isOver && "bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-3 py-2.5">
        <h3 className="min-w-0 truncate text-sm font-semibold">
          {assigneNom && (
            <span className="text-muted-foreground">{assigneNom} · </span>
          )}
          {DOSSIER_STATUT_LABELS[statut]}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {dossiers.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={dossiers.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {dossiers.map((d) => (
            <DossierCard key={d.id} dossier={d} onOpen={onOpen} />
          ))}
        </SortableContext>

        {dossiers.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-background/50 px-3 py-6 text-center text-xs text-muted-foreground">
            Glisse un dossier ici
          </p>
        )}
      </div>
    </div>
  );
}
