"use client";

/**
 * Éditeur de texte riche léger pour la rédaction des emails (gras, italique,
 * souligné, listes). S'appuie sur `document.execCommand` — déprécié mais
 * universellement supporté et sans dépendance. Produit du HTML restitué via
 * `onChange`. Non contrôlé (init une fois via `initialHtml`) pour éviter les
 * sauts de curseur : pour réinitialiser, changer la `key` du composant.
 */
import { useRef } from "react";

import { Icon } from "@/components/icon";

interface RichTextEditorProps {
  /** HTML initial (chargé une seule fois au montage). */
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

      {/* Zone éditable */}
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
        // Init une seule fois — React ne re-rend pas ce noeud (pas de children).
        dangerouslySetInnerHTML={{ __html: initialHtml }}
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
