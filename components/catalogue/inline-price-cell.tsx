"use client";

/**
 * Cellule de prix éditable in-place.
 *
 * - Affichage : montant formaté CHF, ou petit tiret si null
 * - Clic → entre en mode édition (input number autoFocus)
 * - Blur ou Enter → sauvegarde via updateProductPrice
 * - Escape → annule
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProductPrice } from "@/app/(app)/catalogue/actions";
import { formatCHF } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InlinePriceCellProps {
  productId: string;
  field: "prixOneShot" | "prixMensuel" | "prixAnnuel";
  /** Décimal Prisma sérialisé en string (ou null si pas applicable). */
  value: string | null;
  /** Affichage discret si le prix n'est pas attendu pour ce type. */
  inactive?: boolean;
}

const FIELD_LABEL: Record<InlinePriceCellProps["field"], string> = {
  prixOneShot: "one-shot",
  prixMensuel: "mensuel",
  prixAnnuel: "annuel",
};

export function InlinePriceCell({
  productId,
  field,
  value,
  inactive,
}: InlinePriceCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(value);

  const numeric = localValue === null ? null : Number(localValue);
  const hasValue = numeric !== null && Number.isFinite(numeric);

  const commit = () => {
    const trimmed = draft.trim();
    const newValue = trimmed === "" ? null : Number(trimmed);

    // Pas de changement → on annule sans payer un round-trip
    if (
      (newValue === null && localValue === null) ||
      (newValue !== null && Number(localValue) === newValue)
    ) {
      setEditing(false);
      return;
    }

    if (newValue !== null && (!Number.isFinite(newValue) || newValue < 0)) {
      toast.error("Montant invalide.");
      setDraft(localValue ?? "");
      return;
    }

    startTransition(async () => {
      const res = await updateProductPrice({
        productId,
        field,
        value: newValue,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la sauvegarde.");
        setDraft(localValue ?? "");
        return;
      }
      setLocalValue(newValue === null ? null : String(newValue));
      setEditing(false);
      toast.success("Prix mis à jour.");
    });
  };

  const cancel = () => {
    setDraft(localValue ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        autoFocus
        disabled={pending}
        aria-label={`Prix ${FIELD_LABEL[field]} en CHF`}
        className="h-8 w-28 rounded-[10px] border-2 border-navy-700 bg-card px-2 text-right text-[13px] font-semibold tabular-nums outline-none focus-visible:ring-4 focus-visible:ring-navy-100"
        placeholder="0.00"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "inline-flex h-8 items-center justify-end rounded-[10px] px-2 text-[13px] whitespace-nowrap tabular-nums transition-colors hover:bg-navy-50",
        hasValue ? "font-semibold" : "text-muted-foreground",
        inactive && "text-muted-foreground",
      )}
      title="Cliquer pour modifier"
      aria-label={
        hasValue
          ? `Prix ${FIELD_LABEL[field]} : ${formatCHF(numeric)}. Modifier`
          : `Aucun prix ${FIELD_LABEL[field]}. Définir`
      }
    >
      {hasValue ? formatCHF(numeric) : "-"}
    </button>
  );
}
