"use client";

/**
 * Modale de fin d'appel (après « J'ai raccroché » sur le widget), sur toutes
 * les pages SAUF /phoning (le cockpit y intègre le même panneau dans la page).
 *
 * Contenu : <CallResultPanel /> (gros boutons de résultat colorés, notes,
 * rappel auto, RDV calé dans la foulée, refus ferme confirmé). La logique
 * serveur reste celle de recordCallResult (aucune duplication).
 */
import { usePathname } from "next/navigation";

import { CallResultPanel } from "@/components/call/call-result-panel";
import { useCallSession } from "@/components/call/call-session-provider";
import { zDuration } from "@/components/call/zurich";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getActivityResultatLabel } from "@/lib/labels";

/** Chemin du cockpit de phoning (panneau intégré à la page). */
export const PHONING_PATH = "/phoning";

export function CallResultModal() {
  const pathname = usePathname();
  const { session, elapsedSeconds, resultModalOpen, closeResultModal } = useCallSession();

  if (!session || pathname === PHONING_PATH) return null;

  return (
    <Dialog
      open={resultModalOpen}
      onOpenChange={(open) => {
        if (!open) closeResultModal();
      }}
    >
      <DialogContent className="gap-5 rounded-[20px] p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">
            Comment ça s&apos;est passé ?
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted-foreground">
            Avec {session.prospectRaisonSociale} · {zDuration(elapsedSeconds)} · un clic sur le
            résultat enregistre l&apos;appel.
          </DialogDescription>
        </DialogHeader>
        <CallResultPanel
          variant="modal"
          header={null}
          shortcuts={resultModalOpen}
          onRecorded={closeResultModal}
        />
      </DialogContent>
    </Dialog>
  );
}

// Helper pour rendre les noms importables proprement (API historique).
export { getActivityResultatLabel };
