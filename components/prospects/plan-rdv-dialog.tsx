"use client";

/**
 * « Planifier RDV » depuis la fiche : crée une activité RDV PLANIFIÉE
 * (createActivity, droits vérifiés côté serveur, poussée vers l'agenda
 * CalDAV / Google comme depuis l'agenda) et, si la fiche est en amont,
 * la passe en « RDV pris » (updateProspectStatut).
 *
 * XP réels : le RDV effectué rapporte +80 XP une fois validé « fait » dans
 * l'agenda ; « RDV pris » (+50 XP) se marque au résultat de l'appel.
 */
import type { ActivityType, ProspectStatut } from "@prisma/client";
import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createActivity } from "@/app/(app)/activites/actions";
import { updateProspectStatut } from "@/app/(app)/prospects/actions";
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
import { XP_RULES } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

const RDV_TYPES: { value: ActivityType; label: string }[] = [
  { value: "RDV_PHYSIQUE", label: "RDV physique" },
  { value: "RDV_VISIO", label: "RDV visio" },
  { value: "RDV_TELEPHONIQUE", label: "RDV téléphonique" },
];

const UPSTREAM: ProspectStatut[] = ["NOUVEAU", "VIERGE", "CONTACTE", "QUALIFIE"];

const FIELD = "h-11 rounded-[12px] border-border-strong bg-card text-sm";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Demain 10:00 (heure locale du navigateur) au format des champs date / heure. */
function defaultSlot(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: "10:00",
  };
}

export interface PlanRdvDialogProps {
  prospectId: string;
  prospectRaisonSociale: string;
  statut: ProspectStatut;
  /** Adresse de l'entreprise, proposée comme lieu d'un RDV physique. */
  adresseDefaut?: string | null;
  /** Classes du déclencheur (tuile d'action de la fiche). */
  triggerClassName?: string;
}

export function PlanRdvDialog({
  prospectId,
  prospectRaisonSociale,
  statut,
  adresseDefaut,
  triggerClassName,
}: PlanRdvDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ActivityType>("RDV_PHYSIQUE");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duree, setDuree] = useState("60");
  const [adresse, setAdresse] = useState(adresseDefaut ?? "");
  const [sujet, setSujet] = useState("");
  const [notes, setNotes] = useState("");
  const canPromote = UPSTREAM.includes(statut);
  const [promote, setPromote] = useState(canPromote);

  const onOpenChange = (o: boolean) => {
    if (o) {
      // Valeurs fraîches à chaque ouverture (calculées au clic, pas au rendu).
      const slot = defaultSlot();
      setDate(slot.date);
      setTime(slot.time);
      setType("RDV_PHYSIQUE");
      setDuree("60");
      setAdresse(adresseDefaut ?? "");
      setSujet("");
      setNotes("");
      setPromote(canPromote);
    }
    setOpen(o);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date || !time) {
      toast.error("Choisis une date et une heure.");
      return;
    }
    const when = new Date(`${date}T${time}`);
    if (Number.isNaN(when.getTime())) {
      toast.error("Date ou heure invalide.");
      return;
    }
    const label = RDV_TYPES.find((t) => t.value === type)?.label ?? "RDV";
    startTransition(async () => {
      const res = await createActivity({
        prospectId,
        type,
        date: when,
        sujet: sujet.trim() || `${label} avec ${prospectRaisonSociale}`,
        duree: duree ? Number(duree) : undefined,
        adresseRdv: type === "RDV_PHYSIQUE" ? adresse.trim() || undefined : undefined,
        contenu: notes.trim() || undefined,
        statut: "PLANIFIE",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Impossible de planifier le RDV.");
        return;
      }
      if (promote && canPromote) {
        const st = await updateProspectStatut(prospectId, "RDV_PRIS");
        if (!st.ok) toast.error(st.error ?? "RDV créé, mais le statut n'a pas pu changer.");
      }
      toast.success(`RDV planifié avec ${prospectRaisonSociale}. Il est dans ton agenda.`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className={triggerClassName}>
        <CalendarPlus aria-hidden="true" className="size-[18px] text-gold-700" />
        Planifier RDV
      </DialogTrigger>
      <DialogContent className="rounded-[20px] p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">
            Planifier un RDV
          </DialogTitle>
          <DialogDescription>
            Avec {prospectRaisonSociale}. RDV effectué et validé dans l&apos;agenda :
            +{XP_RULES.rdvEffectue} XP.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-bold">Type de RDV</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {RDV_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    // Radio masqué (sr-only) : l'anneau de focus clavier passe sur la tuile.
                    "flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] border px-2 text-center text-xs font-bold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-info-500 has-[:focus-visible]:ring-offset-2",
                    type === t.value
                      ? "border-navy-700 bg-navy-700 text-white"
                      : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                  )}
                >
                  <input
                    type="radio"
                    name="rdv-type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="sr-only"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rdv-date">Date</Label>
              <Input
                id="rdv-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rdv-heure">Heure</Label>
              <Input
                id="rdv-heure"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rdv-duree">Durée (min)</Label>
              <Input
                id="rdv-duree"
                type="number"
                min={0}
                max={1440}
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rdv-sujet">Sujet</Label>
              <Input
                id="rdv-sujet"
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Ex. Présentation Google Ads"
                className={FIELD}
              />
            </div>
          </div>

          {type === "RDV_PHYSIQUE" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rdv-lieu">Lieu</Label>
              <Input
                id="rdv-lieu"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Adresse du RDV"
                className={FIELD}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rdv-notes">Notes</Label>
            <textarea
              id="rdv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ce que tu veux préparer, le besoin évoqué..."
              className="w-full rounded-[12px] border border-border-strong bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {canPromote && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-lvl-50 px-3 py-2.5 text-sm font-semibold text-lvl-700">
              <input
                type="checkbox"
                checked={promote}
                onChange={(e) => setPromote(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[#5B3FD6]"
              />
              Passer la fiche en « RDV pris »
            </label>
          )}

          <DialogFooter className="-mx-5 -mb-5 gap-2 rounded-b-[20px] p-4">
            <DialogClose
              type="button"
              render={<Button variant="outline" size="lg" />}
            >
              Annuler
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Planification..." : "Planifier le RDV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
