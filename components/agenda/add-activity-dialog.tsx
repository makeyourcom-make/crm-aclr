"use client";

/**
 * Modale pour ajouter une activité (RDV, appel planifié, email à envoyer, …)
 * directement depuis l'agenda — avec sélection du prospect et la date
 * pré-remplie sur le jour cliqué.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createActivity } from "@/app/(app)/activites/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/labels";

import type { ActivityType } from "@prisma/client";

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface AddActivityDialogProps {
  prospects: ProspectOption[];
  /** Date par défaut au format YYYY-MM-DD */
  defaultDate: string;
  /** Heure par défaut au format HH:MM */
  defaultTime?: string;
  /**
   * Mode du déclencheur :
   *   - "header" : gros bouton primaire avec icône (utilisé en haut de page)
   *   - "day"    : petit bouton discret en bas d'une cellule de jour
   */
  triggerMode?: "header" | "day";
  /** Liste des users actifs (admin only). Si fourni → affiche le select Assigné à. */
  users?: UserOption[];
  /** ID du user courant — preselected dans le select */
  currentUserId?: string;
  /** Vrai si user courant est admin (peut assigner aux autres) */
  isAdmin?: boolean;
}

export function AddActivityDialog({
  prospects,
  defaultDate,
  defaultTime = "09:00",
  triggerMode = "header",
  users = [],
  currentUserId,
  isAdmin = false,
}: AddActivityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [prospectId, setProspectId] = useState("");
  const [assigneAId, setAssigneAId] = useState(currentUserId ?? "");
  const [type, setType] = useState<ActivityType>("RDV_PHYSIQUE");
  const [sujet, setSujet] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [heure, setHeure] = useState(defaultTime);
  const [duree, setDuree] = useState("60");
  const [contenu, setContenu] = useState("");

  // Quand on rouvre la modale et que la prop defaultDate change, on resync
  // (par exemple si l'utilisateur clique sur un autre jour)
  if (!open && date !== defaultDate) {
    // pas dans useEffect car simple comparaison, c'est OK ici
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sujet.trim()) {
      toast.error("Donne un sujet à l'activité.");
      return;
    }

    const [yyyy, mm, dd] = date.split("-").map(Number);
    const [hh, mn] = heure.split(":").map(Number);
    const dateTime = new Date(yyyy, mm - 1, dd, hh, mn, 0);

    startTransition(async () => {
      const res = await createActivity({
        // prospectId optionnel — vide = note interne sans client
        prospectId: prospectId || undefined,
        userId: isAdmin && assigneAId ? assigneAId : undefined,
        type,
        date: dateTime,
        sujet: sujet.trim(),
        duree: duree ? Number(duree) : undefined,
        contenu: contenu.trim() || undefined,
        statut: "PLANIFIE",
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Activité ajoutée à l'agenda.");
      // Reset
      setProspectId("");
      setSujet("");
      setContenu("");
      setOpen(false);
      router.refresh();
    });
  };

  const triggerClass =
    triggerMode === "header"
      ? "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      : "mt-2 inline-flex h-7 w-full items-center justify-center rounded-md border border-dashed border-border bg-background/40 px-2 text-[11px] text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Quand on ouvre, on recolle sur la date du jour cliqué
        if (o) setDate(defaultDate);
      }}
    >
      <DialogTrigger className={triggerClass}>
        {triggerMode === "header" ? (
          <>
            <Icon name="Calendar" className="h-4 w-4" />
            + Nouvelle activité
          </>
        ) : (
          "+ Ajouter"
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle activité dans l&apos;agenda</DialogTitle>
          <DialogDescription>
            RDV, appel à planifier, email à envoyer ou note. Si elle est dans
            le futur, elle reste en <em>Planifié</em> jusqu&apos;à ce que tu
            la marques faite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prospect">Prospect (optionnel)</Label>
            <select
              id="prospect"
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="">— Aucun (note interne) —</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale}
                  {p.ville ? ` · ${p.ville}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Laisse vide pour une note interne / tâche d&apos;équipe sans
              client.
            </p>
          </div>

          {/* Sélecteur "Assigné à" — admin uniquement (Sophie reste sur elle-même) */}
          {isAdmin && users.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="assigneA">Assigné à</Label>
              <select
                id="assigneA"
                value={assigneAId}
                onChange={(e) => setAssigneAId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role === "ADMIN" ? "(admin)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                La personne à qui cette activité apparaîtra dans son agenda.
              </p>
            </div>
          )}

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
            <Label htmlFor="sujet">
              Sujet <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sujet"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex. Démo Pack Web Complet"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="heure">Heure</Label>
              <Input
                id="heure"
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                required
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
                placeholder="60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contenu">Notes (optionnel)</Label>
            <textarea
              id="contenu"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Lieu, lien visio, mémo personnel…"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Ajouter à l'agenda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
