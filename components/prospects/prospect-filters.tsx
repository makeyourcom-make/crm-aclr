"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

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

  // Filtre Ville : texte libre MULTI — plusieurs villes séparées par des
  // virgules ("Genève, Lausanne"). Une liste à cocher serait inutilisable ici
  // (des milliers de villes distinctes dans la base).
  const villeParam = params.ville.join(", ");
  const [ville, setVille] = useState(villeParam);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVille(villeParam);
  }, [villeParam]);

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

  // Debounce sur la ville — on compare les LISTES parsées (pas le texte brut),
  // sinon "Genève,Lausanne" et "Genève, Lausanne" divergeraient en boucle.
  useEffect(() => {
    const parsed = ville
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.join(",") === params.ville.join(",")) return;
    const t = setTimeout(() => {
      pushParams((sp) => {
        if (parsed.length > 0) sp.set("ville", parsed.join(","));
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

  /** Filtre multi-valeurs → écrit "a,b,c" dans l'URL (ou retire le param). */
  const handleMultiChange = (key: keyof ProspectListParams, values: string[]) => {
    pushParams((sp) => {
      if (values.length === 0) sp.delete(key);
      else sp.set(key, values.join(","));
    });
  };

  const hasFilters =
    params.statut.length > 0 ||
    params.secteur.length > 0 ||
    params.ville.length > 0 ||
    params.tagId.length > 0 ||
    !!params.avecTel ||
    !!params.assigneAId ||
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

      <MultiFilter
        label="Statut"
        values={params.statut}
        onChange={(v) => handleMultiChange("statut", v)}
        options={PROSPECT_STATUT_OPTIONS}
      />

      <MultiFilter
        label="Secteur"
        values={params.secteur}
        onChange={(v) => handleMultiChange("secteur", v)}
        options={PROSPECT_SECTEUR_OPTIONS}
      />

      <Input
        type="text"
        placeholder="Ville(s)…"
        value={ville}
        onChange={(e) => setVille(e.target.value)}
        aria-label="Villes (séparées par des virgules)"
        title="Plusieurs villes possibles, séparées par des virgules — ex. Genève, Lausanne"
        className={cn("h-9 w-40", ville && "border-primary/40 bg-primary/5")}
      />

      {tags && tags.length > 0 && (
        <MultiFilter
          label="Tag"
          values={params.tagId}
          onChange={(v) => handleMultiChange("tagId", v)}
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

interface MultiFilterProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Filtre multi-sélection : bouton + liste déroulante de cases à cocher.
 * Plusieurs valeurs cochées = OR (ex. Statut « Signé » + « Perdu »).
 */
function MultiFilter({ label, values, onChange, options }: MultiFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Ferme au clic en dehors
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const toggle = (v: string) =>
    onChange(
      values.includes(v) ? values.filter((x) => x !== v) : [...values, v],
    );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm",
          values.length > 0 && "border-primary/40 bg-primary/5",
        )}
      >
        {label}
        {values.length > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {values.length}
          </span>
        )}
        <Icon name="ChevronDown" className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Tout décocher
            </button>
          )}
        </div>
      )}
    </div>
  );
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
