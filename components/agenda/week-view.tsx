"use client";

/**
 * Agenda — vue semaine en grille horaire type Google Agenda.
 *
 *  - Gouttière d'heures à gauche + 7 colonnes de jours
 *  - Événements positionnés par heure de début et dimensionnés par durée
 *  - Chevauchements répartis en colonnes côte à côte
 *  - Trait rouge "maintenant" sur le jour courant
 *  - Clic sur un événement → fiche détail + actions (Fait, J+1, supprimer)
 *  - Clic sur un créneau vide → création d'activité pré-remplie (jour + heure)
 */
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";

import {
  markActivityDone,
  rescheduleActivity,
  updateActivity,
} from "@/app/(app)/activites/actions";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { AdresseRdvLink } from "@/components/activities/adresse-rdv-link";
import {
  AddActivityDialog,
  type EditActivityInput,
} from "@/components/agenda/add-activity-dialog";
import { DeleteActivityButton } from "@/components/common/entity-delete-buttons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTime } from "@/lib/format";
import { getActivityTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { AgendaActivity } from "@/lib/queries/agenda";

const DAYS_SHORT = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];

const HOUR_HEIGHT = 48; // px par heure
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;
const GUTTER_W = 56; // largeur gouttière heures
const DEFAULT_DUR_MIN = 30; // durée par défaut si non renseignée
const SCROLL_TO_HOUR = 7; // ancrage du scroll au chargement

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

interface WeekViewProps {
  weekStart: Date;
  activities: AgendaActivity[];
  prospects: ProspectOption[];
  showUserBadge?: boolean;
  users?: UserOption[];
  currentUserId?: string;
  isAdmin?: boolean;
}

// Couleurs de bloc par statut (fond doux + accent bordure gauche)
const STATUT_BLOCK: Record<string, string> = {
  PLANIFIE: "bg-blue-50 border-l-blue-500 text-blue-900",
  EN_COURS: "bg-amber-50 border-l-amber-500 text-amber-900",
  FAIT: "bg-emerald-50 border-l-emerald-500 text-emerald-900",
  MANQUE: "bg-red-50 border-l-red-500 text-red-900",
  REPLANIFIE: "bg-slate-50 border-l-slate-400 text-slate-700",
  ANNULE: "bg-slate-50 border-l-slate-300 text-slate-400 line-through",
};

