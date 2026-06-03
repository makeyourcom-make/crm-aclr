"use client";

/**
 * Barre de filtres pour /contrats : recherche + filtre statut.
 *
 * Sur chaque changement, met à jour les query params ; le serveur re-fetche.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ContractListParams } from "@/lib/schemas/contract";

const STATUT_OPTIONS = [
  { value: "ACTIF", label: "Actif" },
  { value: "SUSPENDU", label: "Suspendu" },
  { value: "RESILIE", label: "Résilié" },
  { value: "EXPIRE", label: "Expiré" },
];

interface ContractFiltersProps {
  params: ContractListParams;
  users?: Array<{ id: string; name: string }>;
  currentUserId?: string;
}

export function ContractFilters({
  params,
  users,
  currentUserId,
}: ContractFiltersProps) {
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
      startTransition(() => {
        router.push(`${pathname}?${sp.toString()}`);
      });
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

  const handleSelectChange = (
    key: keyof ContractListParams,
    value: string,
  ) => {
    pushParams((sp) => {
      if (value === "" || value === "all") sp.delete(key);
      else sp.set(key, value);
    });
  };

  const hasFilters =
    !!params.statut ||
    !!params.assigneAId ||
    !!params.q ||
    (params.sortBy !== "dateSignature" || params.sortDir !== "desc");

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-0 sm:min-w-[220px] max-w-md">
        <Icon
          name="Search"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Rechercher (n° contrat, raison sociale)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <FilterSelect
        label="Statut"
        value={params.statut ?? ""}
        onChange={(v) => handleSelectChange("statut", v)}
        options={STATUT_OPTIONS}
      />

      {users && users.length > 1 && (
        <FilterSelect
          label="Commerciale"
          value={params.assigneAId ?? ""}
          onChange={(v) => handleSelectChange("assigneAId", v)}
          options={users.map((u) => ({
            value: u.id,
            label:
              currentUserId && u.id === currentUserId
                ? `Moi (${u.name.split(" ")[0]})`
                : u.name,
          }))}
        />
      )}

      {hasFilters && (
        <button
          onClick={clearAll}
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

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-md border border-input bg-background px-2.5 text-sm",
        value && "border-primary/40 bg-primary/5",
      )}
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
