"use client";

/**
 * Éditeur de texte riche léger pour la rédaction des emails (gras, italique,
 * souligné, listes). S'appuie sur `document.execCommand` — déprécié mais
 * universellement supporté et sans dépendance. Produit du HTML restitué via
 * `onChange`.
 *
 * IMPORTANT : la zone éditable est un `contentEditable` NON contrôlé par React.
 * On injecte le HTML initial une seule fois (au montage, via `ref`), et React
 * ne re-rend jamais son contenu ensuite. Utiliser `dangerouslySetInnerHTML` +
 * `contentEditable` ferait réécrire le DOM par React à chaque frappe (curseur
 * qui saute / impossible d'écrire). Pour repartir d'un contenu neuf (reset,
 * chargement d'un template), changer la `key` du composant pour le remonter.
 */
import { useEffect, useRef } from "react";

import { Icon } from "@/components/icon";

interface RichTextEditorProps {
  /** HTML initial (injecté une seule fois au montage). */
  initialHtml?: string;
  /** Appelé à chaque frappe avec le HTML courant. */
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Classe Tailwind de hauteur mini de la zone d'édition. */
  minHeightClass?: string;
}

export function RichTextEditor({
  initialHtml = "",
  onChange,
  placeholder,
  disabled = false,
  minHeightClass = "min-h-[180px]",
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Injecte le HTML initial une seule fois (au montage). Volontairement pas de
  // dépendance sur `initialHtml` : les frappes suivantes ne doivent pas être
  // écrasées. Un changement d'`initialHtml` passe par un remontage (key).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const exec = (command: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false);
    emit();
  };

  return (
    <div className="rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-primary/20">
      {/* Barre d'outils */}
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarButton
          label="Gras"
          icon="Bold"
          disabled={disabled}
          onClick={() => exec("bold")}
        />
        <ToolbarButton
          label="Italique"
          icon="Italic"
          disabled={disabled}
          onClick={() => exec("italic")}
        />
        <ToolbarButton
          label="Souligné"
          icon="Underline"
          disabled={disabled}
          onClick={() => exec("underline")}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Liste à puces"
          icon="List"
          disabled={disabled}
          onClick={() => exec("insertUnorderedList")}
        />
      </div>

      {/* Zone éditable — non contrôlée par React (cf. commentaire en tête). */}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        aria-label="Corps du message"
        className={`max-w-none overflow-y-auto px-3 py-2 text-sm leading-relaxed outline-none ${minHeightClass} [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // onMouseDown + preventDefault : garde la sélection dans l'éditeur au clic.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
    </button>
  );
}
