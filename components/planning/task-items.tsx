"use client";

/**
 * Éléments de tâche du planning (MYC Arena) :
 *  - <TaskCheck>  rond de validation en 1 clic (vert quand fait) ;
 *  - <TaskPill>   pastille compacte des lignes clients (vue mois) ;
 *  - <TaskCard>   carte des vues semaine / jour ;
 *  - <TaskChip>   puce minimale de la grille 12 mois.
 *
 * Le rond valide (ou remet à faire) ; le libellé ouvre le détail.
 */
import { Check } from "lucide-react";

import {
  VISUEL_STYLE,
  dayLabel,
  dayOf,
  ddmm,
  etatTache,
  fmtDuree,
  monthOf,
  serviceStyle,
  visuelTache,
  chipClass,
  type Visuel,
} from "@/components/planning/shared";
import type { PlanningTacheDTO } from "@/lib/planning/queries";
import { libelleCourt } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";

export interface TaskHandlers {
  onToggle: (t: PlanningTacheDTO) => void;
  onOpen: (id: string) => void;
}

const CHECK_SIZE = { sm: "size-[30px]", md: "size-9", lg: "size-10" } as const;

export function TaskCheck({
  t,
  today,
  label,
  size = "sm",
  onToggle,
}: {
  t: PlanningTacheDTO;
  today: string;
  /** Complément de l'aria-label (« Rapport SEO, Clémo Sàrl »). */
  label: string;
  size?: keyof typeof CHECK_SIZE;
  onToggle: (t: PlanningTacheDTO) => void;
}) {
  const v = visuelTache(t, today);
  const done = v === "fait";
  return (
    <button
      type="button"
      onClick={() => onToggle(t)}
      aria-pressed={done}
      aria-label={`${done ? "Remettre à faire" : "Marquer comme fait"} : ${label}`}
      className={cn(
        "group/check inline-flex shrink-0 items-center justify-center rounded-full border-2 transition-[transform,background-color] duration-150 hover:scale-105 active:scale-95",
        CHECK_SIZE[size],
        VISUEL_STYLE[v].ring,
      )}
    >
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className={cn(
          "size-4 transition-opacity",
          done ? "opacity-100" : "opacity-0 group-hover/check:opacity-40",
        )}
      />
    </button>
  );
}

/** Méta d'une tâche : « Reportée du 15.10 · 1 h » / « 27.10 · 30 min · À faire ». */
export function metaTache(t: PlanningTacheDTO, today: string): string {
  const v = visuelTache(t, today);
  const duree = fmtDuree(t.dureeMin);
  const passee = t.statut !== "FAIT" && t.date < today;
  if (v === "boss") return `Boss · reportée du ${ddmm(t.date)} · ${duree}`;
  if (v === "retard") return `Reportée du ${ddmm(t.date)} · ${duree}`;
  if (v === "attente" && passee) return `Attente depuis le ${ddmm(t.date)} · ${duree}`;
  return `${ddmm(t.date)} · ${duree} · ${VISUEL_STYLE[v].label}`;
}

/** Quand : « aujourd'hui » / « prévue le 15.10, reportée » / « en attente depuis le 23.10 ». */
export function quandTache(t: PlanningTacheDTO, today: string): string {
  if (t.date === today) return "aujourd'hui";
  if (t.date > today) return `prévue le ${ddmm(t.date)}`;
  if (t.statut === "FAIT") return `prévue le ${ddmm(t.date)}`;
  if (t.statut === "ATTENTE_CLIENT") return `en attente depuis le ${ddmm(t.date)}`;
  return `prévue le ${ddmm(t.date)}, reportée`;
}

// ---------------------------------------------------------------------------
// Pastille (vue mois, lignes clients)
// ---------------------------------------------------------------------------

export function TaskPill({
  t,
  today,
  client,
  flash,
  onToggle,
  onOpen,
}: TaskHandlers & {
  t: PlanningTacheDTO;
  today: string;
  client: string;
  flash?: boolean;
}) {
  const v = visuelTache(t, today);
  const s = VISUEL_STYLE[v];
  const court = libelleCourt(t.code, t.titre);
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-[12px] border py-1 pr-2.5 pl-1",
        s.pill,
        flash && v === "fait" && "motion-safe:animate-pop",
      )}
    >
      <TaskCheck t={t} today={today} label={`${court}, ${client}`} onToggle={onToggle} />
      <button
        type="button"
        onClick={() => onOpen(t.id)}
        title={t.titre}
        className="min-w-0 rounded-[6px] text-left"
      >
        <span className="block truncate text-[13px] leading-tight font-extrabold">{court}</span>
        <span className={cn("block truncate text-[11px] leading-tight font-semibold", s.sub)}>
          {metaTache(t, today)}
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte (vues semaine et jour)
// ---------------------------------------------------------------------------

