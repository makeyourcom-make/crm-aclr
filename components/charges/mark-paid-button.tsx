"use client";

/**
 * Bouton inline « Marquer payée » sur la liste /charges.
 *
 * UX : un clic → popover avec date picker pré-remplie à aujourd'hui →
 * validation → la charge passe à PAYE + dateReglement = date choisie.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { markExpensePaid } from "@/app/(app)/charges/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";

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

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Marquer comme payée"
        className="inline-flex h-6 items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
      >
        <Icon name="Check" className="h-3 w-3" />
        Payer
      </button>
      {open && (
        <div
          ref={popRef}
          className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-popover p-3 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={confirm}>
            <label className="mb-1 block text-[11px] font-medium text-foreground">
              Date de règlement (débit)
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-8 text-xs"
              autoFocus
            />
            <div className="mt-2 flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-7 text-xs"
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pending} className="h-7 text-xs">
                {pending ? "..." : "Confirmer"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
