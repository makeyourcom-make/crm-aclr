"use client";

/**
 * Agenda : vue semaine / jour en grille horaire.
 *
 *  - Gouttière d'heures collante à gauche + 1 (jour) ou 7 colonnes (semaine)
 *  - Événements positionnés par heure de début (heure suisse) et dimensionnés
 *    par durée ; chevauchements répartis en colonnes côte à côte
 *  - Teinte + icône par type de RDV, bordure / libellé par statut
 *  - RDV passés non validés : bordure pointillée rouge qui pulse + mini-barre
 *    « Valider » (effectué / manqué) juste sous le bloc
 *  - Ligne « maintenant » + heure dans la gouttière, passé hachuré
 *  - Clic sur un événement → panneau de détail ; clic sur un créneau vide →
 *    création pré-remplie (jour + heure) ; glisser pour déplacer (appui long
 *    au doigt), tirer le bas du bloc pour changer la durée
 *  - Sur téléphone : la grille défile dans les deux sens, en-tête des jours
 *    et heures restent visibles
 */
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, Plus, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";

import { updateActivity } from "@/app/(app)/activites/actions";
import { activityCategory, defaultDureeByType } from "@/lib/activity-category";
import { initialsOf } from "@/lib/gamification/rules";
import {
  dowOfKey,
  formatKeyLong,
  isoWeekNumber,
  JOURS_ABBR,
  minutesToHHMM,
  zDayKey,
  zMinutes,
  zTime,
} from "@/lib/queries/agenda-dates";
import { cn } from "@/lib/utils";

import {
  AGENDA_HEX,
  agendaState,
  blockLook,
  STATE_LABEL,
  TYPE_META,
  type AgendaState,
} from "./agenda-style";

import type { AgendaActivity } from "@/lib/queries/agenda";

const HOUR_H = 56; // px par heure
const TOTAL_H = 24 * HOUR_H;
const GUTTER_W = 56; // largeur gouttière heures
const COL_MIN = 88; // largeur mini d'un jour en vue semaine (défilement horizontal en dessous)
const SCROLL_TO_HOUR = 7; // ancrage du scroll au chargement
const BAR_H = 38; // mini-barre « Valider »
const WORKDAY_MIN = 9 * 60; // charge d'une journée pleine (9 h)

