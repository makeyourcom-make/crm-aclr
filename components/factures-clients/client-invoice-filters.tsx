"use client";

/**
 * Barre de filtres pour /factures-clients :
 *  - Recherche (n°, raison sociale, description)
 *  - Filtre Type (Mensualité, Acompte, Solde, Annuelle, Ponctuelle)
 *  - Filtre Client (dropdown des prospects avec contrats)
 *  - Le tri se fait via les en-têtes cliquables (cf. SortableHeader)
 *
 * Le filtre statut reste les onglets en haut (déjà présents dans la page).
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Icon } from "@/components/icon";
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

  const [search, setSearch] = useState(currentQ);
  useEffect(() => {
    setSearch(currentQ);
  }, [currentQ]);

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
      // garde le statut (les onglets) mais reset le reste
      const sp = new URLSearchParams();
      if (currentStatut) sp.set("statut", currentStatut);
      router.push(`${pathname}?${sp.toString()}`);
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
          placeholder="Rechercher (n°, client, description)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <FilterSelect
        label="Type"
        value={currentType}
        onChange={(v) => setParam("type", v)}
        options={TYPE_OPTIONS}
      />

      {prospects.length > 0 && (
        <FilterSelect
          label="Client"
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
