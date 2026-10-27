/**
 * Bouton « Appeler » de Ma journée : habille le click-to-call existant
 * (suivi d'appel CRM + widget chrono, sans composer le numéro).
 *
 * Le libellé passé à ClickToCall reste une CHAÎNE (il sert aussi à son
 * infobulle) ; l'icône téléphone est superposée, décorative.
 *
 * `data-today-call` : cible du raccourci clavier « c » (TodayShortcuts).
 * Server-safe (ClickToCall est le seul îlot client).
 */
import { Phone } from "lucide-react";

import { ClickToCall } from "@/components/call/click-to-call";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CallButtonProps {
  prospectId: string;
  raisonSociale: string;
  telephone: string;
  /** `primary` (navy, avec numéro) · `outline` (secondaire) · `icon` (icône seule). */
  variant?: "primary" | "outline" | "icon";
  /** Libellé (défaut « Appeler »). */
  label?: string;
  /** Affiche le numéro après le libellé (défaut : oui en `primary`). */
  showNumber?: boolean;
  className?: string;
}

export function CallButton({
  prospectId,
  raisonSociale,
  telephone,
  variant = "primary",
  label = "Appeler",
  showNumber,
  className,
}: CallButtonProps) {
  const withNumber = showNumber ?? variant === "primary";
  const text =
    variant === "icon"
      ? `${label} ${raisonSociale}`
      : withNumber
        ? `${label} · ${formatPhone(telephone)}`
        : label;

  return (
    <span data-today-call="" className={cn("relative inline-flex max-w-full shrink-0", className)}>
      <ClickToCall
        prospectId={prospectId}
        prospectRaisonSociale={raisonSociale}
        numero={telephone}
        className={cn(
          "inline-flex max-w-full items-center rounded-[12px] text-[13px] font-bold tabular-nums transition-colors hover:no-underline",
          variant === "primary" &&
            "min-h-10 bg-navy-700 py-1.5 pr-3.5 pl-9 text-left text-white hover:bg-navy-600",
          variant === "outline" &&
            "h-10 border border-border-strong bg-card pr-3.5 pl-9 whitespace-nowrap text-foreground hover:bg-navy-50",
          // Icône seule : le texte (nom accessible + infobulle) est masqué par débordement.
          variant === "icon" &&
            "size-10 overflow-hidden border border-border-strong bg-card text-[0px] whitespace-nowrap text-transparent hover:bg-navy-50",
        )}
      >
        {text}
      </ClickToCall>
      <Phone
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2",
          variant === "primary" && "left-3.5 text-white",
          variant === "outline" && "left-3.5 text-foreground",
          variant === "icon" && "left-1/2 -translate-x-1/2 text-foreground",
        )}
      />
    </span>
  );
}
