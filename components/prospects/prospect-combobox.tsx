"use client";

/**
 * Sélecteur de prospect cherchable (combobox) — remplace le <select> natif
 * inutilisable avec 35 000 entreprises. On tape le nom, ça cherche côté
 * serveur (scopé RLS) et on choisit dans la liste.
 *
 * La liste est rendue dans un PORTAIL (document.body) avec position fixe :
 * elle échappe ainsi à l'`overflow-hidden` des cartes parentes (sinon elle
 * était rognée). On peut aussi créer un nouveau client à la volée.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { createProspectQuick } from "@/app/(app)/prospects/actions";
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
  /** Autorise la création d'un client à la volée (défaut : true). */
  allowCreate?: boolean;
}

export function ProspectCombobox({
  value,
  initialLabel,
  onSelect,
  placeholder = "Tape le nom de l'entreprise…",
  id,
  allowCreate = true,
}: ProspectComboboxProps) {
  const [query, setQuery] = useState(initialLabel ?? "");
  const [committed, setCommitted] = useState(initialLabel ?? "");
  const [results, setResults] = useState<ProspectPickerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position de la liste (portail) sous l'input.
  const updateRect = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onMove = () => updateRect();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

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

  // Fermeture au clic extérieur (input + menu portail exclus)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        boxRef.current?.contains(t) ||
        menuRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
      setQuery(committed);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [committed]);

  const handleInput = (text: string) => {
    setQuery(text);
    setOpen(true);
    if (text !== committed && value) onSelect("", "");
  };

  const pick = (p: { id: string; raisonSociale: string; ville?: string | null }) => {
    const label = `${p.raisonSociale}${p.ville ? ` · ${p.ville}` : ""}`;
    setCommitted(label);
    setQuery(label);
    setOpen(false);
    setResults([]);
    onSelect(p.id, label);
  };

  const handleCreate = () => {
    const raisonSociale = query.trim();
    if (raisonSociale.length < 2) {
      toast.error("Tape au moins 2 caractères pour le nom du client.");
      return;
    }
    setCreating(true);
    startTransition(async () => {
      const res = await createProspectQuick({ raisonSociale });
      setCreating(false);
      if (!res.ok || !res.prospectId) {
        toast.error(res.error ?? "Échec de la création du client.");
        return;
      }
      toast.success(`Client « ${raisonSociale} » créé ✓`);
      pick({ id: res.prospectId, raisonSociale, ville: null });
    });
  };

  // Une création est proposée si aucun résultat ne correspond EXACTEMENT au
  // texte tapé (insensible à la casse).
  const exactMatch = results.some(
    (r) => r.raisonSociale.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  const showCreate =
    allowCreate && query.trim().length >= 2 && !exactMatch && !pending;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Icon
          name="Search"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
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

      {open &&
        query.trim().length >= 1 &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: rect.top + 4,
              left: rect.left,
              width: rect.width,
            }}
            className="z-[200] max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          >
            {pending && results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Recherche…
              </p>
            ) : results.length === 0 && !showCreate ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Aucune entreprise trouvée.
              </p>
            ) : (
              <>
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      value === p.id && "bg-primary/5",
                    )}
                  >
                    <span className="truncate font-medium">
                      {p.raisonSociale}
                    </span>
                    {p.ville && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.ville}
                      </span>
                    )}
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    <Icon name="Plus" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      Créer le client «&nbsp;<strong>{query.trim()}</strong>&nbsp;»
                    </span>
                  </button>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