export function TaskCard({
  t,
  today,
  client,
  service,
  layout = "stack",
  flash,
  onToggle,
  onOpen,
}: TaskHandlers & {
  t: PlanningTacheDTO;
  today: string;
  client: string;
  /** Code du service (pastille colorée). */
  service: { code: string; label: string };
  /** `stack` : colonne de semaine · `row` : liste du jour. */
  layout?: "stack" | "row";
  flash?: boolean;
}) {
  const v: Visuel = visuelTache(t, today);
  const s = VISUEL_STYLE[v];
  const svc = serviceStyle(service.code);
  const court = libelleCourt(t.code, t.titre);

  if (layout === "row") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] border px-3.5 py-2.5",
          s.card,
          flash && v === "fait" && "motion-safe:animate-pop",
        )}
      >
        <TaskCheck t={t} today={today} size="lg" label={`${court}, ${client}`} onToggle={onToggle} />
        <div className="min-w-0 flex-[1_1_200px]">
          <button
            type="button"
            onClick={() => onOpen(t.id)}
            className={cn("rounded-[6px] text-left text-sm leading-snug font-extrabold", s.cardText)}
          >
            {t.titre}
          </button>
          <p className="text-xs font-semibold text-muted-foreground">
            {client} · {quandTache(t, today)}
          </p>
        </div>
        <span className={cn("inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", svc.pill)}>
          <span aria-hidden="true" className={cn("size-2 rounded-full", svc.dot)} />
          {svc.court}
        </span>
        <span className="min-w-[52px] text-[13px] font-bold text-foreground tabular-nums">
          {fmtDuree(t.dureeMin)}
        </span>
        <span className={cn("rounded-full px-2.5 py-[3px] text-[11px] font-extrabold", s.status)}>
          {s.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[14px] border p-2.5",
        s.card,
        flash && v === "fait" && "motion-safe:animate-pop",
      )}
    >
      <TaskCheck t={t} today={today} label={`${court}, ${client}`} onToggle={onToggle} />
      <div className="flex min-w-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => onOpen(t.id)}
          className={cn("rounded-[6px] text-left text-[13px] leading-snug font-extrabold", s.cardText)}
        >
          {t.titre}
        </button>
        <span className="text-xs font-semibold text-muted-foreground">{client}</span>
        <span className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1 text-foreground">
            <span aria-hidden="true" className={cn("size-[7px] rounded-full", svc.dot)} />
            {svc.court}
          </span>
          <span className="text-muted-foreground">· {fmtDuree(t.dureeMin)}</span>
          {t.date < today && t.statut !== "FAIT" && (
            <span className="text-muted-foreground">· du {ddmm(t.date)}</span>
          )}
        </span>
        <span className={cn("self-start rounded-full px-2 py-0.5 text-[11px] font-extrabold", s.status)}>
          {s.label}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puce minimale (grille 12 mois)
// ---------------------------------------------------------------------------

export function TaskChip({
  t,
  today,
  onToggle,
  onOpen,
}: TaskHandlers & { t: PlanningTacheDTO; today: string }) {
  const etat = etatTache(t, today);
  const reportee = etat !== "ok" && monthOf(t.date) !== monthOf(today);
  const done = t.statut === "FAIT";
  const court = libelleCourt(t.code, t.titre);
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-[8px] border px-1 py-0.5 text-[11px] leading-tight font-semibold",
        chipClass(t, today),
      )}
      title={`${t.titre} · ${dayLabel(t.date)} · ${fmtDuree(t.dureeMin)} · ${VISUEL_STYLE[visuelTache(t, today)].label}`}
    >
      <button
        type="button"
        onClick={() => onToggle(t)}
        aria-pressed={done}
        aria-label={`${done ? "Remettre à faire" : "Marquer comme fait"} : ${court}`}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-current",
          done && "bg-win-500 border-win-500 text-white",
        )}
      >
        {done && <Check aria-hidden="true" strokeWidth={3} className="size-2.5" />}
      </button>
      <button type="button" onClick={() => onOpen(t.id)} className="min-w-0 flex-1 truncate text-left">
        {court}
      </button>
      <span className="shrink-0 tabular-nums opacity-80">
        {reportee ? `du ${dayOf(t.date)}/${Number(t.date.slice(5, 7))}` : dayOf(t.date)}
      </span>
    </div>
  );
}
