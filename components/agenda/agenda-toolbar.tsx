"use client";

/**
 * Barre d'outils de l'agenda : navigation dans le temps, choix de la vue
 * (Jour / Semaine / Mois), puces de filtre par catégorie (avec compteurs) et
 * interrupteur « Masquer les fait ». Tout l'état vit dans l'URL (partageable,
 * rechargeable) ; les liens ne remontent pas en haut de page.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import {
  ACTIVITY_CATEGORIES,
  ALL_CATEGORY_KEYS,
  DEFAULT_CATEGORY_KEYS,
  type ActivityCategory,
} from "@/lib/activity-category";
import { AGENDA_DEFAULT_VIEW } from "@/lib/agenda-view";
import {
  addDaysKey,
  addMonthsKey,
  capitalize,
  formatKeyDate,
  formatKeyLong,
  formatKeyShort,
  formatMonth,
  isoWeekNumber,
  mondayOfKey,
  monthStartKey,
  relativeDayLabel,
} from "@/lib/queries/agenda-dates";
import { cn } from "@/lib/utils";

import {
  AGENDA_HEX,
  CATEGORY_META,
} from "./agenda-style";

export type AgendaMode = "day" | "week" | "month";

interface AgendaToolbarProps {
  mode: AgendaMode;
  /** Jour de référence (ancre) de la vue, « AAAA-MM-JJ ». */
  refKey: string;
  todayKey: string;
  view: string;
  hideDone: boolean;
  /** Catégories d'activité affichées (toutes = pas de filtre). */
  activeCats: ActivityCategory[];
  /** Nombre d'activités par catégorie sur la période (hors annulées). */
  catCounts: Record<ActivityCategory, number>;
  /** Actions à droite (synchronisation). */
  actions?: ReactNode;
}

const isDefault = (cats: ActivityCategory[]) =>
  cats.length === DEFAULT_CATEGORY_KEYS.length &&
  DEFAULT_CATEGORY_KEYS.every((k) => cats.includes(k));

/** Construit l'URL de l'agenda en préservant les filtres actifs. */
export function agendaHref(opts: {
  mode: AgendaMode;
  dateKey: string;
  view: string;
  hideDone: boolean;
  cats: ActivityCategory[];
}): string {
  const sp = new URLSearchParams();
  sp.set("mode", opts.mode);
  sp.set("date", opts.dateKey);
  if (opts.view && opts.view !== AGENDA_DEFAULT_VIEW) sp.set("view", opts.view);
  if (opts.hideDone) sp.set("hideDone", "1");
  // Affichage par défaut (RDV seulement) : on omet le paramètre ; aucune
  // catégorie : « none » pour ne rien afficher.
  if (opts.cats.length === 0) sp.set("cat", "none");
  else if (!isDefault(opts.cats)) sp.set("cat", opts.cats.join(","));
  return `/agenda?${sp.toString()}`;
}

export function periodLabels(
  mode: AgendaMode,
  refKey: string,
  todayKey: string,
): { title: string; sub: string } {
  if (mode === "day") {
    const rel = relativeDayLabel(refKey, todayKey);
    return {
      title: formatKeyLong(refKey),
      sub: ["Aujourd'hui", "Demain", "Hier"].includes(rel) ? rel : "Vue jour",
    };
  }
  if (mode === "week") {
    const ws = mondayOfKey(refKey);
    const we = addDaysKey(ws, 6);
    const current = todayKey >= ws && todayKey <= we;
    return {
      title: `Lun ${formatKeyShort(ws)} - Dim ${formatKeyDate(we)}`,
      sub: `Semaine ${isoWeekNumber(ws)}${current ? " · en cours" : ""}`,
    };
  }
  const ms = monthStartKey(refKey);
  return {
    title: capitalize(formatMonth(ms)),
    sub: monthStartKey(todayKey) === ms ? "Mois en cours" : "Vue mois",
  };
}

