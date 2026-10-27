"use client";

/**
 * Barre de filtres pour /factures-clients :
 *  - Recherche (n°, raison sociale, description, n° contrat)
 *  - Filtre Type (Mensualité, Acompte, Solde, Annuelle, Ponctuelle)
 *  - Filtre Client (dropdown des prospects avec contrats)
 *  - Le tri se fait via les en-têtes cliquables (vue tableau, SortableHeader)
 *
 * Le filtre statut reste les pastilles au-dessus (liens, dans la page).
 */
import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "MENSUALITE", label: "Mensualité" },
  { value: "ACOMPTE", label: "Acompte" },
  { value: "SOLDE", label: "Solde" },
  { value: "ANNUELLE", label: "Annuelle" },
  { value: "PONCTUELLE", label: "Ponctuelle" },
];

interface ClientInvoiceFiltersProps {
  prospects: Array<{ id: string; raisonSociale: string }>;
}

export function ClientInvoiceFilters({ prospects }: ClientInvoiceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQ = searchParams.get("q") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentProspectId = searchParams.get("prospectId") ?? "";
  const currentStatut = searchParams.get("statut") ?? "";
  const currentSortBy = searchParams.get("sortBy") ?? "";

  // Champ local resynchronisé quand l'URL change (pendant le rendu, sans effet).
  const [search, setSearch] = useState(currentQ);
  const [syncedQ, setSyncedQ] = useState(currentQ);
  if (currentQ !== syncedQ) {
    setSyncedQ(currentQ);
    setSearch(currentQ);
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
    if (search === currentQ) return;
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

  const hasFilters =
    !!currentType || !!currentProspectId || !!currentQ || !!currentSortBy;

  const clearAll = () => {
    startTransition(() => {
      // garde le statut (les pastilles) mais reset le reste
      const sp = new URLSearchParams();
      if (currentStatut) sp.set("statut", currentStatut);
      router.push(`${pathname}?${sp.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-sm sm:min-w-[240px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
        />
        <label htmlFor="invoice-search" className="sr-only">
          Rechercher une facture
        </label>
        <Input
          id="invoice-search"
          type="search"
          placeholder="N°, client, description, n° contrat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-[12px] pl-9"
        />
      </div>

      <FilterSelect
        label="Type de facture"
        placeholder="Tous les types"
        value={currentType}
        onChange={(v) => setParam("type", v)}
        options={TYPE_OPTIONS}
      />

      {prospects.length > 0 && (
        <FilterSelect
          label="Client"
          placeholder="Tous les clients"
          value={currentProspectId}
          onChange={(v) => setParam("prospectId", v)}
          options={prospects.map((p) => ({
            value: p.id,
            label: p.raisonSociale,
          }))}
        />
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
  );
}

interface FilterSelectProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

function FilterSelect({ label, placeholder, value, onChange, options }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 max-w-full rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-semibold text-foreground sm:max-w-[240px]",
        value && "border-navy-700 bg-navy-50",
      )}
      aria-label={label}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
