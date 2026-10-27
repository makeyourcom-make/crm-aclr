"use client";

/**
 * Bouton générique "Supprimer" avec confirmation.
 *
 * Usage :
 *   <DeleteButton
 *     onDelete={async () => await deleteFoo(id)}
 *     confirmMessage="Supprimer cet email ?"
 *   />
 *
 * Style MYC Arena : bouton icône 32 px (bord #D5DAE6, survol alerte) ou
 * bouton plein « icône + libellé » sur fond alerte clair.
 */
import { Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

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
  /**
   * Où aller après une suppression réussie. À utiliser quand l'élément
   * supprimé EST la page courante (ex. fiche contrat) : sinon un refresh
   * laisserait un 404. Sans valeur : simple router.refresh().
   */
  redirectTo?: string;
}

export function DeleteButton({
  onDelete,
  confirmMessage,
  label = "Supprimer",
  variant = "icon",
  disabled = false,
  disabledReason,
  redirectTo,
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
      if (redirectTo) {
        // L'élément supprimé est la page courante → on quitte vers une page
        // valide (évite un 404 après refresh).
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  const IconCmp = pending ? Loader2 : Trash2;

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        title={disabled ? disabledReason : undefined}
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-alert-50 bg-alert-50 px-2.5 text-xs font-bold text-alert-700 transition-colors hover:border-alert-500/40 hover:bg-alert-50/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconCmp
          aria-hidden="true"
          className={cn("size-3.5", pending && "animate-spin")}
        />
        {pending ? "Suppression…" : label}
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
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border-strong bg-card text-muted-foreground transition-colors hover:border-alert-500/40 hover:bg-alert-50 hover:text-alert-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <IconCmp
        aria-hidden="true"
        className={cn("size-4", pending && "animate-spin")}
      />
    </button>
  );
}
