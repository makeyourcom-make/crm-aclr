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

  // Recherche debounced
  useEffect(() => {
    if (q.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(EMPTY);
      return;
    }
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Recherche globale"
      >
        <Icon name="Search" className="h-4 w-4" />
        <span className="flex-1 text-left">
          Rechercher prospect, deal, contrat…
        </span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Icon name="Search" className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une entreprise, un deal, un contrat…"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
            {pending && (
              <Icon
                name="Loader"
                className="h-4 w-4 animate-spin text-muted-foreground"
              />
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Tape au moins 2 caractères pour rechercher.
              </p>
            ) : total === 0 && !pending ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Aucun résultat pour « {q.trim()} ».
              </p>
            ) : (
              <>
                <Group label="Entreprises" show={results.prospects.length > 0}>
                  {results.prospects.map((p) => (
                    <Row
                      key={p.id}
                      icon="Users"
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
                      icon="GitBranch"
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
      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
    >
      <Icon name={icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      {subtitle && (
        <span className="shrink-0 truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      )}
    </button>
  );
}
