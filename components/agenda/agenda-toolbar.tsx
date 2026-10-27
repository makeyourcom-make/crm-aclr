"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  ACTIVITY_CATEGORIES,
  ALL_CATEGORY_KEYS,
  DEFAULT_CATEGORY_KEYS,
  type ActivityCategory,
} from "@/lib/activity-category";
import { AGENDA_DEFAULT_VIEW } from "@/lib/agenda-view";
import { cn } from "@/lib/utils";

export type AgendaMode = "day" | "week" | "month";

interface AgendaToolbarProps {
  mode: AgendaMode;
  /** Date de référence (ancre) de la vue. */
  date: Date;
  view: string;
  hideDone: boolean;
  /** Catégories d'activité affichées (toutes = pas de filtre). */
  activeCats: ActivityCategory[];
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7;
  x.setDate(x.getDate() - (day - 1));
  return x;
}

export function AgendaToolbar({
  mode,
  date,
  view,
  hideDone,
  activeCats,
}: AgendaToolbarProps) {
  // Paramètre cat= à préserver dans les liens (omis quand c'est l'affichage
  // par défaut : RDV seulement).
  const isDefault = (cats: ActivityCategory[]) =>
    cats.length === DEFAULT_CATEGORY_KEYS.length &&
    DEFAULT_CATEGORY_KEYS.every((k) => cats.includes(k));
  const defaultShown = isDefault(activeCats);
  const catValue = defaultShown
    ? null
    : activeCats.length === 0
      ? "none"
      : activeCats.join(",");

  const href = (m: AgendaMode, d: Date) => {
    const sp = new URLSearchParams();
    sp.set("mode", m);
    sp.set("date", toIso(d));
    if (view && view !== AGENDA_DEFAULT_VIEW) sp.set("view", view);
    if (hideDone) sp.set("hideDone", "1");
    if (catValue) sp.set("cat", catValue);
    return `/agenda?${sp.toString()}`;
  };

  // Lien d'un chip de catégorie : bascule cette catégorie dans l'ensemble
  // affiché. Affichage par défaut → on omet le paramètre.
  const chipHref = (c: ActivityCategory) => {
    const set = new Set(activeCats);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    const next = ALL_CATEGORY_KEYS.filter((k) => set.has(k));
    const sp = new URLSearchParams();
    sp.set("mode", mode);
    sp.set("date", toIso(date));
    if (view && view !== AGENDA_DEFAULT_VIEW) sp.set("view", view);
    if (hideDone) sp.set("hideDone", "1");
    if (next.length > 0 && !isDefault(next)) sp.set("cat", next.join(","));
    // next vide = aucune catégorie : on encode "none" pour ne rien afficher.
    if (next.length === 0) sp.set("cat", "none");
    return `/agenda?${sp.toString()}`;
  };

  // Navigation précédent / suivant selon le mode
  const shift = (dir: -1 | 1): Date => {
    const d = new Date(date);
    if (mode === "day") d.setDate(d.getDate() + dir);
    else if (mode === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    return d;
  };

  // Libellé contextuel
  let label: string;
  if (mode === "day") {
    label = date.toLocaleDateString("fr-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (mode === "week") {
    const ws = startOfWeek(date);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const m = (d: Date) => d.toLocaleString("fr-CH", { month: "short" });
    label = `${ws.getDate()} ${m(ws)} → ${we.getDate()} ${m(we)} ${we.getFullYear()}`;
  } else {
    label = date.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
  }

  const MODES: { key: AgendaMode; label: string }[] = [
    { key: "day", label: "Jour" },
    { key: "week", label: "Semaine" },
    { key: "month", label: "Mois" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={href(mode, shift(-1))}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label="Précédent"
      >
        ←
      </Link>
      <Link
        href={href(mode, new Date())}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Aujourd&apos;hui
      </Link>
      <Link
        href={href(mode, shift(1))}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label="Suivant"
      >
        →
      </Link>

      <span className="ml-1 text-sm font-medium capitalize">{label}</span>

      {/* Sélecteur Jour / Semaine / Mois */}
      <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border">
        {MODES.map((m) => (
          <Link
            key={m.key}
            href={href(m.key, date)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m.key
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            {m.label}
          </Link>
        ))}
      </div>

      <Link
        href={(() => {
          const sp = new URLSearchParams();
          sp.set("mode", mode);
          sp.set("date", toIso(date));
          if (view && view !== AGENDA_DEFAULT_VIEW) sp.set("view", view);
          if (!hideDone) sp.set("hideDone", "1");
          if (catValue) sp.set("cat", catValue);
          return `/agenda?${sp.toString()}`;
        })()}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {hideDone ? "Afficher tout" : "Cacher les « fait »"}
      </Link>

      {/* Filtre par type d'activité — chips à bascule (RDV / Mails / Appels / Autres) */}
      <div className="flex w-full items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Afficher :</span>
        {ACTIVITY_CATEGORIES.map((c) => {
          const on = activeCats.includes(c.key);
          return (
            <Link
              key={c.key}
              href={chipHref(c.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label}
            </Link>
          );
        })}
        {!defaultShown && (
          <Link
            href={(() => {
              const sp = new URLSearchParams();
              sp.set("mode", mode);
              sp.set("date", toIso(date));
              if (view && view !== AGENDA_DEFAULT_VIEW) sp.set("view", view);
              if (hideDone) sp.set("hideDone", "1");
              return `/agenda?${sp.toString()}`;
            })()}
            className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Réinitialiser (RDV)
          </Link>
        )}
      </div>
    </div>
  );
}
