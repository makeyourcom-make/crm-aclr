"use client";

/**
 * Bouton « Appeler » MYC Arena de la rubrique Entreprises.
 *
 * MÊME mécanique que <ClickToCall /> (components/call) : un clic démarre le
 * SUIVI d'appel du CRM (activité EN_COURS + widget flottant avec chrono) via
 * useCallSession ; la commerciale compose elle-même sur son téléphone, puis
 * « J'ai raccroché » ouvre la modale de résultat. Pas de dialer natif (tel:).
 *
 * Couche de jeu : dès que la session démarre pour CETTE fiche, toast
 * « Appel lancé · +5 XP » (l'appel en cours compte déjà dans le score du
 * jour) et rafraîchissement de la coquille (pilules XP / série).
 *
 * Variantes :
 *   cta    gros bouton coral (fiche)        tile  tuile « Fixe · appeler »
 *   icon   carré 40 px (liste)              inline numéro cliquable
 */
import { Phone, PhoneCall } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { xpToast } from "@/components/arena/celebrate";
import { useCallSession } from "@/components/call/call-session-provider";
import { formatPhone, normalizePhone } from "@/lib/format";
import { XP_RULES } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

export interface CallButtonProps {
  prospectId: string;
  prospectRaisonSociale: string;
  numero: string;
  variant?: "cta" | "icon" | "tile" | "inline";
  /** Libellé principal (cta : « Appeler Marc » ; tile : « Fixe · appeler »). */
  label?: string;
  /** Liste : lead chaud → bouton coral plein. */
  hot?: boolean;
  /** Lead sorti du jeu → bouton neutre. */
  muted?: boolean;
  className?: string;
}

export function CallButton({
  prospectId,
  prospectRaisonSociale,
  numero,
  variant = "icon",
  label,
  hot = false,
  muted = false,
  className,
}: CallButtonProps) {
  const router = useRouter();
  const { startCallSession, session } = useCallSession();
  const normalized = normalizePhone(numero) ?? numero;
  const display = formatPhone(numero);
  const inThisCall = session?.prospectId === prospectId;
  const waiting = useRef(false);

  // Session démarrée pour cette fiche après NOTRE clic → récompense + refresh.
  useEffect(() => {
    if (!waiting.current || !inThisCall) return;
    waiting.current = false;
    xpToast(XP_RULES.appel, "Appel lancé", prospectRaisonSociale);
    router.refresh();
  }, [inThisCall, prospectRaisonSociale, router]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (session && !inThisCall) {
      toast.error(
        "Un appel est déjà en cours. Clique « J'ai raccroché » sur le widget pour le terminer.",
      );
      return;
    }
    if (inThisCall) return;
    waiting.current = true;
    await startCallSession({
      prospectId,
      prospectRaisonSociale,
      numero: normalized,
    });
  };

  const title = inThisCall
    ? `Appel en cours avec ${prospectRaisonSociale}`
    : `Démarrer le suivi d'appel · ${display}`;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={title}
        className={cn(
          "text-left font-semibold text-info-700 tabular-nums underline-offset-2 hover:underline",
          className,
        )}
      >
        {display}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={title}
        aria-label={`Appeler ${prospectRaisonSociale} au ${display}`}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[12px] transition-[transform,background-color] active:translate-y-px",
          inThisCall
            ? "bg-win-500 text-white"
            : muted
              ? "bg-navy-50 text-muted-foreground hover:bg-navy-100"
              : hot
                ? "bg-coral-500 text-white shadow-cta hover:brightness-105"
                : "bg-coral-50 text-coral-600 hover:bg-coral-100",
          className,
        )}
      >
        {inThisCall ? (
          <PhoneCall aria-hidden="true" className="size-[18px] motion-safe:animate-pulse" />
        ) : (
          <Phone aria-hidden="true" className="size-[18px]" />
        )}
      </button>
    );
  }

  if (variant === "tile") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={title}
        className={cn(
          "flex min-h-14 min-w-0 flex-col items-start justify-center rounded-[12px] border border-border bg-coral-50 px-3 py-2.5 text-left text-foreground transition-colors hover:border-coral-400",
          inThisCall && "border-win-500 bg-win-50",
          className,
        )}
      >
        <span
          className={cn(
            "text-[11px] font-bold tracking-[0.08em] uppercase",
            inThisCall ? "text-win-700" : "text-coral-600",
          )}
        >
          {inThisCall ? "Appel en cours" : (label ?? "Appeler")}
        </span>
        <span className="mt-0.5 text-sm font-extrabold tabular-nums break-all">
          {display}
        </span>
      </button>
    );
  }

  // cta
  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={cn(
        "flex min-h-[52px] w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-[12px] px-4 py-2.5 text-white transition-[filter,transform,box-shadow] active:translate-y-px",
        inThisCall
          ? "bg-win-700 shadow-arena"
          : "bg-gradient-coral shadow-cta hover:brightness-[1.04] hover:shadow-[0_10px_26px_rgba(233,82,86,0.42)]",
        className,
      )}
    >
      {inThisCall ? (
        <PhoneCall aria-hidden="true" className="size-5 shrink-0 motion-safe:animate-pulse" />
      ) : (
        <Phone aria-hidden="true" className="size-5 shrink-0" />
      )}
      <span className="text-lg font-extrabold text-shadow-[0_1px_1px_rgba(120,20,26,0.35)]">
        {inThisCall ? "Appel en cours" : (label ?? "Appeler")}
      </span>
      <span className="rounded-full bg-navy-700/30 px-2.5 py-1 text-[13px] font-extrabold tabular-nums">
        {display}
      </span>
      {!inThisCall && (
        <span className="rounded-full bg-navy-700/30 px-2.5 py-1 text-xs font-extrabold tabular-nums">
          +{XP_RULES.appel} XP
        </span>
      )}
    </button>
  );
}
