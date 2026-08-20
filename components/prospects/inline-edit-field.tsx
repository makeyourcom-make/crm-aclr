"use client";

/**
 * Champ éditable AU CLIC sur la fiche client (sans passer par « Modifier »).
 *
 *  - Sans `displayNode` : la valeur elle-même est cliquable → passe en input.
 *  - Avec `displayNode` (ex. bouton Click-to-call à préserver) : on garde
 *    l'affichage riche et un crayon au survol déclenche l'édition.
 *
 * Sauvegarde à la validation (Entrée) ou à la perte de focus ; Échap annule.
 */
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProspectField } from "@/app/(app)/prospects/actions";
import { Icon } from "@/components/icon";

interface InlineEditFieldProps {
  prospectId: string;
  field: string;
  value: string | null;
  type?: "text" | "number";
  placeholder?: string;
  /** Lien externe à ouvrir depuis l'affichage (mailto:, https://…). */
  openHref?: string | null;
  openIcon?: string;
  /** Affichage riche personnalisé (l'édition passe alors par un crayon). */
  displayNode?: ReactNode;
}

export function InlineEditField({
  prospectId,
  field,
  value,
  type = "text",
  placeholder = "Ajouter",
  openHref,
  openIcon = "ExternalLink",
  displayNode,
}: InlineEditFieldProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const trimmed = val.trim();
    if (trimmed === (value ?? "")) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateProspectField(prospectId, field, trimmed);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const startEdit = () => {
    setVal(value ?? "");
    setEditing(true);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type={type === "number" ? "number" : "text"}
        value={val}
        disabled={pending}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setVal(value ?? "");
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-primary/50 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    );
  }

  // Affichage riche préservé (téléphone cliquable, etc.) : édition via crayon.
  if (displayNode) {
    return (
      <div className="group flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{displayNode}</div>
        <button
          type="button"
          onClick={startEdit}
          title="Modifier"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
        >
          <Icon name="Pencil" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5">
      <button
        type="button"
        onClick={startEdit}
        title="Cliquer pour modifier"
        className="min-w-0 flex-1 truncate text-left hover:text-primary"
      >
        {value ? (
          <span className="break-all">{value}</span>
        ) : (
          <span className="text-muted-foreground">
            —{" "}
            <span className="text-xs opacity-0 group-hover:opacity-100">
              ({placeholder})
            </span>
          </span>
        )}
      </button>
      {value && openHref && (
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          title="Ouvrir"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
        >
          <Icon name={openIcon} className="h-3.5 w-3.5" />
        </a>
      )}
      <Icon
        name="Pencil"
        className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
      />
    </div>
  );
}
