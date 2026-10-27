"use client";

/**
 * Barre de filtres pour /charges :
 *  - Recherche (fournisseur, description, référence)
 *  - Filtre Catégorie
 *  - Filtre Période (mois courant, mois précédent, trimestre, année)
 *  - Filtre Statut de paiement
 *  - Le tri se fait via les en-têtes cliquables
 */
import { Loader2, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { FIELD_CLASS, SELECT_CLASS } from "@/components/common/form-styles";
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
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "PAYE", label: "Payé" },
  { value: "LITIGE", label: "Litige" },
  { value: "REMBOURSE", label: "Remboursé" },
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

  // Champ de recherche contrôlé, resynchronisé quand l'URL change (bouton
  // Réinitialiser, navigation). Mise à jour pendant le rendu (motif React
  // « état dérivé d'une prop ») plutôt que dans un effet.
  const [search, setSearch] = useState(currentQ);
  const [syncedQ, setSyncedQ] = useState(currentQ);
  if (syncedQ !== currentQ) {
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
    <div
      role="search"
      aria-label="Filtrer les charges"
      className="flex flex-wrap items-center gap-2"
    >
      <label className="relative w-full min-w-0 sm:w-auto sm:min-w-[260px] sm:flex-1 lg:max-w-md">
        <span className="sr-only">Rechercher une charge</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          placeholder="Rechercher (fournisseur, description, n°)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(FIELD_CLASS, "pl-10")}
        />
      </label>

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
          type="button"
          onClick={clearAll}
          className="inline-flex h-11 items-center gap-1.5 rounded-[12px] px-3 text-sm font-bold text-foreground transition-colors hover:bg-navy-50"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Réinitialiser
        </button>
      )}

      {isPending && (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
        >
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          Actualisation…
        </span>
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
        SELECT_CLASS,
        "w-auto min-w-[140px] flex-1 sm:flex-none",
        value && "border-navy-700 bg-navy-50 font-bold",
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
