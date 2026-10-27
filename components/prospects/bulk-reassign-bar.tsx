"use client";

/**
 * Barre d'action sticky qui apparaît dès qu'une ou plusieurs entreprises
 * sont sélectionnées via les checkboxes du tableau.
 *
 * Permet de réassigner en masse à une autre commerciale (ou de retirer
 * l'assignation) en 2 clics.
 */
import { Check, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  bulkDeleteProspects,
  bulkReassignProspects,
} from "@/app/(app)/prospects/actions";

interface BulkReassignBarProps {
  selectedIds: string[];
  teamUsers: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onSuccess: () => void;
  /** Admin uniquement : affiche le bouton de suppression définitive. */
  isAdmin?: boolean;
}

export function BulkReassignBar({
  selectedIds,
  teamUsers,
  onCancel,
  onSuccess,
  isAdmin = false,
}: BulkReassignBarProps) {
  const [pending, startTransition] = useTransition();
  const [targetUserId, setTargetUserId] = useState<string>("");

  const handleDelete = () => {
    if (
      !confirm(
        `Supprimer DÉFINITIVEMENT ${selectedIds.length} entreprise(s) ?\n\n` +
          "Cette action est irréversible (tags, activités et deals liés sont " +
          "effacés). Les fiches rattachées à un contrat sont automatiquement " +
          "ignorées.",
      )
    )
      return;
    startTransition(async () => {
      const res = await bulkDeleteProspects({ prospectIds: selectedIds });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        `${res.deleted} fiche(s) supprimée(s)${
          res.skipped ? ` · ${res.skipped} ignorée(s) (liées à un contrat)` : ""
        }.`,
      );
      onSuccess();
    });
  };

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
          : (teamUsers.find((u) => u.id === newAssigneeId)?.name ?? "la commerciale choisie");
      toast.success(`${res.count} entreprise(s) réassignée(s) à ${target}.`);
      onSuccess();
    });
  };

  if (selectedIds.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Actions sur la sélection"
      className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-[16px] bg-navy-700 px-4 py-3 text-white shadow-arena-lg"
    >
      <span className="text-sm font-extrabold">
        {selectedIds.length} entreprise(s) sélectionnée(s)
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label htmlFor="bulk-reassign-target" className="sr-only">
          Réassigner à
        </label>
        <select
          id="bulk-reassign-target"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          className="h-10 rounded-[10px] border border-white/20 bg-navy-600 px-2.5 text-sm font-semibold text-white"
          disabled={pending}
        >
          <option value="">Réassigner à...</option>
          <option value="__none__">Non assignée</option>
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
          className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-white px-3 text-sm font-bold text-navy-700 hover:bg-navy-50 disabled:opacity-50"
        >
          <Check aria-hidden="true" className="size-4" />
          {pending ? "Application..." : "Appliquer"}
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-alert-50 px-3 text-sm font-bold text-alert-700 hover:brightness-95 disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Supprimer
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-10 rounded-[10px] px-2 text-xs font-bold text-navy-200 underline underline-offset-2 hover:text-white"
        >
          Tout désélectionner
        </button>
      </div>
    </div>
  );
}
