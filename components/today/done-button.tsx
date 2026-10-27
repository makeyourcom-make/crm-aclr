"use client";

/**
 * Bouton « Marquer fait » d'une action de la journée.
 *
 * - Appelle l'action serveur `markActivityDone` (droits vérifiés côté
 *   serveur : assertCanEditActivity, garde-fou RDV avant l'heure).
 * - Succès : toast XP du barème (appel +5, email +3, RDV effectué +80) ou
 *   simple confirmation si l'action ne rapporte pas d'XP, puis
 *   router.refresh() pour mettre à jour la liste ET les pilules XP / série
 *   de la topbar.
 * - `data-done-button` : cible du raccourci clavier Espace (TodayShortcuts).
 */
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markActivityDone } from "@/app/(app)/activites/actions";
import { xpToast } from "@/components/arena/celebrate";
import { cn } from "@/lib/utils";

interface DoneButtonProps {
  activityId: string;
  /** Contexte lu par les lecteurs d'écran (« Appel sortant Garage du Chablais »). */
  context: string;
  /** XP rapportés (0 = simple confirmation). */
  xp: number;
  /** Libellé du toast XP (« Appel passé »). */
  xpLabel: string;
  /** Sous-titre du toast (entreprise). */
  xpSub?: string;
  /** RDV encore à venir : exclu du raccourci clavier. */
  future?: boolean;
  /** Bouton icône seul (aperçu de demain). */
  compact?: boolean;
  className?: string;
}

export function DoneButton({
  activityId,
  context,
  xp,
  xpLabel,
  xpSub,
  future = false,
  compact = false,
  className,
}: DoneButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      const res = await markActivityDone(activityId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      setDone(true);
      if (xp > 0) xpToast(xp, xpLabel, xpSub);
      else toast.success("Marquée comme faite.");
      router.refresh();
    });
  };

  const box = (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors",
        done
          ? "border-win-500 bg-win-500 text-white"
          : "border-subtle bg-card text-transparent group-hover/done:border-win-500 group-hover/done:text-win-500",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin text-muted-foreground" strokeWidth={3} />
      ) : (
        <Check className="size-3" strokeWidth={3.5} />
      )}
    </span>
  );

  return (
    <button
      type="button"
      data-done-button=""
      data-future={future ? "true" : undefined}
      onClick={handleClick}
      disabled={pending || done}
      aria-label={`${done ? "Fait" : "Marquer fait"} : ${context}`}
      title={compact ? `Marquer fait : ${context}` : undefined}
      className={cn(
        "group/done inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] border text-[13px] font-bold transition-colors disabled:cursor-default",
        compact ? "size-10" : "h-10 pr-3.5 pl-2.5",
        done
          ? "border-win-500 bg-win-50 text-win-700"
          : "border-border-strong bg-card text-foreground hover:bg-navy-50 disabled:opacity-60",
        className,
      )}
    >
      {box}
      {!compact && <span>{done ? "Fait" : "Marquer fait"}</span>}
    </button>
  );
}
