"use client";

import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import {
  PROSPECT_SECTEUR_OPTIONS,
  PROSPECT_STATUT_OPTIONS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { ProspectListParams } from "@/lib/schemas/prospect";

import {
  FRAICHEUR_LABEL,
  PROSPECT_FRAICHEURS,
  type ProspectFraicheur,
} from "./lead-views";
import { statutOptionLabel } from "./statut-meta";

interface ProspectFiltersProps {
  params: ProspectListParams;
  /**
   * Liste des commerciales pour le filtre "Assigné à" (admin uniquement).
   * Si vide, le filtre n'est pas affiché.
   */
  users?: Array<{ id: string; name: string }>;
  /** ID de l'utilisateur connecté : sert à libeller "Moi" dans le filtre. */
  currentUserId?: string;
  /** Tags disponibles pour le filtre, visible par tous les users. */
  tags?: Array<{ id: string; nom: string }>;
  /** Produits présents dans des contrats → filtre « Produit » (clients signés). */
  products?: Array<{ id: string; nom: string }>;
  /** Filtre de fraîcheur de la dernière action. */
  fraicheur?: ProspectFraicheur;
}

/** Tris disponibles (mêmes champs que les en-têtes triables historiques). */
const SORT_OPTIONS: { value: ProspectListParams["sortBy"]; label: string }[] = [
  { value: "createdAt", label: "Date d'ajout" },
  { value: "derniereActionLe", label: "Dernière action" },
  { value: "dernierAppelLe", label: "Dernier appel" },
  { value: "dateRdvLe", label: "Date de RDV" },
  { value: "contratDebutLe", label: "Début de contrat" },
  { value: "raisonSociale", label: "Raison sociale" },
  { value: "ville", label: "Lieu" },
  { value: "secteur", label: "Secteur" },
  { value: "statut", label: "Statut" },
  { value: "updatedAt", label: "Dernière modification" },
];

const LABEL = "text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase";
const CONTROL =
  "h-11 w-full rounded-[12px] border border-border-strong bg-card px-3 text-sm font-semibold text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const ACTIVE = "border-info-500 bg-info-50/60";

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
  products,
  fraicheur,
}: ProspectFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const uid = useId();

  // Recherche locale + debounce (300 ms). Si l'URL change (retour arrière,
  // réinitialisation), on resynchronise PENDANT le rendu (pas dans un effet).
  const [search, setSearch] = useState(params.q ?? "");
  const [syncedQ, setSyncedQ] = useState(params.q ?? "");
  if (syncedQ !== (params.q ?? "")) {
    setSyncedQ(params.q ?? "");
    setSearch(params.q ?? "");
  }

  // Filtre Ville : texte libre MULTI, plusieurs villes séparées par des
  // virgules ("Genève, Lausanne"). Une liste à cocher serait inutilisable ici
  // (des milliers de villes distinctes dans la base).
  const villeParam = params.ville.join(", ");
  const [ville, setVille] = useState(villeParam);
  const [syncedVille, setSyncedVille] = useState(villeParam);
  if (syncedVille !== villeParam) {
    setSyncedVille(villeParam);
    setVille(villeParam);
  }

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

  // Debounce sur la ville : on compare les LISTES parsées (pas le texte brut),
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

  const handleSelectChange = (key: string, value: string) => {
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

  const handleSort = (sortBy: string, sortDir: string) => {
    pushParams((sp) => {
      sp.set("sortBy", sortBy);
      sp.set("sortDir", sortDir);
    });
  };

  const hasFilters =
    params.statut.length > 0 ||
    params.secteur.length > 0 ||
    params.ville.length > 0 ||
    params.tagId.length > 0 ||
    params.productId.length > 0 ||
    !!params.avecTel ||
    !!params.assigneAId ||
    !!params.ajouteDepuis ||
    !!params.actionDepuis ||
    !!params.q ||
    !!fraicheur ||
    !!searchParams.get("vue");

  const advancedCount =
    (params.statut.length > 0 ? 1 : 0) +
    (params.secteur.length > 0 ? 1 : 0) +
    (params.ville.length > 0 ? 1 : 0) +
    (params.tagId.length > 0 ? 1 : 0) +
    (params.productId.length > 0 ? 1 : 0) +
    (params.assigneAId ? 1 : 0) +
    (fraicheur ? 1 : 0);
  const [more, setMore] = useState(false);

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const statutOptions = PROSPECT_STATUT_OPTIONS.map((o) => ({
    value: o.value,
    label: statutOptionLabel(o.value),
  }));

  return (
    <div className="flex flex-col gap-3" aria-busy={isPending}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {/* Recherche */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${uid}-q`} className={LABEL}>
            Recherche
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-subtle"
            />
            <input
              id={`${uid}-q`}
              type="search"
              placeholder="Raison sociale, contact, email, ville"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(CONTROL, "pl-10 font-medium", search && ACTIVE)}
            />
          </div>
        </div>

        {/* Filtres avancés : repliés sur téléphone pour garder la liste à portée de pouce. */}
        <div
          id={`${uid}-more`}
          className={cn("contents", !more && "max-sm:hidden")}
        >
        {users && users.length > 1 && (
          <Field label="Commerciale" htmlFor={`${uid}-com`}>
            <SelectBox
              id={`${uid}-com`}
              value={params.assigneAId ?? ""}
              onChange={(e) => handleSelectChange("assigneAId", e.target.value)}
              className={cn(params.assigneAId && ACTIVE)}
            >
              <option value="">Toutes les commerciales</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {currentUserId && u.id === currentUserId
                    ? `Moi (${u.name.split(" ")[0]})`
                    : u.name}
                </option>
              ))}
            </SelectBox>
          </Field>
        )}

        <MultiFilter
          label="Statut"
          allLabel="Tous les statuts"
          values={params.statut}
          onChange={(v) => handleMultiChange("statut", v)}
          options={statutOptions}
        />

        <MultiFilter
          label="Secteur"
          allLabel="Tous les secteurs"
          values={params.secteur}
          onChange={(v) => handleMultiChange("secteur", v)}
          options={PROSPECT_SECTEUR_OPTIONS}
        />

        <Field label="Ville(s)" htmlFor={`${uid}-ville`}>
          <input
            id={`${uid}-ville`}
            type="text"
            placeholder="Ex. Aigle, Monthey"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            title="Plusieurs villes possibles, séparées par des virgules (ex. Genève, Lausanne)"
            className={cn(CONTROL, "font-medium", ville && ACTIVE)}
          />
        </Field>

        <Field label="Dernière action" htmlFor={`${uid}-fresh`}>
          <SelectBox
            id={`${uid}-fresh`}
            value={fraicheur ?? ""}
            onChange={(e) => handleSelectChange("fraicheur", e.target.value)}
            className={cn(fraicheur && ACTIVE)}
          >
            <option value="">Peu importe</option>
            {PROSPECT_FRAICHEURS.map((f) => (
              <option key={f} value={f}>
                {FRAICHEUR_LABEL[f]}
              </option>
            ))}
          </SelectBox>
        </Field>

        {tags && tags.length > 0 && (
          <MultiFilter
            label="Tag"
            allLabel="Tous les tags"
            values={params.tagId}
            onChange={(v) => handleMultiChange("tagId", v)}
            options={tags.map((t) => ({ value: t.id, label: t.nom }))}
          />
        )}

        {products && products.length > 0 && (
          <MultiFilter
            label="Produit"
            allLabel="Tous les produits"
            values={params.productId}
            onChange={(v) => handleMultiChange("productId", v)}
            options={products.map((p) => ({ value: p.id, label: p.nom }))}
          />
        )}

        <Field label="Trier par" htmlFor={`${uid}-sort`}>
          <div className="flex gap-1.5">
            <SelectBox
              id={`${uid}-sort`}
              value={params.sortBy}
              onChange={(e) => handleSort(e.target.value, params.sortDir)}
              wrapperClassName="min-w-0 flex-1"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectBox>
            <button
              type="button"
              onClick={() =>
                handleSort(params.sortBy, params.sortDir === "asc" ? "desc" : "asc")
              }
              aria-label={
                params.sortDir === "asc"
                  ? "Tri croissant. Passer en décroissant"
                  : "Tri décroissant. Passer en croissant"
              }
              title={params.sortDir === "asc" ? "Croissant" : "Décroissant"}
              className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border-strong bg-card text-foreground transition-colors hover:bg-navy-50"
            >
              {params.sortDir === "asc" ? (
                <ArrowUpNarrowWide aria-hidden="true" className="size-[18px]" />
              ) : (
                <ArrowDownWideNarrow aria-hidden="true" className="size-[18px]" />
              )}
            </button>
          </div>
        </Field>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        aria-controls={`${uid}-more`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-border-strong bg-card px-4 text-sm font-bold text-foreground hover:bg-navy-50 sm:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {more ? "Masquer les filtres" : "Plus de filtres"}
        {advancedCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-700 px-1.5 text-[11px] font-extrabold text-white">
            {advancedCount}
          </span>
        )}
      </button>

      {/* NB : les filtres « Avec téléphone », « Ajouté dès » et « Action dès »
          ont été retirés de la barre (demande Arthur). Les paramètres
          `avecTel`, `ajouteDepuis` et `actionDepuis` restent supportés côté
          requête (utilisables via l'URL). */}

      {(hasFilters || isPending) && (
        <div className="flex flex-wrap items-center gap-3">
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="h-9 rounded-[10px] px-2 text-sm font-bold text-foreground underline underline-offset-2 hover:bg-navy-50"
            >
              Réinitialiser les filtres
            </button>
          )}
          {isPending && (
            <span role="status" className="text-xs font-semibold text-muted-foreground">
              Actualisation...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SelectBox({
  className,
  wrapperClassName,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select {...props} className={cn(CONTROL, "appearance-none pr-9", className)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}

interface MultiFilterProps {
  label: string;
  /** Libellé quand rien n'est coché. */
  allLabel: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Filtre multi-sélection : bouton + liste déroulante de cases à cocher.
 * Plusieurs valeurs cochées = OR (ex. Statut « Signé » + « Perdu »).
 */
function MultiFilter({ label, allLabel, values, onChange, options }: MultiFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId();

  // Ferme au clic en dehors et à la touche Échap
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? "1 choix")
        : `${values.length} choix`;

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5" ref={ref}>
      <span id={`${uid}-l`} className={LABEL}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-labelledby={`${uid}-l ${uid}-v`}
        className={cn(CONTROL, "flex items-center gap-2 text-left", values.length > 0 && ACTIVE)}
      >
        <span id={`${uid}-v`} className="min-w-0 flex-1 truncate">
          {summary}
        </span>
        {values.length > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-700 px-1.5 text-[11px] font-extrabold text-white">
            {values.length}
          </span>
        )}
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          id={`${uid}-list`}
          className="absolute top-full left-0 z-50 mt-1 max-h-72 w-full min-w-56 overflow-y-auto rounded-[14px] border border-border bg-popover p-1.5 shadow-arena-lg"
        >
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-sm font-medium hover:bg-navy-50"
            >
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="size-4 shrink-0 cursor-pointer accent-[#0E1936]"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-[10px] border-t border-border px-2.5 py-2 text-left text-xs font-bold text-muted-foreground hover:bg-navy-50"
            >
              Tout décocher
            </button>
          )}
        </div>
      )}
    </div>
  );
}
