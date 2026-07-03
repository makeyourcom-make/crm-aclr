"use client";

/**
 * Kanban de suivi des dossiers/tâches — drag & drop entre colonnes (dnd-kit),
 * optimistic UI, panneau latéral de détail. Même socle que la pipeline deals.
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

import { DossierCard } from "@/components/dossiers/dossier-card";
import { DossierDetailSheet } from "@/components/dossiers/dossier-detail-sheet";
import { DossiersColumn } from "@/components/dossiers/dossiers-column";
import { moveDossierStatut } from "@/app/(app)/dossiers/actions";
import { DOSSIER_STATUTS, DOSSIER_STATUT_LABELS } from "@/lib/dossiers";

import type { DossierStatut } from "@prisma/client";
import type { DossiersBoardData } from "@/lib/queries/dossiers";

interface DossiersBoardProps {
  initialData: DossiersBoardData;
  users: Array<{ id: string; name: string }>;
}

const STATUT_SET = new Set<string>(DOSSIER_STATUTS);

export function DossiersBoard({ initialData, users }: DossiersBoardProps) {
  const router = useRouter();
  const [data, setData] = useState<DossiersBoardData>(initialData);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const statutById = useMemo(() => {
    const map = new Map<string, DossierStatut>();
    for (const col of data.columns) {
      for (const d of col.dossiers) map.set(d.id, col.statut);
    }
    return map;
  }, [data.columns]);

  const activeDossier = activeId
    ? data.columns.flatMap((c) => c.dossiers).find((d) => d.id === activeId)
    : null;

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(e.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dossierId = active.id as string;
    const overId = over.id as string;
    const targetStatut = STATUT_SET.has(overId)
      ? (overId as DossierStatut)
      : statutById.get(overId);
    if (!targetStatut) return;

    const current = statutById.get(dossierId);
    if (!current || current === targetStatut) return;

    // Optimistic
    setData((prev) => {
      const columns = prev.columns.map((c) => ({
        ...c,
        dossiers: [...c.dossiers],
      }));
      let moved: (typeof columns)[number]["dossiers"][number] | null = null;
      for (const c of columns) {
        const idx = c.dossiers.findIndex((d) => d.id === dossierId);
        if (idx !== -1) {
          [moved] = c.dossiers.splice(idx, 1);
          break;
        }
      }
      if (!moved) return prev;
      moved.statut = targetStatut;
      const dst = columns.find((c) => c.statut === targetStatut);
      if (!dst) return prev;
      dst.dossiers.unshift(moved);
      return { ...prev, columns };
    });

    const res = await moveDossierStatut({ dossierId, newStatut: targetStatut });
    if (!res.ok) {
      toast.error(res.error ?? "Échec du déplacement.");
      router.refresh();
      return;
    }
    toast.success(`Déplacé vers « ${DOSSIER_STATUT_LABELS[targetStatut]} »`);
    router.refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:overflow-x-auto sm:pb-2">
        {data.columns.map((col) => (
          <DossiersColumn
            key={col.statut}
            statut={col.statut}
            dossiers={col.dossiers}
            onOpen={setOpenedId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDossier && (
          <DossierCard dossier={activeDossier} onOpen={() => {}} />
        )}
      </DragOverlay>

      <DossierDetailSheet
        dossierId={openedId}
        users={users}
        onClose={() => setOpenedId(null)}
        onChanged={() => router.refresh()}
      />
    </DndContext>
  );
}
