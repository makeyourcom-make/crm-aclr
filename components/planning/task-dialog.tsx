"use client";

/** Détail d'une tâche du planning : statut, date, durée, notes, abandon. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteTache,
  setTacheStatut,
  updateTache,
} from "@/app/(app)/dossiers/planning/actions";
import {
  STATUT_META,
  dayLabel,
  etatTache,
  fmtDuree,
  type Statut,
} from "@/components/planning/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanningTacheDTO } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

const ORDRE: Statut[] = ["A_FAIRE", "EN_COURS", "ATTENTE_CLIENT", "FAIT"];

export function TaskDialog({
  tache,
  client,
  service,
  today,
  onClose,
}: {
  tache: PlanningTacheDTO;
  client: string;
  service: string;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [titre, setTitre] = useState(tache.titre);
  const [date, setDate] = useState(tache.date);
  const [duree, setDuree] = useState(String(tache.dureeMin));
  const [notes, setNotes] = useState(tache.notes ?? "");
  const etat = etatTache(tache, today);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(msg);
      router.refresh();
      onClose();
    });

  const save = () =>
    run(
      () =>
        updateTache({
          id: tache.id,
          titre: titre.trim(),
          date,
          dureeMin: Math.max(5, Number(duree) || tache.dureeMin),
          notes: notes.trim() || null,
        }),
      "Tâche mise à jour ✓",
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{client}</DialogTitle>
          <DialogDescription>
            {service} · prévue le {dayLabel(tache.date)} · {fmtDuree(tache.dureeMin)}
            {etat !== "ok" && (
              <span className="ml-1 font-semibold text-red-600">
                {etat === "critique" ? "· retard de plus d'un mois" : "· en retard (reportée)"}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {ORDRE.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => run(() => setTacheStatut(tache.id, s), `${STATUT_META[s].label} ✓`)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50",
                  STATUT_META[s].chip,
                  tache.statut === s ? "ring-2 ring-primary ring-offset-1" : "opacity-80 hover:opacity-100",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", STATUT_META[s].dot)} />
                {STATUT_META[s].label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-titre">Tâche</Label>
            <Input id="t-titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Date</Label>
              <Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-duree">Durée (min)</Label>
              <Input id="t-duree" type="number" min={5} step={5} value={duree} onChange={(e) => setDuree(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notes</Label>
            <textarea
              id="t-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ex. attente des photos du client…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              const msg = tache.regleId
                ? "Abandonner cette occurrence ? (la récurrence continue les autres mois)"
                : "Supprimer cette tâche ?";
              if (confirm(msg)) run(() => deleteTache(tache.id), tache.regleId ? "Tâche abandonnée." : "Tâche supprimée.");
            }}
          >
            {tache.regleId ? "Abandonner" : "Supprimer"}
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
