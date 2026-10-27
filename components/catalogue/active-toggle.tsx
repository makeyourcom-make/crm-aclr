/**
 * Interrupteur « en ligne / hors ligne » d'un produit (MYC Arena) :
 * piste verte quand actif, grise sinon, `role="switch"` + état annoncé.
 * Composant de présentation (pas de hook) : l'action est fournie par le parent.
 */
import { cn } from "@/lib/utils";

export function ActiveToggle({
  active,
  onToggle,
  disabled,
  productName,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  productName: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      disabled={disabled}
      aria-label={`${productName} : ${active ? "actif (cliquer pour désactiver)" : "inactif (cliquer pour activer)"}`}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 disabled:opacity-60",
        active ? "bg-win-500" : "bg-border-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(14,25,54,0.25)] transition-transform",
          active && "translate-x-5",
        )}
      />
    </button>
  );
}
