"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, CalendarDays, Clock, FileText, MessageSquare } from "lucide-react";

import { PlayerAvatar } from "@/components/arena/player-avatar";
import { StatusPill } from "@/components/arena/pills";
import { DOSSIER_PRIORITE_TONE, initialesDe } from "@/components/dossiers/dossier-tones";
import { DOSSIER_PRIORITE_LABELS } from "@/lib/dossiers";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DossierForKanban } from "@/lib/queries/dossiers";

interface DossierCardProps {
  dossier: DossierForKanban;
  onOpen: (id: string) => void;
  /** Afficher l'assigné sur la carte : utile seulement dans la vue « Tous »,
   * redondant quand on est déjà dans l'espace d'une personne. */
  showAssignee?: boolean;
}

export function DossierCard({ dossier, onOpen, showAssignee = false }: DossierCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dossier.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue = !!dossier.echeance && new Date(dossier.echeance) < new Date() && dossier.statut !== "TERMINE";

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
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen(dossier.id);
        }
      }}
      className={cn(
        "cursor-grab rounded-[14px] border border-border bg-card p-3 shadow-[0_1px_2px_rgba(14,25,54,0.05)] transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-arena active:cursor-grabbing",
        isOverdue && "border-l-4 border-l-alert-500",
        isDragging && "ring-2 ring-lvl-500",
        // Visible uniquement via « Voir les projets archivés » : on la distingue
        // du travail vivant sans la rendre illisible.
        dossier.archive && "bg-ground opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm leading-snug font-extrabold">{dossier.titre}</p>
        {dossier.priorite !== "NORMALE" && (
          <StatusPill tone={DOSSIER_PRIORITE_TONE[dossier.priorite]} className="h-5 px-2 text-[11px]">
            {DOSSIER_PRIORITE_LABELS[dossier.priorite]}
          </StatusPill>
        )}
      </div>

      {dossier.prospect && (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Building2 aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{dossier.prospect.raisonSociale}</span>
        </p>
      )}

      {dossier.echeance && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1.5 text-xs font-bold",
            isOverdue ? "text-alert-700" : "text-muted-foreground",
          )}
        >
          {isOverdue ? (
            <Clock aria-hidden="true" className="size-3.5" />
          ) : (
            <CalendarDays aria-hidden="true" className="size-3.5" />
          )}
          {formatDate(dossier.echeance)}
          {isOverdue && " · en retard"}
        </p>
      )}

      {(showAssignee || dossier.archive || dossier.nbDocuments > 0 || dossier.nbUpdates > 0) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
          {showAssignee ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <PlayerAvatar initials={initialesDe(dossier.assigneA.name)} tone="navy" size={22} />
              <span className="truncate">{dossier.assigneA.name}</span>
            </span>
          ) : (
            <span />
          )}
          <span className="flex shrink-0 items-center gap-2">
            {dossier.archive && (
              <span className="rounded-full bg-navy-50 px-1.5 py-px text-[11px] font-bold text-muted-foreground">
                Archivée
              </span>
            )}
            {dossier.nbDocuments > 0 && (
              <span className="flex items-center gap-1" title="Documents joints">
                <FileText aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Documents : </span>
                {dossier.nbDocuments}
              </span>
            )}
            {dossier.nbUpdates > 0 && (
              <span className="flex items-center gap-1" title="Mises à jour">
                <MessageSquare aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Mises à jour : </span>
                {dossier.nbUpdates}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
