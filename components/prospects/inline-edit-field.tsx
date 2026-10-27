"use client";

/**
 * Champ éditable AU CLIC sur la fiche client (sans passer par « Modifier »).
 *
 *  - Sans `displayNode` : la valeur elle-même est cliquable → passe en input.
 *  - Avec `displayNode` (ex. numéro cliquable pour le suivi d'appel) : on
 *    garde l'affichage riche et un crayon (toujours visible, cible tactile)
 *    déclenche l'édition.
 *
 * Sauvegarde à la validation (Entrée) ou à la perte de focus ; Échap annule.
 */
import { ExternalLink, Globe, Mail, Pencil, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { updateProspectField } from "@/app/(app)/prospects/actions";

const OPEN_ICONS: Record<string, LucideIcon> = {
  ExternalLink,
  Globe,
  Mail,
};

interface InlineEditFieldProps {
  prospectId: string;
  field: string;
  value: string | null;
  type?: "text" | "number";
  placeholder?: string;
  /** Nom lisible du champ (accessibilité : « Modifier l'email »). */
  label?: string;
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
  label,
  openHref,
  openIcon = "ExternalLink",
  displayNode,
}: InlineEditFieldProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const name = label ?? field;
  const OpenIcon = OPEN_ICONS[openIcon] ?? ExternalLink;

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
        aria-label={name}
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
        className="h-10 w-full rounded-[10px] border border-info-500 bg-card px-2.5 text-sm font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    );
  }

  const pencil = (
    <button
      type="button"
      onClick={startEdit}
      aria-label={`Modifier : ${name}`}
      title="Modifier"
      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-subtle transition-colors hover:bg-navy-50 hover:text-foreground"
    >
      <Pencil aria-hidden="true" className="size-3.5" />
    </button>
  );

  // Affichage riche préservé (téléphone cliquable, etc.) : édition via crayon.
  if (displayNode) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">{displayNode}</div>
        {pencil}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={startEdit}
        title="Cliquer pour modifier"
        aria-label={value ? `${name} : ${value}. Modifier` : `Ajouter : ${name}`}
        className="min-h-8 min-w-0 flex-1 rounded-[8px] text-left text-sm font-bold break-words hover:text-info-700"
      >
        {value ? (
          <span className="break-all">{value}</span>
        ) : (
          <span className="font-semibold text-gold-700">{placeholder}</span>
        )}
      </button>
      {value && openHref && (
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ouvrir : ${name}`}
          title="Ouvrir"
          className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-subtle transition-colors hover:bg-navy-50 hover:text-foreground"
        >
          <OpenIcon aria-hidden="true" className="size-3.5" />
        </a>
      )}
      {pencil}
    </div>
  );
}