export function AgendaToolbar({
  mode,
  refKey,
  todayKey,
  view,
  hideDone,
  activeCats,
  catCounts,
  actions,
}: AgendaToolbarProps) {
  const router = useRouter();
  const go = (href: string) => router.push(href, { scroll: false });

  const href = (m: AgendaMode, key: string, over?: Partial<{ hideDone: boolean; cats: ActivityCategory[] }>) =>
    agendaHref({
      mode: m,
      dateKey: key,
      view,
      hideDone: over?.hideDone ?? hideDone,
      cats: over?.cats ?? activeCats,
    });

  // Navigation précédent / suivant selon le mode
  const shift = (dir: -1 | 1): string => {
    if (mode === "day") return addDaysKey(refKey, dir);
    if (mode === "week") return addDaysKey(refKey, 7 * dir);
    return addMonthsKey(refKey, dir);
  };

  const toggleCat = (c: ActivityCategory) => {
    const set = new Set(activeCats);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    return ALL_CATEGORY_KEYS.filter((k) => set.has(k));
  };

  const { title, sub } = periodLabels(mode, refKey, todayKey);
  const allOn = ALL_CATEGORY_KEYS.every((k) => activeCats.includes(k));
  const defaultShown = isDefault(activeCats);

  const MODES: { key: AgendaMode; label: string }[] = [
    { key: "day", label: "Jour" },
    { key: "week", label: "Semaine" },
    { key: "month", label: "Mois" },
  ];

  const navBtn =
    "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-border-strong bg-card text-foreground transition-colors hover:bg-navy-50";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Navigation dans le temps" className="flex items-center gap-1.5">
          <Link href={href(mode, shift(-1))} scroll={false} className={navBtn} aria-label="Période précédente">
            <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          </Link>
          <Link
            href={href(mode, todayKey)}
            scroll={false}
            className="inline-flex h-10 items-center rounded-[12px] border border-border-strong bg-card px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-navy-50"
          >
            Aujourd&apos;hui
          </Link>
          <Link href={href(mode, shift(1))} scroll={false} className={navBtn} aria-label="Période suivante">
            <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          </Link>
        </div>

        <div className="min-w-0 flex-[1_1_180px]">
          <h2 id="agenda-periode" className="font-display text-lg leading-tight font-extrabold tracking-[-0.02em] text-foreground sm:text-xl">
            {title}
          </h2>
          <p className="text-xs font-semibold text-muted-foreground">{sub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Choix de la vue"
            className="inline-flex gap-0.5 rounded-[12px] border border-border bg-ground p-1"
          >
            {MODES.map((m) => {
              const on = mode === m.key;
              return (
                <Link
                  key={m.key}
                  href={href(m.key, refKey)}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-[34px] items-center rounded-[9px] px-3.5 text-[13px] font-bold transition-colors",
                    on ? "bg-navy-700 text-white" : "text-foreground hover:bg-card",
                  )}
                >
                  {m.label}
                </Link>
              );
            })}
          </div>
          {actions}
        </div>
      </div>

      {/* Filtre par type d'activité : puces à bascule */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-0.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Afficher
        </span>
        {ACTIVITY_CATEGORIES.map((c) => {
          const on = activeCats.includes(c.key);
          const meta = CATEGORY_META[c.key];
          const hex = AGENDA_HEX[meta.tone];
          const CIcon = meta.icon;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => go(href(mode, refKey, { cats: toggleCat(c.key) }))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] pr-1.5 pl-3 text-[13px] font-bold transition-colors"
              style={{
                borderColor: on ? hex.solid : "#D5DAE6",
                background: on ? hex.soft : "#FFFFFF",
                color: on ? hex.text : "#5B6478",
              }}
            >
              <CIcon aria-hidden="true" className="size-[15px]" strokeWidth={2.2} />
              {c.label}
              <span
                className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums"
                style={{ background: on ? "#FFFFFF" : "#F4F6FB" }}
              >
                <span className="sr-only">, </span>
                {catCounts[c.key] ?? 0}
              </span>
            </button>
          );
        })}
        {!allOn && (
          <button
            type="button"
            onClick={() => go(href(mode, refKey, { cats: [...ALL_CATEGORY_KEYS] }))}
            className="h-9 rounded-[10px] px-2 text-[13px] font-bold text-info-700 hover:underline"
          >
            Tout afficher
          </button>
        )}
        {!defaultShown && (
          <button
            type="button"
            onClick={() => go(href(mode, refKey, { cats: [...DEFAULT_CATEGORY_KEYS] }))}
            className="h-9 rounded-[10px] px-2 text-[13px] font-bold text-info-700 hover:underline"
          >
            Réinitialiser (RDV)
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          role="switch"
          aria-checked={hideDone}
          onClick={() => go(href(mode, refKey, { hideDone: !hideDone }))}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] px-1 text-[13px] font-bold text-foreground"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-block h-[22px] w-[38px] shrink-0 rounded-full transition-colors",
              hideDone ? "bg-navy-700" : "bg-subtle",
            )}
          >
            <span
              className={cn(
                "absolute top-[3px] size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(14,25,54,0.3)] transition-[left]",
                hideDone ? "left-[19px]" : "left-[3px]",
              )}
            />
          </span>
          Masquer les « fait »
        </button>
      </div>
    </div>
  );
}
