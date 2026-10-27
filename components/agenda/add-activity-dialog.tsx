"use client";

/**
 * Modale pour ajouter une activité (RDV, appel planifié, email à envoyer, …)
 * directement depuis l'agenda, avec sélection du prospect et la date
 * pré-remplie sur le jour cliqué. Sert aussi à l'ÉDITION (`editActivity`).
 *
 * Fonctions conservées : récurrence (création), client via combobox serveur
 * (RLS), pré-remplissage du lieu avec l'adresse du client, assignation (admin),
 * palette de couleurs, durée début / fin.
 */
import {
  CalendarPlus,
  Check,
  Clock,
  FileText,
  MapPin,
  Palette,
  Pencil,
  Plus,
  Repeat,
  Tag,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  createActivity,
  createRecurringActivities,
  updateActivity,
} from "@/app/(app)/activites/actions";
import { ProspectCombobox } from "@/components/prospects/prospect-combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { XP_RULES } from "@/lib/gamification/rules";
import { AGENDA_COLORS } from "@/lib/agenda-colors";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/labels";
import { cn } from "@/lib/utils";

import {
  AGENDA_HEX,
  RDV_TYPE_KEYS,
  TYPE_META,
} from "./agenda-style";

import type { ActivityType } from "@prisma/client";

