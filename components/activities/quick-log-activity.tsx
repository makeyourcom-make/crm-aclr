"use client";

/**
 * Bouton + modale pour logger rapidement une activité sur un prospect.
 *
 * Usage : <QuickLogActivity prospectId="..." prospectRaisonSociale="..." />
 *   → Affiche un bouton "+ Logger une activité" qui ouvre une modale.
 *   → La modale contient un formulaire compact (type, sujet, date, durée…).
 *   → À la soumission, appelle createActivity() puis ferme la modale.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createActivity } from "@/app/(app)/activites/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/labels";
import type { ActivityType } from "@prisma/client";

interface QuickLogActivityProps {
  prospectId: string;
  prospectRaisonSociale: string;
}

function nowLocalIsoMinutes(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuickLogActivity({
  prospectId,
  prospectRaisonSociale,
}: QuickLogActivityProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ActivityType>("APPEL_SORTANT");
  const [sujet, setSujet] = useState("");
  const [date, setDate] = useState(nowLocalIsoMinutes());
  const [duree, setDuree] = useState("");
  const [contenu, setContenu] = useState("");

  const reset = () => {
    setType("APPEL_SORTANT");
    setSujet("");
    setDate(nowLocalIsoMinutes());
    setDuree("");
    setContenu("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createActivity({
        prospectId,
        type,
        date: new Date(date),
        sujet: sujet || `${type.replace(/_/g, " ").toLowerCase()} avec ${prospectRaisonSociale}`,
        duree: duree ? Number(duree) : undefined,
        contenu: contenu || undefined,
        statut: "FAIT",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success("Activité enregistrée.");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted transition-colors"
        aria-label="Logger une activité"
      >
        <Icon name="ListChecks" className="h-3.5 w-3.5" />
        Logger une activité
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logger une activité</DialogTitle>
          <DialogDescription>
            Pour {prospectRaisonSociale}. Le compteur du jour sera incrémenté.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              {ACTIVITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sujet">Sujet</Label>
            <Input
              id="sujet"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex. Présentation Pack Premium"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date / heure</Label>
              <Input
                id="date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duree">Durée (min)</Label>
              <Input
                id="duree"
                type="number"
                min={0}
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contenu">Notes</Label>
            <textarea
              id="contenu"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Résumé de l'échange…"
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
              type="button"
            >
              Annuler
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
