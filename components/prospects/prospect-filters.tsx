"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import {
  PROSPECT_SECTEUR_OPTIONS,
  PROSPECT_STATUT_OPTIONS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { ProspectListParams } from "@/lib/schemas/prospect";

interface ProspectFiltersProps {
  params: ProspectListParams;
  /**
   * Liste des commerciales pour le filtre "Assigné à" (admin uniquement).
   * Si vide, le filtre n'est pas affiché.
   */
  users?: Array<{ id: string; name: string }>;
  /** ID de l'utilisateur connecté — sert à libeller "Moi" dans le filtre. */
  currentUserId?: string;
  /** Tags disponibles pour le filtre — visible par tous les users. */
  tags?: Array<{ id: string; nom: string }>;
}

/**
 * Barre de filtres pour la liste des prospects.
 *
 * Chaque changement met à jour les query string ; le Server Component
 * re-fetche les données et re-rend la table.
 */
export function ProspectFilters({
  params,
  users,
  currentUserId,
  tags,
}: ProspectFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Recherche locale + debounce (300 ms)
  const [search, setSearch] = useState(params.q ?? "");
  useEffect(() => {
    setSearch(params.q ?? "");
  }, [params.q]);

  // Filtre Ville (texte libre, debounce) — remplace le filtre Canton
  const [ville, setVille] = useState(params.ville ?? "");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVille(params.ville ?? "");
  }, [params.ville]);

  const pushParams = useCallback(
    (mut: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mut(sp);
      // Reset à la page 1 dès qu'un filtre change
      sp.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${sp.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce sur la recherche
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

  // Debounce sur la ville
  useEffect(() => {
    const current = params.ville ?? "";
    if (ville === current) return;
    const t = setTimeout(() => {
      pushParams((sp) => {
        if (ville) sp.set("ville", ville);
        else sp.delete("ville");
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ville]);

  const handleSelectChange = (
    key: keyof ProspectListParams,
    value: string,
  ) => {
    pushParams((sp) => {
      if (value === "" || value === "all") sp.delete(key);
      else sp.set(key, value);
    });
  };

  const hasFilters =
    !!params.statut ||
    !!params.secteur ||
    !!params.ville ||
    !!params.avecTel ||
    !!params.assigneAId ||
    !!params.tagId ||
    !!params.ajouteDepuis ||
    !!params.actionDepuis ||
    !!params.q;

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Recherche */}
      <div className="relative flex-1 min-w-0 sm:min-w-[220px] max-w-md">
        <Icon
          name="Search"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Rechercher (raison sociale, contact, email, ville)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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

      <FilterSelect
        label="Statut"
        value={params.statut ?? ""}
        onChange={(v) => handleSelectChange("statut", v)}
        options={PROSPECT_STATUT_OPTIONS}
      />

      <FilterSelect
        label="Secteur"
        value={params.secteur ?? ""}
        onChange={(v) => handleSelectChange("secteur", v)}
        options={PROSPECT_SECTEUR_OPTIONS}
      />

      <Input
        type="text"
        placeholder="Ville…"
        value={ville}
        onChange={(e) => setVille(e.target.value)}
        aria-label="Ville"
        className={cn("h-9 w-32", ville && "border-primary/40 bg-primary/5")}
      />

      {tags && tags.length > 0 && (
        <FilterSelect
          label="Tag"
          value={params.tagId ?? ""}
          onChange={(v) => handleSelectChange("tagId", v)}
          options={tags.map((t) => ({ value: t.id, label: t.nom }))}
        />
      )}

      {/* NB : les filtres « Avec téléphone », « Ajouté dès » et « Action dès »
          ont été retirés de la barre (demande Arthur). Les paramètres
          `avecTel`, `ajouteDepuis` et `actionDepuis` restent supportés côté
          requête (utilisables via l'URL) et le tri se fait par les en-têtes
          « Date d'ajout » / « Dernière action ». */}

      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Réinitialiser
        </button>
      )}

      {isPending && (
        <span className="text-xs text-muted-foreground">
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
