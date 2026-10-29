"use client";

/**
 * Boutons de validation / refus d'une demande de fusion (page admin).
 */
import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { approuverMerge, refuserMerge } from "@/app/(app)/prospects/merge-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MergeReviewActions({
  mergeId,
  cibleRaisonSociale,
  sourceRaisonSociale,
}: {
  mergeId: string;
  cibleRaisonSociale: string;
  sourceRaisonSociale: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refusing, setRefusing] = useState(false);
  const [note, setNote] = useState("");

  const valider = () => {
    startTransition(async () => {
      const res = await approuverMerge(mergeId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la fusion.");
        return;
      }
      toast.success(`« ${sourceRaisonSociale} » fusionnée dans « ${cibleRaisonSociale} ».`);
      router.refresh();
    });
  };

  const refuser = () => {
    startTransition(async () => {
      const res = await refuserMerge(mergeId, note.trim() || undefined);
      if (!res.ok) {
        toast.error(res.error ?? "Échec du refus.");
        return;
      }
      toast.success("Demande de fusion refusée.");
      setRefusing(false);
      router.refresh();
    });
  };

  if (refusing) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`refus-${mergeId}`} className="text-xs font-bold text-muted-foreground">
          Motif du refus (optionnel)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`refus-${mergeId}`}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pourquoi refuser ?"
            className="h-9 min-w-[180px] flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => setRefusing(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" size="sm" onClick={refuser} disabled={pending}>
            {pending ? "..." : "Confirmer le refus"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={valider} disabled={pending}>
        <Check aria-hidden="true" />
        {pending ? "Fusion..." : "Valider la fusion"}
      </Button>
      <Button variant="destructive" size="sm" onClick={() => setRefusing(true)} disabled={pending}>
        <X aria-hidden="true" />
        Refuser
      </Button>
    </div>
  );
}
