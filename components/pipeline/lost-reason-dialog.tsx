"use client";

/**
 * Boîte « Pourquoi ce deal est perdu ? » : la raison est obligatoire à chaque
 * perte (elle alimente les « Leçons du mois »), la leçon est facultative.
 * Annuler = le deal ne bouge pas.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { PipelineDeal } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import { LOST_REASONS, formatRaisonPerte, type LostReason } from "./pipeline-meta";

interface LostReasonDialogProps {
  deal: PipelineDeal | null;
  onCancel: () => void;
  onConfirm: (deal: PipelineDeal, raisonPerte: string) => void;
}

export function LostReasonDialog({ deal, onCancel, onConfirm }: LostReasonDialogProps) {
  return (
    <Dialog open={!!deal} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {/* Clé = deal : le formulaire repart à zéro à chaque ouverture. */}
        {deal && (
          <LostReasonForm
            key={deal.id}
            deal={deal}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LostReasonForm({
  deal,
  onCancel,
  onConfirm,
}: {
  deal: PipelineDeal;
  onCancel: () => void;
  onConfirm: (deal: PipelineDeal, raisonPerte: string) => void;
}) {
  const [raison, setRaison] = useState<LostReason | null>(null);
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raison) return;
    onConfirm(deal, formatRaisonPerte(raison, note));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-extrabold tracking-[-0.02em]">
          Pourquoi ce deal est perdu ?
        </DialogTitle>
        <DialogDescription>
          {deal.prospect.raisonSociale} · la raison nourrit tes leçons du mois.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Raison principale
        </legend>
        <div className="flex flex-wrap gap-2">
          {LOST_REASONS.map((r) => {
            const on = raison === r;
            return (
              <label
                key={r}
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-[13px] font-bold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-info-500",
                  on
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                )}
              >
                <input
                  type="radio"
                  name="raison-perte"
                  value={r}
                  checked={on}
                  onChange={() => setRaison(r)}
                  className="sr-only"
                />
                {r}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lecon-perte">Leçon à retenir (facultatif)</Label>
        <textarea
          id="lecon-perte"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={900}
          placeholder="Ex. budget plafonné : proposer une formule plus légère en janvier"
          className="w-full rounded-[12px] border border-input bg-card px-3 py-2 text-base focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="destructive" disabled={!raison}>
          Classer perdu
        </Button>
      </DialogFooter>
    </form>
  );
}
