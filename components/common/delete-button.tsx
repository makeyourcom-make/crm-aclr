"use client";

/**
 * Bouton générique "Supprimer" avec confirmation.
 *
 * Usage :
 *   <DeleteButton
 *     onDelete={async () => await deleteFoo(id)}
 *     confirmMessage="Supprimer cet email ?"
 *   />
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icon";

interface DeleteButtonProps {
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
  confirmMessage: string;
  /** Label optionnel à côté de l'icône. Sans label = bouton icône seule. */
  label?: string;
  /** "icon" (par défaut, juste l'icône poubelle) ou "full" (icône + label) */
  variant?: "icon" | "full";
  /** Si true, désactive le bouton avec un titre explicatif. */
  disabled?: boolean;
  disabledReason?: string;
}

export function DeleteButton({
  onDelete,
  confirmMessage,
  label = "Supprimer",
  variant = "icon",
  disabled = false,
  disabledReason,
}: DeleteButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    if (!confirm(confirmMessage)) return;
    startTransition(async () => {
      const res = await onDelete();
      if (!res.ok) {
        alert(res.error ?? "Erreur lors de la suppression.");
        return;
      }
      router.refresh();
    });
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        title={disabled ? disabledReason : undefined}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon
          name={pending ? "Loader" : "Trash2"}
          className={`h-3 w-3 ${pending ? "animate-spin" : ""}`}
        />
        {pending ? "…" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      title={disabled ? disabledReason : label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon
        name={pending ? "Loader" : "Trash2"}
        className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
      />
    </button>
  );
}
