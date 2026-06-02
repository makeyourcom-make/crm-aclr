"use client";

/**
 * Le board Kanban du pipeline, avec drag & drop entre colonnes.
 *
 * Architecture @dnd-kit :
 *   - DndContext  : englobe tout
 *   - PipelineColumn (useDroppable) : chaque colonne est une zone droppable
 *   - DealCard (useSortable) : chaque carte est drag-and-droppable
 *   - PointerSensor avec activationConstraint = distance 5px → un click
 *     simple n'enclenche pas le drag (utile pour le onClick → open detail)
 *
 * Optimistic UI : on déplace la carte immédiatement dans l'état local,
 * et on déclenche moveDealStage server action en arrière-plan. Si elle
 * échoue, on rollback + toast erreur + refresh.
 */
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DealCard } from "@/components/pipeline/deal-card";
import { DealDetailSheet } from "@/components/pipeline/deal-detail-sheet";
import { PipelineColumn } from "@/components/pipeline/pipeline-column";
import { moveDealStage } from "@/app/(app)/pipeline/actions";
import { DEAL_STAGE_PROBA_DEFAUT } from "@/lib/labels";

import type { DealStage } from "@prisma/client";
import type { PipelineData } from "@/lib/queries/deals";

interface PipelineBoardProps {
  initialData: PipelineData;
  isAdmin: boolean;
}

export function PipelineBoard({ initialData, isAdmin }: PipelineBoardProps) {
  const router = useRouter();
  const [data, setData] = useState<PipelineData>(initialData);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [openedDealId, setOpenedDealId] = useState<string | null>(null);

  // Re-synchronise le state local quand le serveur re-fetch (router.refresh)
  // ou quand l'utilisateur change les filtres URL. Sans ça, le state initial
  // de useState reste figé sur le premier rendu, et l'optimistic UI ne se
  // corrige jamais avec les vraies données du serveur.
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px → différencie click et drag
    }),
  );

  // Map id deal → colonne actuelle (pour optimistic update)
  const dealById = useMemo(() => {
    const map = new Map<
      string,
      { stage: DealStage; index: number }
    >();
    for (const col of data.columns) {
      col.deals.forEach((d, i) => map.set(d.id, { stage: col.stage, index: i }));
    }
    return map;
  }, [data.columns]);

  const activeDeal = activeDealId
    ? data.columns
        .flatMap((c) => c.deals)
        .find((d) => d.id === activeDealId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    // Détermine le stage cible : la zone droppable (colonne) ou la carte sur laquelle on a lâché
    const overId = over.id as string;
    let targetStage: DealStage | undefined;

    if (
      overId === "DECOUVERTE" ||
      overId === "PROPOSITION" ||
      overId === "NEGOCIATION" ||
      overId === "SIGNE" ||
      overId === "PERDU"
    ) {
      targetStage = overId as DealStage;
    } else {
      // Lâché sur une carte → cherche la colonne de cette carte
      const dst = dealById.get(overId);
      if (dst) targetStage = dst.stage;
    }

    if (!targetStage) return;

    const current = dealById.get(dealId);
    if (!current || current.stage === targetStage) return;

    // ---- Optimistic update local ----
    setData((prev) => {
      const newColumns = prev.columns.map((c) => ({
        ...c,
        deals: [...c.deals],
      }));
      let moved: typeof newColumns[number]["deals"][number] | null = null;

      // Retire de la colonne source
      for (const c of newColumns) {
        const idx = c.deals.findIndex((d) => d.id === dealId);
        if (idx !== -1) {
          [moved] = c.deals.splice(idx, 1);
          break;
        }
      }
      if (!moved) return prev;

      // Met à jour le stage ET la probabilité par défaut (cohérent avec ce
      // que fait le serveur dans moveDealStage), insère dans la destination
      const dst = newColumns.find((c) => c.stage === targetStage);
      if (!dst) return prev;
      moved.stage = targetStage as DealStage;
      moved.probabilite = DEAL_STAGE_PROBA_DEFAUT[targetStage as DealStage];
      dst.deals.unshift(moved);

      // Recalcule les totaux
      for (const c of newColumns) {
        c.totalMontant = c.deals.reduce(
          (s, d) => s + Number(d.montantPrevu),
          0,
        );
        c.totalPondere = c.deals.reduce(
          (s, d) => s + (Number(d.montantPrevu) * d.probabilite) / 100,
          0,
        );
      }
      return {
        ...prev,
        columns: newColumns,
        grandTotal: newColumns.reduce((s, c) => s + c.totalMontant, 0),
        grandTotalPondere: newColumns.reduce(
          (s, c) => s + c.totalPondere,
          0,
        ),
      };
    });

    // ---- Server action en background ----
    const res = await moveDealStage({ dealId, newStage: targetStage });
    if (!res.ok) {
      toast.error(res.error ?? "Échec du déplacement.");
      // Rollback en re-fetchant
      router.refresh();
      return;
    }
    toast.success(`Déplacé vers « ${labelStage(targetStage)} »`);
    router.refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/*
        Mobile (<sm) : colonnes stackées verticalement, full width
        Desktop (≥sm) : Kanban horizontal scrollable
      */}
      <div className="flex flex-col gap-4 sm:flex-row sm:overflow-x-auto sm:pb-2">
        {data.columns.map((col) => (
          <PipelineColumn
            key={col.stage}
            stage={col.stage}
            deals={col.deals}
            totalMontant={col.totalMontant}
            totalPondere={col.totalPondere}
            onOpenDeal={(id) => setOpenedDealId(id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal && <DealCard deal={activeDeal} onOpen={() => {}} />}
      </DragOverlay>

      <DealDetailSheet
        dealId={openedDealId}
        onClose={() => setOpenedDealId(null)}
        isAdmin={isAdmin}
      />
    </DndContext>
  );
}

function labelStage(s: DealStage): string {
  switch (s) {
    case "DECOUVERTE":
      return "Découverte";
    case "PROPOSITION":
      return "Proposition";
    case "NEGOCIATION":
      return "Négociation";
    case "SIGNE":
      return "Signé";
    case "PERDU":
      return "Perdu";
  }
}
