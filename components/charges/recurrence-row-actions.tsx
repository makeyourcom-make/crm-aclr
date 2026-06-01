"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteRecurrence,
  toggleRecurrenceActive,
} from "@/app/(app)/charges/recurrences/actions";
import { Icon } from "@/components/icon";

export function RecurrenceRowActions({
  id,
  actif,
}: {
  id: string;
  actif: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () => {
    start(async () => {
      const res = await toggleRecurrenceActive(id);
      if (!res.ok) {
        toast.error(("error" in res ? res.error : null) ?? "Erreur");
        return;
      }
      toast.success(actif ? "Récurrence suspendue." : "Récurrence réactivée.");
      router.refresh();
    });
  };

  const del = () => {
    if (
      !confirm(
        "Supprimer cette récurrence ? Les charges déjà générées ne seront pas supprimées.",
      )
    )
      return;
    start(async () => {
      await deleteRecurrence(id);
      toast.success("Récurrence supprimée.");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        disabled={pending}
        title={actif ? "Suspendre" : "Réactiver"}
        className="rounded p-1 hover:bg-muted"
      >
        <Icon
          name={actif ? "Pause" : "Play"}
          className="h-3.5 w-3.5"
        />
      </button>
      <button
        onClick={del}
        disabled={pending}
        title="Supprimer"
        className="rounded p-1 text-rose-600 hover:bg-rose-50"
      >
        <Icon name="Trash" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