const USER_DOT_COLORS = ["#0E1936", "#F47174", "#2563eb", "#10b981", "#a855f7"];
function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return USER_DOT_COLORS[Math.abs(h) % USER_DOT_COLORS.length];
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function minOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
function dureeMin(a: AgendaActivity): number {
  return a.duree && a.duree > 0 ? a.duree : DEFAULT_DUR_MIN;
}
function hhmm(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Convertit une activité en valeurs initiales pour le formulaire d'édition. */
function toEditInput(a: AgendaActivity): EditActivityInput {
  const start = new Date(a.date);
  const end = new Date(start.getTime() + dureeMin(a) * 60_000);
  return {
    id: a.id,
    prospectId: a.prospectId ?? "",
    userId: a.userId,
    type: a.type,
    sujet: a.sujet,
    dateIso: toIso(start),
    heure: hhmm(start),
    heureFin: hhmm(end),
    adresseRdv: a.adresseRdv ?? "",
    contenu: a.contenu ?? "",
  };
}

interface Positioned {
  activity: AgendaActivity;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

/** Répartit les événements d'un jour en colonnes pour gérer les chevauchements. */
function layoutDay(items: AgendaActivity[]): Positioned[] {
  const base = items
    .map((a) => {
      const startMin = minOfDay(new Date(a.date));
      const endMin = Math.min(startMin + dureeMin(a), 24 * 60);
      return { activity: a, startMin, endMin };
    })
    .sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin);

  const result: Positioned[] = [];
  let cluster: typeof base = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = [];
    const placed: { it: (typeof base)[number]; col: number }[] = [];
    for (const it of cluster) {
      let c = 0;
      for (; c < colEnds.length; c++) {
        if (colEnds[c] <= it.startMin) break;
      }
      colEnds[c] = it.endMin;
      placed.push({ it, col: c });
    }
    const cols = colEnds.length;
    for (const p of placed) {
      result.push({ ...p.it, col: p.col, cols });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of base) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return result;
}

export function WeekView({
  weekStart,
  activities,
  prospects,
  showUserBadge = false,
  users = [],
  currentUserId,
  isAdmin = false,
}: WeekViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<AgendaActivity | null>(null);
  const [editing, setEditing] = useState<AgendaActivity | null>(null);
  const [, startMove] = useTransition();
  const [add, setAdd] = useState<{ open: boolean; dateIso: string; time: string }>(
    { open: false, dateIso: toIso(weekStart), time: "09:00" },
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Drag & drop : déplace une activité (jour + heure) selon le delta du glisser.
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, delta } = e;
    if (!delta) return;
    const a = activities.find((x) => x.id === active.id);
    if (!a) return;
    const colW = columnsRef.current ? columnsRef.current.offsetWidth / 7 : 0;
    const dayDelta = colW ? Math.round(delta.x / colW) : 0;
    const minDelta = Math.round((delta.y / HOUR_HEIGHT) * 4) * 15; // snap 15 min
    if (dayDelta === 0 && minDelta === 0) return;
    const newStart = new Date(a.date);
    newStart.setDate(newStart.getDate() + dayDelta);
    newStart.setMinutes(newStart.getMinutes() + minDelta);
    startMove(async () => {
      const res = await updateActivity(a.id, { date: newStart });
      if (!res.ok) {
        toast.error(res.error ?? "Déplacement impossible.");
        return;
      }
      toast.success("Déplacé.");
      router.refresh();
    });
  };

  // Redimensionnement : change la durée d'une activité.
  const handleResize = (id: string, duree: number) => {
    startMove(async () => {
      const res = await updateActivity(id, { duree });
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Durée mise à jour.");
      router.refresh();
    });
  };

  // Scroll au matin au montage
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT - 12;
    }
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  // Groupe + layout par jour
  const days = useMemo(() => {
    const grouped: AgendaActivity[][] = Array.from({ length: 7 }, () => []);
    for (const a of activities) {
      const d = new Date(a.date);
      d.setHours(0, 0, 0, 0);
      const idx = Math.round((d.getTime() - weekStart.getTime()) / 86400_000);
      if (idx >= 0 && idx < 7) grouped[idx].push(a);
    }
    return grouped.map((items) => layoutDay(items));
  }, [activities, weekStart]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const openSlot = (dayIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMin = Math.max(0, Math.min((y / HOUR_HEIGHT) * 60, 23 * 60 + 45));
    const rounded = Math.round(totalMin / 15) * 15;
    const hh = String(Math.floor(rounded / 60)).padStart(2, "0");
    const mm = String(rounded % 60).padStart(2, "0");
    const day = new Date(weekStart);
    day.setDate(day.getDate() + dayIdx);
    setAdd({ open: true, dateIso: toIso(day), time: `${hh}:${mm}` });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* En-tête des jours (sticky) */}
      <div className="flex border-b border-border bg-muted/30">
        <div style={{ width: GUTTER_W }} className="shrink-0" />
        <div className="grid flex-1 grid-cols-7">
          {DAYS_SHORT.map((label, idx) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + idx);
            const isToday = d.getTime() === today.getTime();
            return (
              <div
                key={idx}
                className="border-l border-border px-1 py-2 text-center"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corps scrollable */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto">
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Gouttière heures */}
          <div
            style={{ width: GUTTER_W }}
            className="relative shrink-0 select-none"
          >
            {hours.map((h) => (
              <div
                key={h}
                style={{ top: h * HOUR_HEIGHT }}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              >
                {h === 0 ? "" : `${h}:00`}
              </div>
            ))}
          </div>

          {/* 7 colonnes */}
          <div ref={columnsRef} className="grid flex-1 grid-cols-7">
            {days.map((positioned, dayIdx) => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + dayIdx);
              d.setHours(0, 0, 0, 0);
              const isToday = d.getTime() === today.getTime();
              return (
                <div
                  key={dayIdx}
                  className="relative border-l border-border"
                  onClick={(e) => openSlot(dayIdx, e)}
                  role="presentation"
                >
                  {/* Lignes d'heures */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      className="absolute inset-x-0 border-t border-border/60"
                    />
                  ))}

                  {/* Trait "maintenant" */}
                  {isToday && (
                    <div
                      style={{ top: (nowMin / 60) * HOUR_HEIGHT }}
                      className="absolute inset-x-0 z-20 -translate-y-1/2"
                    >
                      <div className="relative h-0 border-t-2 border-red-500">
                        <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Événements */}
                  {positioned.map((p) => (
                    <DraggableEvent
                      key={p.activity.id}
                      p={p}
                      showUserBadge={showUserBadge}
                      onOpen={() => setSelected(p.activity)}
                      onResize={(duree) => handleResize(p.activity.id, duree)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </DndContext>

      {/* Dialog création (créneau cliqué) */}
      <AddActivityDialog
        prospects={prospects}
        defaultDate={add.dateIso}
        defaultTime={add.time}
        users={users}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        open={add.open}
        onOpenChange={(o) => setAdd((s) => ({ ...s, open: o }))}
        hideTrigger
      />

      {/* Dialog édition (depuis le détail d'un événement) */}
      <AddActivityDialog
        prospects={prospects}
        defaultDate={toIso(weekStart)}
        users={users}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        hideTrigger
        editActivity={editing ? toEditInput(editing) : undefined}
      />

      {/* Dialog détail événement */}
      <EventDetailDialog
        activity={selected}
        showUser={showUserBadge}
        onClose={() => setSelected(null)}
        onEdit={() => {
          const a = selected;
          setSelected(null);
          setEditing(a);
        }}
      />
    </div>
  );
}

function EventDetailDialog({
  activity: a,
  showUser,
  onClose,
  onEdit,
}: {
  activity: AgendaActivity | null;
  showUser: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  if (!a) return null;

  const start = new Date(a.date);
  const end = new Date(start.getTime() + dureeMin(a) * 60_000);

  const markDone = () =>
    startTransition(async () => {
      const res = await markActivityDone(a.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Faite.");
      onClose();
    });

  const replanTomorrow = () =>
    startTransition(async () => {
      const t = new Date(a.date);
      t.setDate(t.getDate() + 1);
      const res = await rescheduleActivity(a.id, t);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Replanifiée à J+1.");
      onClose();
    });

  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ActivityIcon type={a.type} size={20} />
            {getActivityTypeLabel(a.type)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatTime(start)} – {formatTime(end)}
          </p>
          {a.prospect ? (
            <Link
              href={`/prospects/${a.prospect.id}`}
              className="block font-semibold text-primary hover:underline"
            >
              {a.prospect.raisonSociale}
            </Link>
          ) : (
            <p className="font-semibold italic text-muted-foreground">
              Note interne
            </p>
          )}
          <p className="font-medium">{a.sujet}</p>
          {a.contenu && (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {a.contenu}
            </p>
          )}
          {a.adresseRdv && <AdresseRdvLink adresse={a.adresseRdv} />}
          {showUser && a.user && (
            <p className="text-xs text-muted-foreground">
              Assigné à {a.user.name}
            </p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            ✎ Modifier
          </button>
          {(a.statut === "PLANIFIE" || a.statut === "EN_COURS") && (
            <>
              <button
                type="button"
                onClick={markDone}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                ✓ Marquer faite
              </button>
              <button
                type="button"
                onClick={replanTomorrow}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Reporter à J+1
              </button>
            </>
          )}
          <div className="ml-auto">
            <DeleteActivityButton activityId={a.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Bloc événement positionné + déplaçable (drag & drop) + redimensionnable. */
function DraggableEvent({
  p,
  showUserBadge,
  onOpen,
  onResize,
}: {
  p: Positioned;
  showUserBadge: boolean;
  onOpen: () => void;
  onResize: (duree: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: p.activity.id });
  const baseDur = p.endMin - p.startMin;
  const [previewDur, setPreviewDur] = useState<number | null>(null);
  const resizeStart = useRef<{ y: number; dur: number } | null>(null);

  const onResizeDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeStart.current = { y: e.clientY, dur: baseDur };
    setPreviewDur(baseDur);
  };
  const onResizeMove = (e: ReactPointerEvent) => {
    if (!resizeStart.current) return;
    const dy = e.clientY - resizeStart.current.y;
    const deltaMin = Math.round((dy / HOUR_HEIGHT) * 4) * 15; // snap 15 min
    setPreviewDur(Math.max(15, resizeStart.current.dur + deltaMin));
  };
  const onResizeUp = () => {
    if (!resizeStart.current) return;
    const finalDur = previewDur ?? baseDur;
    const started = resizeStart.current.dur;
    resizeStart.current = null;
    setPreviewDur(null);
    if (finalDur !== started) onResize(finalDur);
  };

  const durMin = previewDur ?? baseDur;
  const top = (p.startMin / 60) * HOUR_HEIGHT;
  const rawH = (durMin / 60) * HOUR_HEIGHT;
  const height = Math.max(rawH, 16);
  const widthPct = 100 / p.cols;
  const leftPct = p.col * widthPct;
  const compact = height < 34;
  const a = p.activity;
  const resizing = previewDur !== null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging && !resizing) onOpen();
      }}
      {...listeners}
      {...attributes}
      style={{
        top,
        height: height - 2,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 3px)`,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging || resizing ? 50 : undefined,
        cursor: "grab",
        touchAction: "none",
      }}
      className={cn(
        "group absolute z-10 overflow-hidden rounded-md border border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:z-30 hover:shadow-md",
        (isDragging || resizing) && "opacity-80 shadow-lg",
        STATUT_BLOCK[a.statut] ?? STATUT_BLOCK.PLANIFIE,
      )}
      title={`${formatTime(a.date)} · ${a.sujet}`}
    >
      {/* Poignée de redimensionnement (bas du bloc) */}
      <span
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 z-40 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
        style={{ touchAction: "none" }}
        role="presentation"
      >
        <span className="mx-auto block h-0.5 w-5 translate-y-0.5 rounded-full bg-current opacity-40" />
      </span>
      {compact ? (
        <span className="flex items-center gap-1 truncate">
          <span className="font-semibold tabular-nums">
            {formatTime(a.date)}
          </span>
          <span className="truncate">
            {a.prospect?.raisonSociale ?? a.sujet}
          </span>
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            <ActivityIcon type={a.type} size={13} />
            {formatTime(a.date)}
            {showUserBadge && a.user && (
              <span
                className="ml-auto inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorForUser(a.user.id) }}
              />
            )}
          </span>
          <span className="block truncate font-medium">
            {a.prospect?.raisonSociale ?? a.sujet}
          </span>
          {a.prospect && (
            <span className="block truncate opacity-70">{a.sujet}</span>
          )}
        </>
      )}
    </button>
  );
}
