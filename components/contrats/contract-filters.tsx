"use client";

/**
 * Barre de filtres pour /contrats : recherche + pastilles de statut (avec
 * compteurs) + commerciale.
 *
 * Sur chaque changement, met à jour les query params ; le serveur re-fetche.
 * « Tous (signés) » = vue par défaut : Actif, Suspendu, Résilié, Expiré (les
 * contrats en attente se choisissent explicitement, ils vivent aussi dans
 * /pipeline et dans la file « À traiter »).
 */
import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { formatInt } from "@/components/arena/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ContractListParams } from "@/lib/schemas/contract";

const STATUT_CHIPS: { value: string; label: string }[] = [
  { value: "", label: "Tous (signés)" },
  { value: "ATTENTE_SIGNATURE_CLIENT", label: "En attente signature" },
  { value: "ATTENTE_VALIDATION_ADMIN", label: "À valider (admin)" },
  { value: "ACTIF", label: "Actif" },
  { value: "SUSPENDU", label: "Suspendu" },
  { value: "RESILIE", label: "Résilié" },
  { value: "EXPIRE", label: "Expiré" },
];

const DEFAULT_SCOPE = ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"];

interface ContractFiltersProps {
  params: ContractListParams;
  users?: Array<{ id: string; name: string }>;
  currentUserId?: string;
  /** Nombre de contrats par statut (périmètre de l'utilisateur). */
  counts?: Record<string, number>;
}

export function ContractFilters({
  params,
  users,
  currentUserId,
  counts,
}: ContractFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Champ de recherche local, resynchronisé quand l'URL change (pattern
  // « ajuster l'état pendant le rendu », sans effet).
  const urlQ = params.q ?? "";
  const [search, setSearch] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setSearch(urlQ);
  }

  const pushParams = useCallback(
    (mut: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mut(sp);
      sp.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${sp.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (search === urlQ) return;
    const t = setTimeout(() => {
      pushParams((sp) => {
        if (search) sp.set("q", search);
        else sp.delete("q");
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const setParam = (key: keyof ContractListParams, value: string) => {
    pushParams((sp) => {
      if (value === "" || value === "all") sp.delete(key);
      else sp.set(key, value);
    });
  };

  const hasFilters =
    !!params.statut ||
    !!params.assigneAId ||
    !!params.q ||
    params.sortBy !== "dateSignature" ||
    params.sortDir !== "desc";

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const countFor = (value: string): number | undefined => {
    if (!counts) return undefined;
    if (value === "") return DEFAULT_SCOPE.reduce((s, k) => s + (counts[k] ?? 0), 0);
    return counts[value] ?? 0;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm sm:min-w-[220px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          />
          <label htmlFor="contract-search" className="sr-only">
            Rechercher un contrat
          </label>
          <Input
            id="contract-search"
            type="search"
            placeholder="N° contrat, raison sociale"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-[12px] pl-9"
          />
        </div>

        {users && users.length > 1 && (
          <select
            value={params.assigneAId ?? ""}
            onChange={(e) => setParam("assigneAId", e.target.value)}
            className={cn(
              "h-10 rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-semibold text-foreground",
              params.assigneAId && "border-navy-700 bg-navy-50",
            )}
            aria-label="Commerciale"
          >
            <option value="">Toutes les commerciales</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {currentUserId && u.id === currentUserId
                  ? `Moi (${u.name.split(" ")[0]})`
                  : u.name}
              </option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="h-10 px-2 text-[13px] font-bold text-info-700 underline underline-offset-2 hover:text-foreground"
          >
            Réinitialiser
          </button>
        )}

        {isPending && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Actualisation...
          </span>
        )}
      </div>

      <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
        {STATUT_CHIPS.map((chip) => {
          const on = (params.statut ?? "") === chip.value;
          const n = countFor(chip.value);
          return (
            <button
              key={chip.value || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setParam("statut", chip.value)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                on
                  ? "border-navy-700 bg-navy-700 text-white"
                  : "border-border-strong bg-card text-foreground hover:bg-navy-50",
              )}
            >
              {chip.label}
              {n !== undefined && (
                <span className="font-extrabold tabular-nums opacity-85">
                  {formatInt(n)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