export function dureeMin(a: Pick<AgendaActivity, "duree" | "type">): number {
  // Durée saisie/redimensionnée à la main prioritaire ; sinon défaut par type
  // (appels 30 min, mails et RDV 1 h).
  return a.duree && a.duree > 0 ? a.duree : defaultDureeByType(a.type);
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
      const startMin = zMinutes(a.date);
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
    for (const p of placed) result.push({ ...p.it, col: p.col, cols });
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

export interface WeekViewProps {
  /** Colonnes à afficher : 7 jours (semaine) ou 1 (jour), clés « AAAA-MM-JJ ». */
  dayKeys: string[];
  activities: AgendaActivity[];
  nowMs: number;
  /** Vue équipe : barre de couleur + initiales du collaborateur. */
  showUserBadge?: boolean;
  userColors?: Record<string, string>;
  /** RDV décrochés au phoning : { idDuRdv: jourDeLAppel }. */
  phoning?: Record<string, string>;
  selectedId?: string | null;
  /** Aucune catégorie affichée (filtres tous coupés). */
  noCategory?: boolean;
  /** Lien vers la vue Jour d'une date (vue semaine). */
  dayHref?: (key: string) => string;
  onOpen: (a: AgendaActivity) => void;
  onSlot: (dateKey: string, time: string) => void;
  onValidate: (a: AgendaActivity, statut: "FAIT" | "MANQUE") => void;
  busyId?: string | null;
}

export function WeekView({
  dayKeys,
  activities,
  nowMs,
  showUserBadge = false,
  userColors = {},
  phoning = {},
  selectedId = null,
  noCategory = false,
  dayHref,
  onOpen,
  onSlot,
  onValidate,
  busyId = null,
}: WeekViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [, startMove] = useTransition();
  const nbCols = dayKeys.length;
  const isDay = nbCols === 1;
  const colorByUser = showUserBadge && Object.keys(userColors).length > 0;

  // Souris : glisser dès 5 px. Doigt : appui long (250 ms) pour ne pas
  // confondre un glisser avec le défilement de la grille.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  // Drag & drop : déplace une activité (jour + heure) selon le delta du glisser.
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, delta } = e;
    if (!delta) return;
    const a = activities.find((x) => x.id === active.id);
    if (!a) return;
    const colW = columnsRef.current
      ? columnsRef.current.offsetWidth / nbCols
      : 0;
    // En vue Jour (1 colonne), on ne change pas de jour horizontalement.
    const dayDelta = nbCols > 1 && colW ? Math.round(delta.x / colW) : 0;
    const minDelta = Math.round((delta.y / HOUR_H) * 4) * 15; // snap 15 min
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
      toast.success(
        `Déplacé au ${formatKeyLong(zDayKey(newStart))} à ${zTime(newStart)}.`,
      );
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

  // Scroll au matin au montage (manipulation DOM, pas d'état)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_H - 12;
    }
  }, []);

  const nowKey = zDayKey(nowMs);
  const nowMin = zMinutes(nowMs);

  // Groupe + layout par colonne (jour)
  const days = useMemo(() => {
    const grouped: Record<string, AgendaActivity[]> = {};
    for (const k of dayKeys) grouped[k] = [];
    for (const a of activities) {
      const k = zDayKey(a.date);
      if (grouped[k]) grouped[k].push(a);
    }
    return dayKeys.map((k) => layoutDay(grouped[k]));
  }, [activities, dayKeys]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const openSlot = (dayIdx: number, e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMin = Math.max(0, Math.min((y / HOUR_H) * 60, 23 * 60 + 45));
    const rounded = Math.round(totalMin / 15) * 15;
    onSlot(dayKeys[dayIdx], minutesToHHMM(rounded));
  };

  const gridCols = { gridTemplateColumns: `repeat(${nbCols}, minmax(0, 1fr))` };
  const minWidth = isDay ? undefined : GUTTER_W + nbCols * COL_MIN;
  const lineBg: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(180deg, #E5E8F0 0px, #E5E8F0 1px, transparent 1px, transparent ${HOUR_H / 2}px, #EEF0F6 ${HOUR_H / 2}px, #EEF0F6 ${HOUR_H / 2 + 1}px, transparent ${HOUR_H / 2 + 1}px, transparent ${HOUR_H}px)`,
  };
  const nowTop = (nowMin / 60) * HOUR_H;
  const showsToday = dayKeys.includes(nowKey);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Un seul conteneur défilant (vertical ET horizontal) : en-tête des
          jours collant en haut, gouttière des heures collante à gauche. */}
      <div
        ref={scrollRef}
        className="relative max-h-[calc(100dvh-13rem)] min-h-[26rem] overflow-auto overscroll-contain"
        aria-label={
          isDay ? "Grille horaire du jour" : "Grille horaire de la semaine"
        }
        role="region"
        tabIndex={0}
      >
        <div style={{ minWidth }}>
          {/* En-tête des jours */}
          <div className="sticky top-0 z-40 flex border-b border-border bg-card">
            <div
              style={{ width: GUTTER_W }}
              className="sticky left-0 z-10 flex shrink-0 items-end justify-end bg-card pr-2 pb-2.5 text-[11px] font-bold text-muted-foreground"
            >
              S. {isoWeekNumber(dayKeys[0] ?? nowKey)}
            </div>
            <div className="grid flex-1" style={gridCols}>
              {dayKeys.map((key, idx) => {
                const positioned = days[idx];
                const isToday = key === nowKey;
                const isPast = key < nowKey;
                const dow = dowOfKey(key);
                const weekend = dow === 0 || dow === 6;
                const live = positioned.filter(
                  (p) => p.activity.statut !== "ANNULE",
                );
                const nRdv = live.filter(
                  (p) => activityCategory(p.activity.type) === "rdv",
                ).length;
                const loadMin = live.reduce(
                  (s, p) => s + (p.endMin - p.startMin),
                  0,
                );
                const load = Math.min(
                  100,
                  Math.round((loadMin / WORKDAY_MIN) * 100),
                );
                const low = !isPast && !weekend && load < 35;
                const info = weekend
                  ? `${nRdv} RDV`
                  : `${nRdv} RDV · ${low ? "À remplir" : `${load} %`}`;
                const body = (
                  <>
                    <span
                      className={cn(
                        "text-[11px] font-bold tracking-[0.08em]",
                        isToday
                          ? "text-coral-600"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-foreground",
                      )}
                    >
                      {JOURS_ABBR[dow]}
                    </span>
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full font-display text-lg font-extrabold tabular-nums",
                        isToday
                          ? "bg-coral-600 text-white"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-foreground",
                      )}
                    >
                      {Number(key.slice(8, 10))}
                    </span>
                    <span
                      className={cn(
                        "max-w-full truncate text-[11px] font-bold whitespace-nowrap",
                        low ? "text-coral-600" : "text-muted-foreground",
                      )}
                    >
                      {info}
                    </span>
                    <span
                      aria-hidden="true"
                      className="block h-[5px] w-full max-w-24 overflow-hidden rounded-full bg-navy-50"
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${load}%`,
                          background: low
                            ? "#F47174"
                            : load < 60
                              ? "#F5A524"
                              : "#12A150",
                        }}
                      />
                    </span>
                  </>
                );
                const cls = cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-t-[14px] px-1.5 pt-2.5 pb-2",
                  isToday && "bg-coral-50",
                );
                return dayHref && !isDay ? (
                  <Link
                    key={key}
                    href={dayHref(key)}
                    scroll={false}
                    aria-label={`Ouvrir la journée du ${formatKeyLong(key)} : ${nRdv} RDV, journée remplie à ${load} %`}
                    className={cn(cls, "transition-colors hover:bg-navy-50")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={key} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Corps */}
          <div className="flex" style={{ height: TOTAL_H }}>
            {/* Gouttière heures */}
            <div
              style={{ width: GUTTER_W }}
              className="sticky left-0 z-30 shrink-0 bg-card select-none"
              aria-hidden="true"
            >
              {hours.map((h) =>
                h === 0 ? null : (
                  <span
                    key={h}
                    style={{ top: h * HOUR_H - 7 }}
                    className="absolute right-2 text-[11px] font-semibold text-muted-foreground tabular-nums"
                  >
                    {minutesToHHMM(h * 60)}
                  </span>
                ),
              )}
              {showsToday && (
                <span
                  style={{ top: nowTop - 9 }}
                  className="absolute right-1 z-10 rounded-full bg-alert-700 px-1.5 py-px text-[11px] font-extrabold text-white tabular-nums"
                >
                  {minutesToHHMM(nowMin)}
                </span>
              )}
            </div>

            {/* Colonnes (jour) */}
            <div ref={columnsRef} className="grid flex-1" style={gridCols}>
              {days.map((positioned, dayIdx) => {
                const key = dayKeys[dayIdx];
                const isToday = key === nowKey;
                const isPast = key < nowKey;
                const colDow = dowOfKey(key);
                const weekendCol = colDow === 0 || colDow === 6;
                const pastH = isPast ? TOTAL_H : isToday ? nowTop : 0;
                // Créneau proposé sur un jour vide : 09:00, ou l'heure pleine
                // suivante aujourd'hui (jamais dans le passé).
                const emptyMin = isToday
                  ? Math.min(22 * 60, Math.max(9 * 60, Math.ceil((nowMin + 1) / 60) * 60))
                  : 9 * 60;
                const emptyTime = minutesToHHMM(emptyMin);
                return (
                  <div
                    key={key}
                    className={cn(
                      "relative border-l border-border",
                      isToday ? "bg-coral-50/50" : "bg-card",
                    )}
                    style={lineBg}
                    onClick={(e) => openSlot(dayIdx, e)}
                    role="presentation"
                  >
                    {/* Passé hachuré */}
                    {pastH > 0 && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0"
                        style={{
                          height: pastH,
                          backgroundImage:
                            "repeating-linear-gradient(135deg, rgba(14,25,54,0.035) 0px, rgba(14,25,54,0.035) 6px, transparent 6px, transparent 12px)",
                        }}
                      />
                    )}

                    {/* Jour vide */}
                    {positioned.length === 0 &&
                      (noCategory || isPast || weekendCol ? (
                        <div
                          className="pointer-events-none absolute inset-x-1.5 z-[5] rounded-[10px] border border-border bg-card px-1.5 py-2 text-center text-xs font-bold text-muted-foreground"
                          style={{ top: 9 * HOUR_H + 4 }}
                        >
                          {noCategory
                            ? "Active un filtre"
                            : isPast
                              ? "Journée sans activité"
                              : "Week-end"}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlot(key, emptyTime);
                          }}
                          aria-label={`Caser un RDV le ${formatKeyLong(key)} à ${emptyTime}`}
                          className="absolute inset-x-1.5 z-[5] flex flex-col items-center gap-0.5 rounded-[10px] border-2 border-dashed border-border-strong bg-card/90 px-1.5 py-2 text-center text-xs font-bold text-muted-foreground transition-colors hover:border-coral-400 hover:bg-coral-50 hover:text-coral-600"
                          style={{ top: (emptyMin / 60) * HOUR_H + 4 }}
                        >
                          <span>Rien de calé ici</span>
                          <span className="inline-flex items-center gap-1 text-coral-600">
                            <Plus aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
                            Caser un RDV
                          </span>
                        </button>
                      ))}

                    {/* Ligne « maintenant » */}
                    {isToday && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 z-[22] h-0.5 bg-alert-500"
                        style={{ top: nowTop - 1 }}
                      >
                        <span className="absolute -top-[5px] -left-1.5 size-3 rounded-full bg-alert-500 shadow-[0_0_0_3px_rgba(229,72,77,0.2)]" />
                      </div>
                    )}

                    {/* Événements */}
                    {positioned.map((p) => {
                      const a = p.activity;
                      const dur = p.endMin - p.startMin;
                      const state = agendaState(a, dureeMin(a), nowMs);
                      const bar =
                        a.couleur ??
                        (colorByUser ? (userColors[a.userId] ?? null) : null);
                      const top = (p.startMin / 60) * HOUR_H + 1;
                      const h = Math.max((dur / 60) * HOUR_H - 3, 22);
                      // Mini-barre « Valider » : sous le bloc, sauf si un autre
                      // événement occupe la place (alors dans le bas du bloc).
                      let barTop: number | null = null;
                      if (state === "a-valider") {
                        const bandStart = p.endMin;
                        const bandEnd = p.endMin + ((BAR_H + 8) / HOUR_H) * 60;
                        const collide = positioned.some(
                          (q) =>
                            q !== p &&
                            q.startMin < bandEnd &&
                            q.endMin > bandStart,
                        );
                        if (!collide && top + h + 4 + BAR_H < TOTAL_H)
                          barTop = top + h + 4;
                        else if (h >= BAR_H * 2) barTop = top + h - BAR_H - 2;
                      }
                      const widthPct = 100 / p.cols;
                      const left = `calc(${p.col * widthPct}% + ${p.col === 0 ? 4 : 2}px)`;
                      const width = `calc(${widthPct}% - ${p.cols === 1 ? 8 : 6}px)`;
                      return (
                        <Fragment key={a.id}>
                          <DraggableEvent
                            p={p}
                            dayKey={key}
                            state={state}
                            bar={bar}
                            isDay={isDay}
                            top={top}
                            minHeight={h}
                            left={left}
                            width={width}
                            selected={selectedId === a.id}
                            phoningDay={phoning[a.id] ?? null}
                            userColor={
                              colorByUser
                                ? (userColors[a.userId] ?? null)
                                : null
                            }
                            onOpen={() => onOpen(a)}
                            onResize={(duree) => handleResize(a.id, duree)}
                          />
                          {barTop !== null && (
                            <ValidateBar
                              title={a.prospect?.raisonSociale ?? a.sujet}
                              top={barTop}
                              left={left}
                              width={width}
                              narrow={p.cols > 1}
                              busy={busyId === a.id}
                              onOk={() => onValidate(a, "FAIT")}
                              onKo={() => onValidate(a, "MANQUE")}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

/** Mini-barre de validation d'un RDV passé (effectué / manqué). */
function ValidateBar({
  title,
  top,
  left,
  width,
  narrow,
  busy,
  onOk,
  onKo,
}: {
  title: string;
  top: number;
  left: string;
  width: string;
  narrow: boolean;
  busy: boolean;
  onOk: () => void;
  onKo: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Valider le RDV ${title}`}
      className="@container absolute z-[26] box-border rounded-[10px] border border-coral-100 bg-card p-1 shadow-[0_6px_16px_rgba(14,25,54,0.12)]"
      style={{ top, left, width, height: BAR_H }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-full items-center justify-center gap-1 @min-[104px]:justify-start @min-[104px]:pl-1">
        <span
          className={cn(
            "hidden min-w-0 flex-1 truncate text-[11px] font-extrabold text-alert-700",
            !narrow && "@min-[104px]:inline",
          )}
        >
          Valider
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onOk}
          aria-label="Valider comme effectué"
          title="Valider comme effectué"
          className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-win-700 text-white transition-colors hover:bg-win-500 disabled:opacity-50"
        >
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onKo}
          aria-label="Marquer comme manqué"
          title="Manqué"
          className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] border-alert-500 bg-card text-alert-700 transition-colors hover:bg-alert-50 disabled:opacity-50"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

