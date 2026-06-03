"use client";

/**
 * Barre de filtres pour /charges :
 *  - Recherche (fournisseur, description, référence, notes)
 *  - Filtre Catégorie
 *  - Filtre Période (mois courant, mois précédent, trimestre, année)
 *  - Le tri se fait via les en-têtes cliquables
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATEGORIE_OPTIONS = [
  { value: "LOYER", label: "Loyer" },
  { value: "SOFTWARE_SAAS", label: "Software" },
  { value: "MARKETING", label: "Marketing" },
  { value: "PUBLICITE", label: "Publicité" },
  { value: "DEPLACEMENTS", label: "Déplacements" },
  { value: "RESTAURATION", label: "Restauration" },
  { value: "MATERIEL_BUREAU", label: "Matériel" },
  { value: "ASSURANCES", label: "Assurances" },
  { value: "TELECOM", label: "Télécom" },
  { value: "FORMATION", label: "Formation" },
  { value: "HONORAIRES", label: "Honoraires" },
  { value: "IMPOTS", label: "Impôts" },
  { value: "BANQUE_FRAIS", label: "Frais bancaires" },
  { value: "AUTRE", label: "Autre" },
];

const PERIODE_OPTIONS = [
  { value: "month", label: "Ce mois" },
  { value: "prev-month", label: "Mois précédent" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "ytd", label: "Année en cours (YTD)" },
  { value: "12m", label: "12 derniers mois" },
];

const STATUT_OPTIONS = [
  { value: "EN_ATTENTE", label: "🟡 En attente" },
  { value: "PAYE", label: "✓ Payé" },
  { value: "LITIGE", label: "⚠ Litige" },
  { value: "REMBOURSE", label: "↩ Remboursé" },
];

export function ExpenseFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQ = searchParams.get("q") ?? "";
  const currentCat = searchParams.get("categorie") ?? "";
  const currentPeriode = searchParams.get("periode") ?? "";
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
    !!currentCat ||
    !!currentPeriode ||
    !!currentQ ||
    !!currentStatut ||
    !!currentSortBy;

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
          placeholder="Rechercher (fournisseur, description, n°)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <FilterSelect
        label="Catégorie"
        value={currentCat}
        onChange={(v) => setParam("categorie", v)}
        options={CATEGORIE_OPTIONS}
      />

      <FilterSelect
        label="Période"
        value={currentPeriode}
        onChange={(v) => setParam("periode", v)}
        options={PERIODE_OPTIONS}
      />

      <FilterSelect
        label="Statut paiement"
        value={currentStatut}
        onChange={(v) => setParam("statut", v)}
        options={STATUT_OPTIONS}
      />

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
