"use client";

/**
 * Modale pour ajouter une activité (RDV, appel planifié, email à envoyer, …)
 * directement depuis l'agenda — avec sélection du prospect et la date
 * pré-remplie sur le jour cliqué.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
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
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/labels";

import type { ActivityType } from "@prisma/client";

/** Ajoute des minutes à une heure "HH:MM" (boucle sur 24h). */
function addMinutesToTime(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
/** Durée en minutes entre deux heures "HH:MM" (min. 15). */
function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const d = eh * 60 + em - (sh * 60 + sm);
  return d > 0 ? d : 60;
}

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
  /** Mode contrôlé : ouverture pilotée par le parent (ex. clic sur un créneau). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (utile en mode contrôlé pur). */
  hideTrigger?: boolean;
}

export function AddActivityDialog({
  prospects,
  defaultDate,
  defaultTime = "09:00",
  triggerMode = "header",
  users = [],
  currentUserId,
  isAdmin = false,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: AddActivityDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (o: boolean) => {
    setInternalOpen(o);
    onOpenChange?.(o);
  };
  const [pending, startTransition] = useTransition();

  const [prospectId, setProspectId] = useState("");
  const [assigneAId, setAssigneAId] = useState(currentUserId ?? "");
  const [type, setType] = useState<ActivityType>("RDV_PHYSIQUE");
  const [sujet, setSujet] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [heure, setHeure] = useState(defaultTime);
  const [heureFin, setHeureFin] = useState(() =>
    addMinutesToTime(defaultTime, 60),
  );
  const [adresseRdv, setAdresseRdv] = useState("");
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
        duree: diffMinutes(heure, heureFin),
        adresseRdv: adresseRdv.trim() || undefined,
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
      setAdresseRdv("");
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
        // À l'ouverture, on recolle sur le jour ET l'heure cliqués
        if (o) {
          setDate(defaultDate);
          setHeure(defaultTime);
          setHeureFin(addMinutesToTime(defaultTime, 60));
        }
      }}
    >
      {!hideTrigger && (
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
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-normal text-muted-foreground">
            Nouvelle activité
          </DialogTitle>
          <DialogDescription className="sr-only">
            Crée un RDV, un appel, un email ou une note dans l&apos;agenda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-1">
          {/* Titre */}
          <input
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Ajouter un titre"
            autoFocus
            required
            className="mb-3 w-full border-0 border-b border-input bg-transparent px-1 pb-2 text-xl font-medium placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />

          {/* Horaire : date + début – fin */}
          <FieldRow icon="Clock">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
                required
              />
              <Input
                type="time"
                value={heure}
                onChange={(e) => {
                  const v = e.target.value;
                  setHeure(v);
                  if (
                    v &&
                    heureFin &&
                    `${v}` >= `${heureFin}`
                  ) {
                    setHeureFin(addMinutesToTime(v, 60));
                  }
                }}
                className="w-28"
                required
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className="w-28"
                required
              />
            </div>
          </FieldRow>

          {/* Prospect (= "invités") */}
          <FieldRow icon="Users">
            <select
              value={prospectId}
              onChange={(e) => setProspectId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            >
              <option value="">Aucun client — note interne</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.raisonSociale}
                  {p.ville ? ` · ${p.ville}` : ""}
                </option>
              ))}
            </select>
          </FieldRow>

          {/* Type (+ assigné à pour admin) */}
          <FieldRow icon="Tag">
            <div className="space-y-2">
              <select
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
              {isAdmin && users.length > 1 && (
                <select
                  value={assigneAId}
                  onChange={(e) => setAssigneAId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                  aria-label="Assigné à"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      Assigné à {u.name} {u.role === "ADMIN" ? "(admin)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </FieldRow>

          {/* Lieu / lien — contextuel selon le type de RDV */}
          {(type === "RDV_PHYSIQUE" ||
            type === "RDV_VISIO" ||
            type === "RDV_TELEPHONIQUE") && (
            <FieldRow icon="MapPin">
              <Input
                value={adresseRdv}
                onChange={(e) => setAdresseRdv(e.target.value)}
                placeholder={
                  type === "RDV_VISIO"
                    ? "Lien visio (Meet, Zoom, Teams…)"
                    : type === "RDV_TELEPHONIQUE"
                      ? "Numéro / pont conférence"
                      : "Ajouter un lieu"
                }
              />
            </FieldRow>
          )}

          {/* Description */}
          <FieldRow icon="FileText">
            <textarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Ajouter une description"
            />
          </FieldRow>

          <DialogFooter className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ligne de champ à la Google Agenda : icône à gauche + contenu à droite. */
function FieldRow({
  icon,
  children,
}: {
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon name={icon} className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
