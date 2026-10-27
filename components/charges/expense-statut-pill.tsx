/**
 * Pastilles du module Charges : statut de paiement (teinte + libellé),
 * catégorie (puce neutre) et marqueur « récurrent ». Server-safe.
 */
import { Repeat } from "lucide-react";

import { StatusPill } from "@/components/arena/pills";

import { CATEGORIE_LABEL, STATUT_PAIEMENT_META } from "./labels";

export function ExpenseStatutPill({ statut }: { statut: string }) {
  const m = STATUT_PAIEMENT_META[statut] ?? STATUT_PAIEMENT_META.EN_ATTENTE;
  return <StatusPill tone={m.tone}>{m.label}</StatusPill>;
}

export function CategoryChip({ categorie }: { categorie: string }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-navy-50 px-2.5 text-xs font-semibold whitespace-nowrap text-foreground">
      {CATEGORIE_LABEL[categorie] ?? categorie}
    </span>
  );
}

export function RecurringChip({ short = false }: { short?: boolean }) {
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-lvl-50 px-2 text-[11px] font-bold whitespace-nowrap text-lvl-700"
      title="Charge générée par un modèle récurrent : à rapprocher du débit réel, pas à dupliquer."
    >
      <Repeat aria-hidden="true" className="size-3" />
      {short ? "Récur." : "Récurrent"}
    </span>
  );
}
