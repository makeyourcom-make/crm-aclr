"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { ActivityListParams } from "@/lib/schemas/activity";

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

export function ActivityFilters({ params }: ActivityFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q ?? "");

  useEffect(() => {
    setSearch(params.q ?? "");
  }, [params.q]);

  const pushParams = useCallback(
    (mut: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mut(sp);
      sp.delete("page");
      startTransition(() => router.push(`${pathname}?${sp.toString()}`));
    },
    [pathname, router, searchParams],
  );

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

  const handleSelectChange = (key: string, value: string) => {
    pushParams((sp) => {
      if (value === "" || value === "all") sp.delete(key);
      else sp.set(key, value);
    });
  };

  const hasFilters =
    !!params.q ||
    !!params.type ||
    !!params.statut ||
    (params.range && params.range !== "all");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-0 sm:min-w-[220px] max-w-md">
        <Icon
          name="Search"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Rechercher (sujet, notes, prospect)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <select
        value={params.range ?? "all"}
        onChange={(e) => handleSelectChange("range", e.target.value)}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-2.5 text-sm",
          params.range && params.range !== "all" && "border-primary/40 bg-primary/5",
        )}
        aria-label="Période"
      >
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={params.type ?? ""}
        onChange={(e) => handleSelectChange("type", e.target.value)}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-2.5 text-sm",
          params.type && "border-primary/40 bg-primary/5",
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
        onChange={(e) => handleSelectChange("statut", e.target.value)}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-2.5 text-sm",
          params.statut && "border-primary/40 bg-primary/5",
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

      {hasFilters && (
        <button
          onClick={() =>
            startTransition(() => router.push(pathname))
          }
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Réinitialiser
        </button>
      )}

      {isPending && (
        <span className="text-xs text-muted-foreground">Actualisation…</span>
      )}
    </div>
  );
}
