"use client";

/**
 * Barre d'action sticky qui apparaît dès qu'une ou plusieurs entreprises
 * sont sélectionnées via les checkboxes du tableau.
 *
 * Permet de réassigner en masse à une autre commerciale (ou de retirer
 * l'assignation) en 2 clics.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { bulkReassignProspects } from "@/app/(app)/prospects/actions";
import { Icon } from "@/components/icon";

interface BulkReassignBarProps {
  selectedIds: string[];
  teamUsers: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onSuccess: () => void;
}

export function BulkReassignBar({
  selectedIds,
  teamUsers,
  onCancel,
  onSuccess,
}: BulkReassignBarProps) {
  const [pending, startTransition] = useTransition();
  const [targetUserId, setTargetUserId] = useState<string>("");

  const handleApply = () => {
    if (!targetUserId) {
      toast.error("Choisis une commerciale (ou « Non assignée »).");
      return;
    }
    const newAssigneeId = targetUserId === "__none__" ? null : targetUserId;
    startTransition(async () => {
      const res = await bulkReassignProspects({
        prospectIds: selectedIds,
        newAssigneeId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      const target =
        newAssigneeId === null
          ? "Non assignée"
          : teamUsers.find((u) => u.id === newAssigneeId)?.name ?? "—";
      toast.success(`${res.count} entreprise(s) réassignée(s) à ${target}.`);
      onSuccess();
    });
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 shadow-sm backdrop-blur">
      <span className="text-sm font-medium text-primary">
        {selectedIds.length} entreprise(s) sélectionnée(s)
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          disabled={pending}
        >
          <option value="">Réassigner à…</option>
          <option value="__none__">— Non assignée —</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleApply}
          disabled={pending || !targetUserId}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Icon name="Check" className="h-4 w-4" />
          {pending ? "Application…" : "Appliquer"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Tout désélectionner
        </button>
      </div>
    </div>
  );
}