/** Bloc événement positionné + déplaçable (drag & drop) + redimensionnable. */
function DraggableEvent({
  p,
  dayKey,
  state,
  bar,
  isDay,
  top,
  minHeight,
  left,
  width,
  selected,
  phoningDay,
  userColor,
  onOpen,
  onResize,
}: {
  p: Positioned;
  dayKey: string;
  state: AgendaState;
  bar: string | null;
  isDay: boolean;
  top: number;
  minHeight: number;
  left: string;
  width: string;
  selected: boolean;
  phoningDay: string | null;
  userColor: string | null;
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
    const deltaMin = Math.round((dy / HOUR_H) * 4) * 15; // snap 15 min
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
  // Geste interrompu (défilement repris par le navigateur) : on abandonne.
  const onResizeCancel = () => {
    resizeStart.current = null;
    setPreviewDur(null);
  };

  const a = p.activity;
  const resizing = previewDur !== null;
  const height = resizing
    ? Math.max((previewDur / 60) * HOUR_H - 3, 22)
    : minHeight;
  const compact = height < 40;
  const meta = TYPE_META[a.type];
  const look = blockLook(a.type, state, bar);
  const LookIcon = look.icon;
  const TypeIcon = meta.icon;
  const titre = a.prospect?.raisonSociale ?? a.sujet;
  const start = minutesToHHMM(p.startMin);
  const end = minutesToHHMM(p.startMin + (previewDur ?? baseDur));
  const stateLabel = state === "planifie" ? "" : STATE_LABEL[state];
  const sub = a.prospect ? a.sujet : (a.adresseRdv ?? "");
  const typeLine = isDay && sub ? `${meta.label} · ${sub}` : meta.short;
  const showSub = !compact && !isDay && height >= 104 && !!sub;
  const border = look.dashed
    ? `2px dashed ${AGENDA_HEX.red.solid}`
    : "1px solid rgba(14,25,54,0.06)";

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
      aria-pressed={selected}
      aria-label={`${meta.label} · ${titre} · ${formatKeyLong(dayKey)} · ${start} à ${end}${stateLabel ? ` · ${stateLabel}` : ""}${phoningDay ? " · décroché au phoning" : ""}${a.user && userColor ? ` · ${a.user.name}` : ""}`}
      style={{
        top,
        height,
        left,
        width,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging || resizing ? 50 : selected ? 24 : undefined,
        cursor: "grab",
        touchAction: "manipulation",
        background: look.bg,
        border,
        borderLeft: look.dashed ? border : `4px solid ${look.bar}`,
        outline: selected ? "3px solid #0E1936" : undefined,
        outlineOffset: 1,
      }}
      className={cn(
        "group @container absolute z-10 box-border flex flex-col gap-0.5 overflow-hidden rounded-[10px] px-2 py-[5px] text-left text-ink transition-[filter,box-shadow] hover:z-[25] hover:brightness-[0.98]",
        selected
          ? "shadow-[0_10px_24px_rgba(14,25,54,0.22)]"
          : "shadow-[0_1px_2px_rgba(14,25,54,0.08)]",
        (isDragging || resizing) && "opacity-90 shadow-arena-lg",
        state === "a-valider" && "motion-safe:animate-pulse-ring",
      )}
      title={`${start} · ${a.sujet}`}
    >
      {/* Poignée de redimensionnement (bas du bloc) */}
      <span
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeCancel}
        // Les capteurs dnd-kit écoutent mousedown / touchstart (et non plus
        // pointerdown) : on les arrête ici pour qu'étirer ne lance pas aussi
        // un déplacement du bloc.
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 z-40 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
        style={{ touchAction: "none" }}
        role="presentation"
      >
        <span className="mx-auto block h-0.5 w-5 translate-y-0.5 rounded-full bg-current opacity-40" />
      </span>

      <span
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden text-[11px] leading-tight font-bold whitespace-nowrap"
        style={{ color: look.meta }}
      >
        <LookIcon
          aria-hidden="true"
          className="size-3 shrink-0"
          strokeWidth={2.4}
        />
        {compact ? (
          <span className="min-w-0 flex-1 truncate tabular-nums">{`${start} · ${titre}`}</span>
        ) : (
          <span className="flex min-w-0 flex-1 overflow-hidden">
            <span className="shrink-0 tabular-nums">{start}</span>
            {/* Statut en toutes lettres seulement si le bloc est assez large
                (la bordure / l'icône le disent déjà ; l'aria-label aussi). */}
            {stateLabel && (
              <span className="hidden truncate @min-[112px]:inline">
                &nbsp;· {stateLabel}
              </span>
            )}
          </span>
        )}
        {phoningDay && state !== "annule" && (
          <Star
            aria-hidden="true"
            className="size-3 shrink-0 fill-gold-500 text-gold-700"
            strokeWidth={1.5}
          />
        )}
        {userColor && a.user && (
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold"
            style={{
              background: userColor,
              color: userColor === "#F5A524" ? "#0E1936" : "#FFFFFF",
            }}
          >
            {initialsOf(a.user.name)}
          </span>
        )}
      </span>
      {!compact && (
        <span
          className={cn(
            "w-full text-xs leading-[1.25] font-extrabold",
            height >= 104 ? "line-clamp-3" : "line-clamp-2",
            look.strike && "line-through",
          )}
          style={{ color: look.title }}
        >
          {titre}
        </span>
      )}
      {!compact && height >= 64 && (
        <span
          className="flex w-full min-w-0 items-center gap-1 overflow-hidden text-[11px] font-bold whitespace-nowrap"
          style={{
            color:
              state === "annule" || state === "fait"
                ? "#5B6478"
                : AGENDA_HEX[meta.tone].text,
          }}
        >
          <TypeIcon
            aria-hidden="true"
            className="size-3 shrink-0"
            strokeWidth={2.4}
          />
          <span className="min-w-0 truncate">{typeLine}</span>
        </span>
      )}
      {showSub && (
        <span className="w-full truncate text-[11px] font-semibold text-muted-foreground">
          {sub}
        </span>
      )}
    </button>
  );
}
