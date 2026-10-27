"use client";

/**
 * Éditeur de texte riche léger pour la rédaction des emails (gras, italique,
 * souligné, listes, liens). S'appuie sur `document.execCommand` : déprécié
 * mais universellement supporté et sans dépendance. Produit du HTML restitué
 * via `onChange`.
 *
 * IMPORTANT : la zone éditable est un `contentEditable` NON contrôlé par React.
 * On injecte le HTML initial une seule fois (au montage, via `ref`), et React
 * ne re-rend jamais son contenu ensuite. Utiliser `dangerouslySetInnerHTML` +
 * `contentEditable` ferait réécrire le DOM par React à chaque frappe (curseur
 * qui saute / impossible d'écrire). Pour repartir d'un contenu neuf (reset,
 * chargement d'un template), changer la `key` du composant pour le remonter.
 *
 * `variables` (optionnel) : pastilles {{prenomContact}}… insérées au curseur.
 * À ne passer que lorsque le serveur les remplace (mail lié à un client).
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
  /** Variables insérables au curseur (ex. « {{prenomContact}} »). */
  variables?: string[];
  /** Nom accessible de la zone d'édition (défaut « Corps du message »). */
  ariaLabel?: string;
  /** Pied de l'éditeur (ex. aperçu de la signature). */
  footer?: React.ReactNode;
}

export function RichTextEditor({
  initialHtml = "",
  onChange,
  placeholder,
  disabled = false,
  minHeightClass = "min-h-[180px]",
  variables,
  ariaLabel = "Corps du message",
  footer,
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

  const exec = (command: string, value?: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const insertLink = () => {
    if (disabled) return;
    const url = window.prompt("Adresse du lien (https://…)", "https://");
    if (!url || !/^(https?:\/\/|mailto:)\S+/i.test(url.trim())) return;
    exec("createLink", url.trim());
  };

  const insertVariable = (v: string) => exec("insertText", v);

  return (
    <div className="overflow-hidden rounded-[14px] border border-border-strong bg-card transition-shadow focus-within:border-info-500 focus-within:ring-3 focus-within:ring-info-500/25">
      {/* Barre d'outils */}
      <div
        role="toolbar"
        aria-label="Mise en forme"
        className="flex flex-wrap items-center gap-1 border-b border-border bg-ground px-2 py-1.5"
      >
        <ToolbarButton label="Gras" icon="Bold" disabled={disabled} onClick={() => exec("bold")} />
        <ToolbarButton label="Italique" icon="Italic" disabled={disabled} onClick={() => exec("italic")} />
        <ToolbarButton label="Souligné" icon="Underline" disabled={disabled} onClick={() => exec("underline")} />
        <span className="mx-1 h-5 w-px bg-border-strong" aria-hidden />
        <ToolbarButton
          label="Liste à puces"
          icon="List"
          disabled={disabled}
          onClick={() => exec("insertUnorderedList")}
        />
        <ToolbarButton label="Insérer un lien" icon="Link" disabled={disabled} onClick={insertLink} />
        {variables && variables.length > 0 && (
          <>
            <span className="mx-1 h-5 w-px bg-border-strong" aria-hidden />
            <span className="mr-0.5 text-xs font-semibold text-muted-foreground">Variables :</span>
            {variables.map((v) => (
              <button
                key={v}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertVariable(v)}
                disabled={disabled}
                aria-label={`Insérer la variable ${v}`}
                className="h-7 rounded-[8px] border border-border bg-card px-2 font-mono text-[11px] font-bold text-lvl-700 transition-colors hover:border-lvl-500 hover:bg-lvl-50 disabled:opacity-50"
              >
                {v}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Zone éditable : non contrôlée par React (cf. commentaire en tête). */}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        className={`max-w-none overflow-y-auto px-4 py-3 text-sm leading-relaxed text-foreground outline-none ${minHeightClass} [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)] [&_a]:text-info-700 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
      />

      {footer}
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
      className="flex size-8 items-center justify-center rounded-[8px] text-foreground transition-colors hover:bg-navy-100 disabled:opacity-50"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
