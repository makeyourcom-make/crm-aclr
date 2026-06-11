"use client";

/**
 * Numéro de téléphone cliquable qui démarre le SUIVI d'appel (sans passer
 * d'appel réel) :
 *   - clic → crée une session d'appel CRM (Activity EN_COURS + widget flottant
 *     avec chrono) via useCallSession.
 *   - l'utilisateur compose lui-même sur son téléphone.
 *   - « J'ai raccroché » → modale de résultat (durée + résultat) → stats.
 *
 * On NE déclenche PAS le dialer natif (tel:) : ça provoquait une navigation
 * parasite et l'utilisateur ne veut pas d'appel automatique.
 */
import { useCallSession } from "@/components/call/call-session-provider";
import { formatPhone, normalizePhone } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ClickToCallProps {
  prospectId: string;
  prospectRaisonSociale: string;
  numero: string;
  className?: string;
  /** Si true, affiche un look "lien" plus discret. Default false (badge bouton). */
  inline?: boolean;
  /** Style additionnel pour le numéro affiché. */
  children?: React.ReactNode;
}

export function ClickToCall({
  prospectId,
  prospectRaisonSociale,
  numero,
  className,
  inline,
  children,
}: ClickToCallProps) {
  const { startCallSession, session } = useCallSession();
  const normalized = normalizePhone(numero) ?? numero;
  const display = children ?? formatPhone(numero);
  const isCallActive = !!session;
  const isThisProspectInCall = session?.prospectId === prospectId;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCallActive && !isThisProspectInCall) {
      const { toast } = await import("sonner");
      toast.error(
        "Un appel est déjà en cours. Clique « J'ai raccroché » sur le widget pour le terminer.",
      );
      return;
    }
    if (!isThisProspectInCall) {
      await startCallSession({
        prospectId,
        prospectRaisonSociale,
        numero: normalized,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        inline
          ? "text-left text-primary hover:underline"
          : "inline-flex items-center gap-1 rounded-md text-primary hover:underline",
        className,
      )}
      title={`Démarrer le suivi d'appel — ${display}`}
    >
      {display}
    </button>
  );
}
