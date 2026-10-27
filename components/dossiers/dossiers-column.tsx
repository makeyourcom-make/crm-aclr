"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { TONE_CLASSES } from "@/components/arena/tones";
import { DossierCard } from "@/components/dossiers/dossier-card";
import { DOSSIER_STATUT_TONE } from "@/components/dossiers/dossier-tones";
import { DOSSIER_STATUT_LABELS } from "@/lib/dossiers";
import { cn } from "@/lib/utils";

import type { DossierStatut } from "@prisma/client";
import type { DossierForKanban } from "@/lib/queries/dossiers";

interface DossiersColumnProps {
  /** Identifiant droppable : le statut (cf. `dossierColumnKey`). */
  columnKey: string;
  statut: DossierStatut;
  /** Prénom du collaborateur ; vide pour une colonne d'étape commune. */
  assigneNom: string;
  dossiers: DossierForKanban[];
  onOpen: (id: string) => void;
  /** Affiche l'assigné sur les cartes (vue « Tous » uniquement). */
  showAssignee?: boolean;
}

export function DossiersColumn({
  columnKey,
  statut,
  assigneNom,
  dossiers,
  onOpen,
  showAssignee = false,
}: DossiersColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  const tone = TONE_CLASSES[DOSSIER_STATUT_TONE[statut]];

  return (
    <section
      ref={setNodeRef}
      aria-label={`${DOSSIER_STATUT_LABELS[statut]} : ${dossiers.length} projet${dossiers.length > 1 ? "s" : ""}`}
      className={cn(
        "flex h-full w-full shrink-0 flex-col rounded-[18px] border border-border bg-ground transition-colors sm:w-[272px]",
        isOver && "bg-lvl-50/60 ring-2 ring-lvl-500",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
        <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-extrabold">
          <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", tone.solid)} />
          {assigneNom && <span className="text-muted-foreground">{assigneNom} · </span>}
          {DOSSIER_STATUT_LABELS[statut]}
        </h3>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums", tone.bg, tone.text)}>
          {dossiers.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
        <SortableContext items={dossiers.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {dossiers.map((d) => (
            <DossierCard key={d.id} dossier={d} onOpen={onOpen} showAssignee={showAssignee} />
          ))}
        </SortableContext>

        {dossiers.length === 0 && (
          <p className="rounded-[12px] border border-dashed border-border-strong bg-card/60 px-3 py-5 text-center text-xs font-semibold text-muted-foreground">
            Glisse un projet ici
          </p>
        )}
      </div>
    </section>
  );
}
