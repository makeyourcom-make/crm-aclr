"use client";

/**
 * Champ destinataire(s) avec suggestions clients : on tape une raison sociale,
 * un nom de contact ou un début d'email, on choisit dans la liste et l'adresse
 * est insérée. Plusieurs adresses séparées par « , » ou « ; » (mode multiple).
 */
import { useId, useRef, useState } from "react";

import { searchProspectsForAttach } from "@/app/(app)/emails/actions";
import type { ProspectSearchHit } from "@/lib/prospect-search";
import { cn } from "@/lib/utils";

/** Dernier morceau en cours de saisie (après la dernière virgule / point-virgule). */
function lastToken(value: string): string {
  const parts = value.split(/[,;]/);
  return (parts[parts.length - 1] ?? "").trim();
}

export function RecipientInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  autoFocus,
  multiple = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  /** false = une seule adresse (le choix remplace le contenu). */
  multiple?: boolean;
}) {
  const [hits, setHits] = useState<ProspectSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const listId = useId();

  const search = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    const q = multiple ? lastToken(raw) : raw.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    const s = ++seq.current;
    timer.current = setTimeout(() => {
      void searchProspectsForAttach(q).then((r) => {
        if (s !== seq.current) return;
        const withEmail = r.filter((h) => h.email);
        setHits(withEmail);
        setActive(0);
        setOpen(withEmail.length > 0);
      });
    }, 250);
  };

  const pick = (h: ProspectSearchHit) => {
    if (!h.email) return;
    if (!multiple) {
      onChange(h.email);
    } else {
      const idx = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
      const head = idx >= 0 ? `${value.slice(0, idx + 1).trimEnd()} ` : "";
      onChange(`${head}${h.email}, `);
    }
    seq.current++;
    setHits([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open || hits.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            const h = hits[active];
            if (h) {
              e.preventDefault();
              pick(h);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => setOpen(false)}
        role="combobox"
        aria-controls={listId}
        aria-expanded={open && hits.length > 0}
        aria-autocomplete="list"
        className={cn(
          "h-10 w-full min-w-0 rounded-[12px] border border-border-strong bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-info-500 focus-visible:ring-3 focus-visible:ring-info-500/25 disabled:opacity-60",
          className,
        )}
      />
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-[14px] border border-border bg-popover p-1 shadow-arena-lg"
        >
          {hits.map((h, i) => {
            const contact = [h.contactPrenom, h.contactNom].filter(Boolean).join(" ");
            return (
              <li key={h.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // mousedown + preventDefault : le choix passe avant le blur du champ.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors",
                    i === active ? "bg-navy-50" : "hover:bg-navy-50",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                      h.isClient ? "bg-win-50 text-win-700" : "bg-info-50 text-info-700",
                    )}
                  >
                    {(h.raisonSociale || "?").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-bold">{h.raisonSociale}</span>
                      {h.isClient && (
                        <span className="shrink-0 rounded-full bg-win-50 px-2 py-0.5 text-[11px] font-bold text-win-700">
                          Client
                        </span>
                      )}
                    </span>
                    {contact && (
                      <span className="block truncate text-xs text-foreground">{contact}</span>
                    )}
                    <span className="block truncate text-xs text-muted-foreground">{h.email}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
