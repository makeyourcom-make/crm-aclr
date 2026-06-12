"use client";

/**
 * Sélecteur de prospect cherchable (combobox) — remplace le <select> natif
 * inutilisable avec 35 000 entreprises. On tape le nom, ça cherche côté
 * serveur (scopé RLS) et on choisit dans la liste.
 */
import { useEffect, useRef, useState, useTransition } from "react";

import {
  searchProspects,
  type ProspectPickerResult,
} from "@/app/(app)/search-actions";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

interface ProspectComboboxProps {
  /** prospectId sélectionné (contrôlé par le parent). */
  value: string;
  /** Libellé du prospect déjà sélectionné (pré-remplissage). */
  initialLabel?: string;
  onSelect: (id: string, label: string) => void;
  placeholder?: string;
  id?: string;
}

export function ProspectCombobox({
  value,
  initialLabel,
  onSelect,
  placeholder = "Tape le nom de l'entreprise…",
  id,
}: ProspectComboboxProps) {
  const [query, setQuery] = useState(initialLabel ?? "");
  const [committed, setCommitted] = useState(initialLabel ?? "");
  const [results, setResults] = useState<ProspectPickerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  // Recherche debounced
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchProspects(term));
      });
    }, 220);
    return () => clearTimeout(t);
  }, [query, open]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Si rien de valide n'est sélectionné, on rétablit le libellé validé
        setQuery(committed);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [committed]);

  const handleInput = (text: string) => {
    setQuery(text);
    setOpen(true);
    // Tant qu'on n'a pas re-sélectionné, la valeur parent est invalidée
    if (text !== committed && value) onSelect("", "");
  };

  const pick = (p: ProspectPickerResult) => {
    const label = `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}`;
    setCommitted(label);
    setQuery(label);
    setOpen(false);
    setResults([]);
    onSelect(p.id, label);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Icon
          name="Search"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCommitted("");
              setResults([]);
              onSelect("", "");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Effacer"
          >
            <Icon name="X" className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 1 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {pending && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Recherche…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Aucune entreprise trouvée.
            </p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                  value === p.id && "bg-primary/5",
                )}
              >
                <span className="truncate font-medium">{p.raisonSociale}</span>
                {p.ville && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.ville}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
