"use client";

/**
 * Composant cliquable qui remplace l'affichage d'un numéro de téléphone.
 *
 * Comportement :
 *   - Sur mobile : ouvre le dialer natif via protocole tel:
 *   - Sur desktop : ouvre le dialer par défaut (Skype/Teams/Webex)
 *   - Démarre simultanément une session d'appel CRM (Activity EN_COURS +
 *     widget flottant avec timer) via useCallSession.
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
    // On ne bloque PAS le tel: natif — on lance la session en parallèle pour
    // que le widget soit prêt quand le user raccroche.
    e.stopPropagation();
    if (isCallActive && !isThisProspectInCall) {
      e.preventDefault();
      const { toast } = await import("sonner");
      toast.error(
        "Un appel est déjà en cours. Termine-le avant d'en démarrer un nouveau.",
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
    <a
      href={`tel:${normalized.replace(/\s/g, "")}`}
      onClick={handleClick}
      className={cn(
        inline
          ? "text-primary hover:underline"
          : "inline-flex items-center gap-1 rounded-md text-primary hover:underline",
        className,
      )}
      aria-label={`Appeler ${prospectRaisonSociale} au ${display}`}
    >
      {display}
    </a>
  );
}
