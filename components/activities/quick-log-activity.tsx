"use client";

/**
 * Bouton + modale pour logger rapidement une activité sur un prospect.
 *
 * Usage : <QuickLogActivity prospectId="..." prospectRaisonSociale="..." />
 *   → Affiche un bouton "Logger une activité" qui ouvre une modale.
 *   → La modale contient un formulaire compact (type, sujet, date, durée…).
 *   → À la soumission, appelle createActivity() (statut FAIT ; un RDV futur
 *     est enregistré planifié par le serveur) puis ferme la modale.
 *   → Toast sobre (activité + entreprise) et router.refresh() pour mettre à
 *     jour les compteurs du jour.
 */
import type { ActivityType } from "@prisma/client";
import { ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createActivity } from "@/app/(app)/activites/actions";
import { resultToast } from "@/components/arena/celebrate";
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
import { ACTIVITY_TYPE_OPTIONS, getActivityTypeLabel } from "@/lib/labels";

interface QuickLogActivityProps {
  prospectId: string;
  prospectRaisonSociale: string;
}

const FIELD =
  "h-11 w-full min-w-0 rounded-[12px] border border-border-strong bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25";
const LABEL = "text-[13px] font-bold text-foreground";

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
  const [date, setDate] = useState(nowLocalIsoMinutes);
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
      const when = new Date(date);
      const res = await createActivity({
        prospectId,
        type,
        date: when,
        sujet: sujet || `${type.replace(/_/g, " ").toLowerCase()} avec ${prospectRaisonSociale}`,
        duree: duree ? Number(duree) : undefined,
        contenu: contenu || undefined,
        statut: "FAIT",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de l'enregistrement.");
        return;
      }
      resultToast(`${getActivityTypeLabel(type)} enregistré`, prospectRaisonSociale);
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-border-strong bg-card px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-navy-50"
        aria-label="Logger une activité"
      >
        <ListChecks aria-hidden="true" className="size-4" />
        Logger une activité
      </DialogTrigger>
      <DialogContent className="gap-5 rounded-[20px] p-5 sm:max-w-md sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">
            Logger une activité
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted-foreground">
            Pour {prospectRaisonSociale}. Les appels, emails et RDV effectués comptent dans
            tes résultats du jour.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quicklog-type" className={LABEL}>
              Type
            </label>
            <select
              id="quicklog-type"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className={FIELD}
            >
              {ACTIVITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quicklog-sujet" className={LABEL}>
              Sujet
            </label>
            <input
              id="quicklog-sujet"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex. Présentation Pack Premium"
              autoFocus
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quicklog-date" className={LABEL}>
                Date / heure
              </label>
              <input
                id="quicklog-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quicklog-duree" className={LABEL}>
                Durée (min)
              </label>
              <input
                id="quicklog-duree"
                type="number"
                min={0}
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                placeholder="5"
                className={FIELD}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quicklog-contenu" className={LABEL}>
              Notes
            </label>
            <textarea
              id="quicklog-contenu"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={3}
              className="w-full rounded-[12px] border border-border-strong bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25"
              placeholder="Résumé de l'échange…"
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose
              className="inline-flex h-11 items-center justify-center rounded-[12px] border border-border-strong bg-card px-4 text-sm font-bold text-foreground hover:bg-navy-50"
              type="button"
            >
              Annuler
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
