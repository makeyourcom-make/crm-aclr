"use client";

/**
 * Filtres de la liste d'activités : recherche (debounce 300 ms),
 * période en pastilles, type et statut en listes. Tout passe par l'URL
 * (searchParams) ; la page serveur applique le périmètre RLS.
 */
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { ACTIVITY_TYPE_OPTIONS } from "@/lib/labels";
import type { ActivityListParams } from "@/lib/schemas/activity";
import { cn } from "@/lib/utils";

interface ActivityFiltersProps {
  params: ActivityListParams;
}

const RANGE_OPTIONS = [
  { value: "all", label: "Toutes les dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "overdue", label: "En retard" },
];

const STATUT_OPTIONS = [
  { value: "PLANIFIE", label: "Planifié" },
  { value: "EN_COURS", label: "En cours" },
  { value: "FAIT", label: "Fait" },
  { value: "MANQUE", label: "Manqué" },
  { value: "REPLANIFIE", label: "Replanifié" },
  { value: "ANNULE", label: "Annulé" },
];

const SELECT =
  "h-11 min-w-0 rounded-[12px] border bg-card px-3 text-sm font-semibold text-foreground outline-none transition-colors focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25";

export function ActivityFilters({ params }: ActivityFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q ?? "");
  // Resynchronise le champ quand l'URL change (navigation, réinitialisation) :
  // ajustement pendant le rendu, pas dans un effet.
  const [syncedQ, setSyncedQ] = useState(params.q ?? "");
  if ((params.q ?? "") !== syncedQ) {
    setSyncedQ(params.q ?? "");
    setSearch(params.q ?? "");
  }

  const pushParams = useCallback(
    (mut: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mut(sp);
      sp.delete("page");
      startTransition(() => router.push(`${pathname}?${sp.toString()}`));
    },
    [pathname, router, searchParams],
  );

  // Recherche avec debounce (300 ms).
  useEffect(() => {
    const current = params.q ?? "";
    if (search === current) return;
    const t = setTimeout(() => {
      pushParams((sp) => {
        if (search) sp.set("q", search);
        else sp.delete("q");
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const setParam = (key: string, value: string) => {
    pushParams((sp) => {
      if (value === "" || value === "all") sp.delete(key);
      else sp.set(key, value);
    });
  };

  const range = params.range ?? "all";
  const hasFilters =
    !!params.q || !!params.type || !!params.statut || (params.range && params.range !== "all");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_240px] sm:max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor="activites-recherche" className="sr-only">
            Rechercher une activité
          </label>
          <input
            id="activites-recherche"
            type="search"
            placeholder="Rechercher (sujet, notes, prospect)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-[12px] border border-border bg-card pr-3.5 pl-11 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25"
          />
        </div>

        <select
          value={params.type ?? ""}
          onChange={(e) => setParam("type", e.target.value)}
          className={cn(
            SELECT,
            "flex-[1_1_150px] sm:flex-none",
            params.type ? "border-navy-700 bg-navy-50" : "border-border",
          )}
          aria-label="Type"
        >
          <option value="">Tous types</option>
          {ACTIVITY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={params.statut ?? ""}
          onChange={(e) => setParam("statut", e.target.value)}
          className={cn(
            SELECT,
            "flex-[1_1_150px] sm:flex-none",
            params.statut ? "border-navy-700 bg-navy-50" : "border-border",
          )}
          aria-label="Statut"
        >
          <option value="">Tous statuts</option>
          {STATUT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Période" className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((o) => {
            const active = range === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => setParam("range", o.value)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-[13px] font-bold transition-colors",
                  active
                    ? o.value === "overdue"
                      ? "border-alert-700 bg-alert-700 text-white"
                      : "border-navy-700 bg-navy-700 text-white"
                    : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(pathname))}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-bold text-info-700 underline-offset-2 hover:underline"
          >
            <X aria-hidden="true" className="size-3.5" />
            Réinitialiser
          </button>
        )}

        {isPending && (
          <span role="status" className="text-xs font-semibold text-muted-foreground">
            Actualisation…
          </span>
        )}
      </div>
    </div>
  );
}
