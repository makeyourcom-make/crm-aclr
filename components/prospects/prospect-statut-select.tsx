"use client";

/**
 * Badge de statut cliquable sur la fiche client : un clic ouvre une liste
 * déroulante pour changer le statut directement (sans page d'édition).
 */
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProspectStatut } from "@/app/(app)/prospects/actions";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { statutOptionLabel } from "@/components/prospects/statut-meta";

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

  // Un statut posé automatiquement (ex. Numéro invalide) reste sélectionné.
  const options = STATUTS.includes(statut) ? STATUTS : [...STATUTS, statut];

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
        aria-label="Statut de l'entreprise"
        defaultValue={statut}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        onBlur={() => setEditing(false)}
        className="h-9 rounded-[10px] border border-border-strong bg-card px-2.5 text-sm font-semibold text-foreground"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {statutOptionLabel(s)}
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
      aria-label={`Statut : ${statutOptionLabel(statut)}. Changer le statut`}
      className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
    >
      <ProspectStatutBadge statut={statut} />
      <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
    </button>
  );
}
