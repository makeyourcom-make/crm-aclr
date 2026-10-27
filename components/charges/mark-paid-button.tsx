"use client";

/**
 * Bouton inline « Payer » sur la liste /charges.
 *
 * UX : un clic → popover avec date picker pré-remplie (date du ticket) →
 * validation → la charge passe à PAYE + dateReglement = date choisie.
 */
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { markExpensePaid } from "@/app/(app)/charges/actions";
import { FIELD_SM_CLASS, LABEL_CLASS } from "@/components/common/form-styles";
import { Button } from "@/components/ui/button";

export function MarkPaidButton({
  expenseId,
  defaultDate,
}: {
  expenseId: string;
  /** Date par défaut (généralement = date du ticket) au format YYYY-MM-DD */
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [pending, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);
  const dateId = useId();

  // Fermeture au clic extérieur et avec Échap
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const res = await markExpensePaid({
        id: expenseId,
        dateReglement: new Date(date),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Erreur.");
        return;
      }
      toast.success("Charge marquée payée.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Marquer comme payée"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-win-500/30 bg-win-50 px-2.5 text-xs font-bold text-win-700 transition-colors hover:border-win-500/60"
      >
        <Check aria-hidden="true" className="size-3.5" />
        Payer
      </button>
      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Marquer la charge comme payée"
          className="absolute top-full left-0 z-30 mt-1.5 w-[min(16rem,80vw)] md:right-0 md:left-auto rounded-[14px] border border-border bg-popover p-3.5 text-left shadow-arena-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={confirm}>
            <label htmlFor={dateId} className={LABEL_CLASS}>
              Date de règlement (débit)
            </label>
            <input
              id={dateId}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={FIELD_SM_CLASS}
              autoFocus
            />
            <div className="mt-3 flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
                Confirmer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
