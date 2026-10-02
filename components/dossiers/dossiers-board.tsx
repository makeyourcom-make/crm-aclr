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
import { DOSSIER_STATUT_LABELS, parseDossierColumnKey } from "@/lib/dossiers";

import type { DossiersBoardData } from "@/lib/queries/dossiers";

interface DossiersBoardProps {
  initialData: DossiersBoardData;
  users: Array<{ id: string; name: string }>;
  /** Affiche l'assigné sur les cartes — vrai seulement en vue « Tous ». */
  showAssignee?: boolean;
}

export function DossiersBoard({
  initialData,
  users,
  showAssignee = false,
}: DossiersBoardProps) {
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

  /** Carte → clé de sa colonne actuelle (`${userId}:${statut}` ou "TERMINE"). */
  const columnKeyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of data.columns) {
      for (const d of col.dossiers) map.set(d.id, col.key);
    }
    return map;
  }, [data.columns]);

  const columnKeys = useMemo(
    () => new Set(data.columns.map((c) => c.key)),
    [data.columns],
  );

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
    // On peut lâcher sur la colonne elle-même ou sur une carte qu'elle contient.
    const targetKey = columnKeys.has(overId)
      ? overId
      : columnKeyById.get(overId);
    if (!targetKey) return;

    const currentKey = columnKeyById.get(dossierId);
    if (!currentKey || currentKey === targetKey) return;

    const target = parseDossierColumnKey(targetKey);
    if (!target) return;

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
      const dst = columns.find((c) => c.key === targetKey);
      if (!dst) return prev;
      // Déposer dans une colonne = changer l'ÉTAPE (l'assignation ne bouge pas).
      moved.statut = target.statut;
      dst.dossiers.unshift(moved);
      return { ...prev, columns };
    });

    const res = await moveDossierStatut({
      dossierId,
      newStatut: target.statut,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Échec du déplacement.");
      router.refresh();
      return;
    }
    toast.success(`Déplacé vers « ${DOSSIER_STATUT_LABELS[target.statut]} »`);
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
            key={col.key}
            columnKey={col.key}
            statut={col.statut}
            assigneNom={col.assigneNom}
            dossiers={col.dossiers}
            onOpen={setOpenedId}
            showAssignee={showAssignee}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDossier && (
          <DossierCard
            dossier={activeDossier}
            onOpen={() => {}}
            showAssignee={showAssignee}
          />
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
