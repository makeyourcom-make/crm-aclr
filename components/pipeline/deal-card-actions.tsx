"use client";

/**
 * Actions compactes d'une carte deal :
 *  - <CallDealButton />  démarre le SUIVI d'appel CRM (widget + modale de
 *    résultat) comme le numéro cliquable de la fiche, sans lancer le dialer ;
 *  - <StageMenu />       changement d'étape au clavier / au doigt (alternative
 *    accessible au glisser-déposer), ouverture et modification du deal.
 */
import type { DealStage } from "@prisma/client";
import { ArrowRightLeft, Eye, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { xpToast } from "@/components/arena";
import { useCallSession } from "@/components/call/call-session-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPhone, normalizePhone } from "@/lib/format";
import { XP_RULES } from "@/lib/gamification/rules";
import type { PipelineDeal } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import { ALL_STAGES, STAGE_META } from "./pipeline-meta";

const ICON_BTN =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border-strong bg-card transition-colors hover:bg-navy-50 disabled:pointer-events-none disabled:opacity-50";

export function CallDealButton({ deal }: { deal: PipelineDeal }) {
  const router = useRouter();
  const { startCallSession, session } = useCallSession();
  const inThisCall = session?.prospectId === deal.prospect.id;
  const raisonSociale = deal.prospect.raisonSociale;
  const waiting = useRef(false);

  // Session démarrée pour CE prospect après NOTRE clic : l'appel EN_COURS
  // compte déjà dans le score du jour → toast XP + rafraîchissement de la
  // coquille (pilules XP / série), comme le bouton Appeler des Entreprises.
  useEffect(() => {
    if (!waiting.current || !inThisCall) return;
    waiting.current = false;
    xpToast(XP_RULES.appel, "Appel lancé", raisonSociale);
    router.refresh();
  }, [inThisCall, raisonSociale, router]);

  const numero = deal.prospect.telephone;
  if (!numero) return null;

  const display = formatPhone(numero);

  const handleClick = async () => {
    if (session && !inThisCall) {
      toast.error(
        "Un appel est déjà en cours. Clique « J'ai raccroché » sur le widget pour le terminer.",
      );
      return;
    }
    if (inThisCall) return;
    waiting.current = true;
    await startCallSession({
      prospectId: deal.prospect.id,
      prospectRaisonSociale: raisonSociale,
      numero: normalizePhone(numero) ?? numero,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Appeler ${deal.prospect.raisonSociale}, ${display} (démarre le suivi d'appel)`}
      title={`Appeler · ${display}`}
      className={cn(
        ICON_BTN,
        "text-coral-600",
        inThisCall && "border-coral-400 bg-coral-50 motion-safe:animate-pulse-ring",
      )}
    >
      <Phone aria-hidden="true" className="size-4" />
    </button>
  );
}

interface StageMenuProps {
  deal: PipelineDeal;
  onMove: (deal: PipelineDeal, stage: DealStage) => void;
  onOpen: (deal: PipelineDeal) => void;
}

export function StageMenu({ deal, onMove, onOpen }: StageMenuProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Changer l'étape de ${deal.prospect.raisonSociale} ou ouvrir le deal`}
        title="Changer d'étape"
        className={cn(ICON_BTN, "text-foreground")}
      >
        <ArrowRightLeft aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-[14px] p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Déplacer vers
          </DropdownMenuLabel>
          {ALL_STAGES.map((s) => {
            const meta = STAGE_META[s];
            const Icon = meta.icon;
            const current = s === deal.stage;
            return (
              <DropdownMenuItem
                key={s}
                disabled={current}
                onClick={() => onMove(deal, s)}
                className="gap-2.5 rounded-[10px] px-2 py-2 font-semibold"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 items-center justify-center rounded-[8px]",
                    meta.tile,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {meta.label}
                {current && (
                  <span className="ml-auto text-xs font-medium text-muted-foreground">
                    étape actuelle
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onOpen(deal)}
          className="gap-2.5 rounded-[10px] px-2 py-2 font-semibold"
        >
          <Eye aria-hidden="true" className="size-4" />
          {deal.contract ? "Ouvrir le contrat" : "Ouvrir le détail"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/pipeline/${deal.id}/modifier`)}
          className="gap-2.5 rounded-[10px] px-2 py-2 font-semibold"
        >
          <Pencil aria-hidden="true" className="size-4" />
          Modifier le deal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
