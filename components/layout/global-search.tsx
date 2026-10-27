"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  globalSearch,
  type GlobalSearchResults,
} from "@/app/(app)/search-actions";
import { Icon } from "@/components/icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const EMPTY: GlobalSearchResults = { prospects: [], deals: [], contracts: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [pending, startTransition] = useTransition();

  // Raccourci ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Saisie : la remise à zéro des résultats se fait ici (gestionnaire
  // d'événement), pas dans l'effet (règle React compiler : pas de setState
  // synchrone dans un effet).
  const onQueryChange = (value: string) => {
    setQ(value);
    if (value.trim().length < 2) setResults(EMPTY);
  };

  // Recherche debounced
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        setResults(await globalSearch(q));
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    setResults(EMPTY);
    router.push(href);
  };

  const total =
    results.prospects.length + results.deals.length + results.contracts.length;

  return (
    <>
      {/* Téléphone : bouton loupe compact. Dès sm : faux champ de recherche. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-10 shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-[12px] border border-border bg-card text-sm text-muted-foreground shadow-[0_1px_2px_rgba(14,25,54,0.04)] transition-colors hover:border-border-strong hover:text-foreground sm:h-11 sm:w-auto sm:max-w-md sm:min-w-0 sm:flex-1 sm:justify-start sm:px-3.5"
        // Le nom accessible reprend le libellé visible (WCAG 2.5.3).
        aria-label="Rechercher une entreprise, un deal, un contrat"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Icon name="Search" className="size-[18px] shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate text-left font-medium sm:inline">
          Rechercher une entreprise, un deal, un contrat...
        </span>
        <kbd className="hidden shrink-0 rounded-[6px] border border-border bg-navy-50 px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          {/* Le champ n'a pas de contour propre : soulignement bleu 2 px au
              focus pour garder un indicateur visible (WCAG 2.4.7). */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 focus-within:shadow-[inset_0_-2px_0_var(--color-info-500)]">
            <Icon name="Search" className="size-[18px] text-muted-foreground" />
            <input
              autoFocus
              type="search"
              aria-label="Rechercher une entreprise, un deal, un contrat"
              value={q}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Rechercher une entreprise, un deal, un contrat..."
              className="h-14 flex-1 bg-transparent text-[15px] outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {pending && (
              <Icon
                name="Loader"
                className="size-4 animate-spin text-muted-foreground"
              />
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                Tape au moins 2 caractères pour rechercher.
              </p>
            ) : total === 0 && !pending ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                Aucun résultat pour « {q.trim()} ».
              </p>
            ) : (
              <>
                <Group label="Entreprises" show={results.prospects.length > 0}>
                  {results.prospects.map((p) => (
                    <Row
                      key={p.id}
                      icon="Building2"
                      tone="bg-info-50 text-info-700"
                      title={p.raisonSociale}
                      subtitle={p.ville ?? undefined}
                      onClick={() => go(`/prospects/${p.id}`)}
                    />
                  ))}
                </Group>
                <Group label="Deals" show={results.deals.length > 0}>
                  {results.deals.map((d) => (
                    <Row
                      key={d.id}
                      icon="SquareKanban"
                      tone="bg-lvl-50 text-lvl-700"
                      title={d.titre}
                      subtitle={d.prospect}
                      onClick={() => go(`/prospects/${d.prospectId}`)}
                    />
                  ))}
                </Group>
                <Group label="Contrats" show={results.contracts.length > 0}>
                  {results.contracts.map((c) => (
                    <Row
                      key={c.id}
                      icon="FileText"
                      tone="bg-navy-100 text-navy-700"
                      title={c.numero}
                      subtitle={c.prospect}
                      onClick={() => go(`/contrats/${c.id}`)}
                    />
                  ))}
                </Group>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="mb-1">
      <p className="px-2 pt-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  icon,
  tone,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  /** Classes de la tuile d'icône (couleur de la rubrique). */
  tone: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left text-sm transition-colors hover:bg-navy-50"
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${tone}`}
      >
        <Icon name={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
      {subtitle && (
        <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      )}
    </button>
  );
}
