"use client";

/**
 * Champ destinataire(s) avec suggestions clients : on tape une raison sociale,
 * un nom de contact ou un début d'email, on choisit dans la liste et l'adresse
 * est insérée. Plusieurs adresses séparées par « , » ou « ; » (mode multiple).
 */
import { useRef, useState } from "react";

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
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
          className,
        )}
      />
      {open && hits.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg">
          {hits.map((h, i) => {
            const contact = [h.contactPrenom, h.contactNom].filter(Boolean).join(" ");
            return (
              <li key={h.id}>
                <button
                  type="button"
                  // mousedown + preventDefault : le choix passe avant le blur du champ.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-sm",
                    i === active ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <span className="font-medium">{h.raisonSociale}</span>
                  {contact && <span className="text-muted-foreground"> · {contact}</span>}
                  <span className="block text-xs text-muted-foreground">{h.email}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
