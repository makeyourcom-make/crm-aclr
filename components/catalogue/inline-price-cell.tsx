"use client";

/**
 * Cellule de prix éditable in-place.
 *
 * - Affichage : montant formaté CHF, ou tiret "—" si null
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
        className="h-7 w-24 rounded border border-primary bg-background px-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder="0.00"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "inline-flex h-7 items-center justify-end rounded px-1.5 text-sm tabular-nums transition-colors hover:bg-muted",
        inactive && "text-muted-foreground",
      )}
      title="Cliquer pour modifier"
    >
      {numeric !== null && Number.isFinite(numeric)
        ? formatCHF(numeric)
        : "—"}
    </button>
  );
}
