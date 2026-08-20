"use client";

/**
 * Badge de statut cliquable sur la fiche client : un clic ouvre une liste
 * déroulante pour changer le statut directement (sans page d'édition).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProspectStatut } from "@/app/(app)/prospects/actions";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { getProspectStatutLabel } from "@/lib/labels";

import type { ProspectStatut } from "@prisma/client";

const STATUTS: ProspectStatut[] = [
  "NOUVEAU",
  "VIERGE",
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
  "SIGNE",
  "PERDU",
  "NE_PAS_RAPPELER",
];

export function ProspectStatutSelect({
  prospectId,
  statut,
}: {
  prospectId: string;
  statut: ProspectStatut;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const change = (v: string) => {
    if (v === statut) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateProspectStatut(prospectId, v);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Statut mis à jour.");
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={statut}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        onBlur={() => setEditing(false)}
        className="h-8 rounded-md border border-primary/50 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {STATUTS.map((s) => (
          <option key={s} value={s}>
            {getProspectStatutLabel(s)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Changer le statut"
      className="inline-flex items-center rounded-md transition-colors hover:opacity-80"
    >
      {statut === "VIERGE" ? (
        <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
          Définir le statut
        </span>
      ) : (
        <ProspectStatutBadge statut={statut} />
      )}
    </button>
  );
}