/** Ajoute des minutes à une heure "HH:MM" (boucle sur 24h). */
function addMinutesToTime(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
/** Ajoute N mois à une date "YYYY-MM-DD" et renvoie la même chaîne. */
function addMonthsToDateStr(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
/** Durée en minutes entre deux heures "HH:MM" (min. 15). */
function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const d = eh * 60 + em - (sh * 60 + sm);
  return d > 0 ? d : 60;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface AddActivityDialogProps {
  /** Date par défaut au format YYYY-MM-DD */
  defaultDate: string;
  /** Heure par défaut au format HH:MM */
  defaultTime?: string;
  /**
   * Mode du déclencheur :
   *   - "header" : bouton primaire avec icône (utilisé en haut de page)
   *   - "day"    : petit bouton discret en bas d'une cellule de jour
   */
  triggerMode?: "header" | "day";
  /** Liste des users actifs (admin only). Si fourni → affiche le select Assigné à. */
  users?: UserOption[];
  /** ID du user courant, présélectionné dans le select */
  currentUserId?: string;
  /** Vrai si user courant est admin (peut assigner aux autres) */
  isAdmin?: boolean;
  /** Mode contrôlé : ouverture pilotée par le parent (ex. clic sur un créneau). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Masque le bouton déclencheur (utile en mode contrôlé pur). */
  hideTrigger?: boolean;
  /** Si fourni → mode édition (met à jour l'activité au lieu d'en créer une). */
  editActivity?: EditActivityInput;
}

/** Valeurs d'une activité existante pour le mode édition. */
export interface EditActivityInput {
  id: string;
  prospectId: string;
  /** Libellé du client (raison sociale), pré-remplit le combobox en édition. */
  prospectLabel: string;
  userId: string;
  type: ActivityType;
  sujet: string;
  dateIso: string;
  heure: string;
  heureFin: string;
  adresseRdv: string;
  contenu: string;
  couleur: string | null;
}

type Recurrence = "NONE" | "WEEKLY" | "WEEKDAYS" | "MONTHLY" | "YEARLY";

const SELECT_CLASS =
  "h-11 w-full rounded-[12px] border border-border-strong bg-card px-3 text-sm font-medium text-foreground outline-none focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25";

export function AddActivityDialog({
  defaultDate,
  defaultTime = "09:00",
  triggerMode = "header",
  users = [],
  currentUserId,
  isAdmin = false,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  editActivity,
}: AddActivityDialogProps) {
  const isEdit = !!editActivity;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (o: boolean) => {
    setInternalOpen(o);
    onOpenChange?.(o);
  };

  const triggerClass =
    triggerMode === "header"
      ? buttonVariants({ variant: "default", size: "lg" })
      : "mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded-[10px] border border-dashed border-border-strong bg-card/60 px-2 text-xs font-bold text-muted-foreground transition-colors hover:border-coral-400 hover:bg-coral-50 hover:text-coral-600";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger className={triggerClass}>
          {triggerMode === "header" ? (
            <>
              <CalendarPlus aria-hidden="true" />
              Nouvelle activité
            </>
          ) : (
            <>
              <Plus aria-hidden="true" className="size-3.5" />
              Ajouter
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="gap-0 rounded-[20px] p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 rounded-t-[20px] bg-gold-50 px-5 py-4 pr-12">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-card text-gold-700"
          >
            {isEdit ? (
              <Pencil className="size-5" />
            ) : (
              <Plus className="size-5" strokeWidth={2.4} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.08em] text-gold-700 uppercase">
              {isEdit ? "Modifier" : "Nouvelle activité"}
            </p>
            <DialogTitle className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em]">
              {isEdit ? "Mets ton agenda à jour" : "Cale-la dans ton agenda"}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Crée un RDV, un appel, un email ou une note dans l&apos;agenda.
          </DialogDescription>
        </DialogHeader>

        {/* Le formulaire est (re)monté à chaque ouverture : son état initial
            vient des props (création : jour / heure cliqués ; édition : valeurs
            de l'activité). Le dialog peut être ouvert en mode CONTRÔLÉ (clic
            sur un créneau, bouton « Modifier ») : pas besoin d'onOpenChange. */}
        {open && (
          <ActivityForm
            key={editActivity?.id ?? `new-${defaultDate}-${defaultTime}`}
            defaultDate={defaultDate}
            defaultTime={defaultTime}
            users={users}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            editActivity={editActivity}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivityForm({
  defaultDate,
  defaultTime,
  users,
  currentUserId,
  isAdmin,
  editActivity,
  onDone,
}: {
  defaultDate: string;
  defaultTime: string;
  users: UserOption[];
  currentUserId?: string;
  isAdmin: boolean;
  editActivity?: EditActivityInput;
  onDone: () => void;
}) {
  const isEdit = !!editActivity;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [prospectId, setProspectId] = useState(editActivity?.prospectId ?? "");
  const [assigneAId, setAssigneAId] = useState(
    editActivity?.userId || currentUserId || "",
  );
  const [type, setType] = useState<ActivityType>(
    editActivity?.type ?? "RDV_PHYSIQUE",
  );
  const [sujet, setSujet] = useState(editActivity?.sujet ?? "");
  const [date, setDate] = useState(editActivity?.dateIso ?? defaultDate);
  const [heure, setHeure] = useState(editActivity?.heure ?? defaultTime);
  const [heureFin, setHeureFin] = useState(
    () => editActivity?.heureFin ?? addMinutesToTime(defaultTime, 60),
  );
  const [adresseRdv, setAdresseRdv] = useState(editActivity?.adresseRdv ?? "");
  // Mémorise la dernière adresse pré-remplie automatiquement depuis un client,
  // pour pouvoir la remplacer si on change de client, sans écraser un lieu
  // saisi à la main.
  const [autoAdresse, setAutoAdresse] = useState<string | null>(null);
  const [contenu, setContenu] = useState(editActivity?.contenu ?? "");
  const [couleur, setCouleur] = useState<string | null>(
    editActivity?.couleur ?? null,
  );

  // Récurrence (création uniquement). NONE = activité unique.
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [recurUntil, setRecurUntil] = useState(() =>
    addMonthsToDateStr(defaultDate, 2),
  );

  const isRdv = RDV_TYPE_KEYS.includes(type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sujet.trim()) {
      toast.error("Donne un sujet à l'activité.");
      return;
    }

    const [yyyy, mm, dd] = date.split("-").map(Number);
    const [hh, mn] = heure.split(":").map(Number);
    const dateTime = new Date(yyyy, mm - 1, dd, hh, mn, 0);

    const payload = {
      // prospectId optionnel : vide = note interne sans client
      prospectId: prospectId || undefined,
      userId: isAdmin && assigneAId ? assigneAId : undefined,
      type,
      date: dateTime,
      sujet: sujet.trim(),
      duree: diffMinutes(heure, heureFin),
      adresseRdv: adresseRdv.trim() || undefined,
      contenu: contenu.trim() || undefined,
      couleur, // string (hex) ou null pour retirer la couleur
    };
    startTransition(async () => {
      // Cas RÉCURRENT (création uniquement) : génère toutes les occurrences.
      if (!editActivity && recurrence !== "NONE") {
        if (recurrence === "WEEKDAYS" && weekdays.length === 0) {
          toast.error("Choisis au moins un jour de la semaine.");
          return;
        }
        if (!recurUntil) {
          toast.error("Indique la date de fin de la récurrence.");
          return;
        }
        const r = await createRecurringActivities(
          { ...payload, statut: "PLANIFIE" },
          { type: recurrence, weekdays, untilIso: recurUntil },
        );
        if (!r.ok) {
          toast.error(r.error ?? "Échec.");
          return;
        }
        toast.success(`${r.count} occurrence(s) ajoutée(s) à l'agenda.`);
        setProspectId("");
        setSujet("");
        setAdresseRdv("");
        setContenu("");
        setRecurrence("NONE");
        setWeekdays([]);
        onDone();
        router.refresh();
        return;
      }

      const res = editActivity
        ? await updateActivity(editActivity.id, payload)
        : await createActivity({ ...payload, statut: "PLANIFIE" });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(
        editActivity ? "Activité modifiée." : "Activité ajoutée à l'agenda.",
        isRdv && prospectId && !editActivity
          ? {
              description: `RDV calé : +${XP_RULES.rdvEffectue} XP à la clé une fois effectué.`,
            }
          : undefined,
      );
      if (!editActivity) {
        setProspectId("");
        setSujet("");
        setAdresseRdv("");
        setContenu("");
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1 px-5 pt-4 pb-5"
    >
      {/* Titre */}
      <label htmlFor="activite-sujet" className="sr-only">
        Titre de l&apos;activité
      </label>
      <input
        id="activite-sujet"
        value={sujet}
        onChange={(e) => setSujet(e.target.value)}
        placeholder="Ajouter un titre (ex. RDV découverte)"
        autoFocus
        required
        className="mb-2 w-full border-0 border-b-2 border-border bg-transparent px-1 pb-2 font-display text-xl font-bold text-foreground outline-none placeholder:font-sans placeholder:text-base placeholder:font-medium focus:border-info-500"
      />

      {/* Type : raccourcis RDV + liste complète */}
      <FieldRow icon={Tag} label="Type">
        <div className="flex flex-col gap-2">
          <div
            role="group"
            aria-label="Type de RDV"
            className="grid grid-cols-3 gap-1.5"
          >
            {RDV_TYPE_KEYS.map((k) => {
              const meta = TYPE_META[k];
              const hex = AGENDA_HEX[meta.tone];
              const on = type === k;
              const TIcon = meta.icon;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setType(k)}
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] px-2 text-[13px] font-bold transition-colors"
                  style={{
                    borderColor: on ? hex.solid : "#D5DAE6",
                    background: on ? hex.soft : "#FFFFFF",
                    color: on ? hex.text : "#5B6478",
                  }}
                >
                  <TIcon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{meta.short}</span>
                </button>
              );
            })}
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ActivityType)}
            className={SELECT_CLASS}
            aria-label="Type d'activité"
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
              className={SELECT_CLASS}
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

      {/* Horaire : date + début / fin */}
      <FieldRow icon={Clock} label="Horaire">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-[11rem] rounded-[12px]"
            aria-label="Date"
            required
          />
          <Input
            type="time"
            value={heure}
            onChange={(e) => {
              const v = e.target.value;
              setHeure(v);
              if (v && heureFin && `${v}` >= `${heureFin}`) {
                setHeureFin(addMinutesToTime(v, 60));
              }
            }}
            className="h-11 w-[7.5rem] rounded-[12px]"
            aria-label="Heure de début"
            required
          />
          <span
            aria-hidden="true"
            className="text-sm font-bold text-muted-foreground"
          >
            à
          </span>
          <Input
            type="time"
            value={heureFin}
            onChange={(e) => setHeureFin(e.target.value)}
            className="h-11 w-[7.5rem] rounded-[12px]"
            aria-label="Heure de fin"
            required
          />
        </div>
      </FieldRow>

      {/* Récurrence : création uniquement (jour(s) de semaine, hebdo, mensuel, annuel) */}
      {!isEdit && (
        <FieldRow icon={Repeat} label="Récurrence">
          <div className="flex flex-col gap-2">
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              className={SELECT_CLASS}
              aria-label="Récurrence"
            >
              <option value="NONE">Ne se répète pas</option>
              <option value="WEEKLY">Chaque semaine</option>
              <option value="WEEKDAYS">Certains jours de la semaine</option>
              <option value="MONTHLY">Chaque mois</option>
              <option value="YEARLY">Chaque année</option>
            </select>

            {recurrence === "WEEKDAYS" && (
              <div
                role="group"
                aria-label="Jours de la semaine"
                className="flex flex-wrap gap-1.5"
              >
                {(
                  [
                    ["Lu", 1, "Lundi"],
                    ["Ma", 2, "Mardi"],
                    ["Me", 3, "Mercredi"],
                    ["Je", 4, "Jeudi"],
                    ["Ve", 5, "Vendredi"],
                    ["Sa", 6, "Samedi"],
                    ["Di", 0, "Dimanche"],
                  ] as [string, number, string][]
                ).map(([lbl, dow, full]) => {
                  const on = weekdays.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      aria-pressed={on}
                      aria-label={full}
                      onClick={() =>
                        setWeekdays((w) =>
                          on ? w.filter((x) => x !== dow) : [...w, dow],
                        )
                      }
                      className={cn(
                        "h-10 w-11 rounded-[10px] border text-xs font-bold transition-colors",
                        on
                          ? "border-navy-700 bg-navy-700 text-white"
                          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                      )}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            )}

            {recurrence !== "NONE" && (
              <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                Jusqu&apos;au
                <Input
                  type="date"
                  value={recurUntil}
                  min={date}
                  onChange={(e) => setRecurUntil(e.target.value)}
                  className="h-10 w-[11rem] rounded-[12px]"
                />
              </label>
            )}
          </div>
        </FieldRow>
      )}

      {/* Client : recherche au clavier (combobox serveur, scopé RLS) +
              création à la volée. Vide = note interne. */}
      <FieldRow icon={Users} label="Entreprise">
        <ProspectCombobox
          value={prospectId}
          initialLabel={editActivity?.prospectLabel ?? ""}
          onSelect={(id, _label, adresse) => {
            setProspectId(id);
            // Gain de temps : pré-remplit le lieu du RDV avec l'adresse du
            // client, si le champ est vide OU contient encore l'adresse
            // auto d'un client précédent, jamais si un lieu a été saisi.
            if (id && adresse) {
              const dejaAuto = !adresseRdv.trim() || adresseRdv === autoAdresse;
              if (dejaAuto) {
                setAdresseRdv(adresse);
                setAutoAdresse(adresse);
              }
            }
          }}
          placeholder="Tape le nom du client (vide = note interne)"
        />
        {isRdv && (
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-xs font-bold",
              prospectId ? "text-gold-700" : "text-muted-foreground",
            )}
          >
            <Zap
              aria-hidden="true"
              className="size-3.5 shrink-0 fill-gold-500 text-gold-500"
            />
            {prospectId
              ? `+${XP_RULES.rdvEffectue} XP une fois le RDV effectué et validé.`
              : "Rattache un client pour que ce RDV compte dans tes XP."}
          </p>
        )}
      </FieldRow>

      {/* Lieu / lien : contextuel selon le type de RDV */}
      {isRdv && (
        <FieldRow icon={MapPin} label="Lieu">
          <Input
            value={adresseRdv}
            onChange={(e) => setAdresseRdv(e.target.value)}
            className="h-11 rounded-[12px]"
            aria-label={
              type === "RDV_VISIO"
                ? "Lien visio"
                : type === "RDV_TELEPHONIQUE"
                  ? "Numéro à appeler"
                  : "Adresse du RDV"
            }
            placeholder={
              type === "RDV_VISIO"
                ? "Lien visio (Meet, Zoom, Teams)"
                : type === "RDV_TELEPHONIQUE"
                  ? "Numéro ou pont de conférence"
                  : "Adresse ou localité"
            }
          />
        </FieldRow>
      )}

      {/* Description */}
      <FieldRow icon={FileText} label="Description">
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={2}
          aria-label="Description"
          className="w-full rounded-[12px] border border-border-strong bg-card px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25"
          placeholder="Notes de préparation, contexte du RDV"
        />
      </FieldRow>

      {/* Couleur / classement : palette pour repérer la tâche dans l'agenda */}
      <FieldRow icon={Palette} label="Couleur">
        <div
          role="group"
          aria-label="Couleur dans l'agenda"
          className="flex flex-wrap items-center gap-2 py-1"
        >
          {AGENDA_COLORS.map((c) => {
            const selected = couleur === c.value;
            return (
              <button
                key={c.value}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={selected}
                onClick={() => setCouleur(selected ? null : c.value)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border transition-transform hover:scale-110",
                  selected
                    ? "ring-2 ring-navy-700 ring-offset-2"
                    : "border-black/10",
                )}
                style={{ backgroundColor: c.value }}
              >
                {selected && (
                  <Check
                    aria-hidden="true"
                    className="size-4 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
          {couleur && (
            <button
              type="button"
              onClick={() => setCouleur(null)}
              className="ml-1 h-8 rounded-[10px] px-2 text-xs font-bold text-info-700 underline-offset-2 hover:underline"
            >
              Aucune
            </button>
          )}
        </div>
      </FieldRow>

      <DialogFooter className="-mx-5 mt-4 -mb-5 rounded-b-[20px] border-border bg-ground px-5 py-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onDone()}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Ligne de champ : icône à gauche + contenu à droite. */
function FieldRow({
  icon: FIcon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span
        aria-hidden="true"
        title={label}
        className="mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-ground text-muted-foreground"
      >
        <FIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
