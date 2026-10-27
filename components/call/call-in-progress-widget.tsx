"use client";

/**
 * Widget flottant « Appel en cours » (MYC Arena) : carte navy en bas à
 * droite, chrono en gros, pastille verte qui pulse. « J'ai raccroché » ouvre
 * la modale de résultat.
 *
 * Sur téléphone, il se pose AU-DESSUS de la barre d'onglets (et de son bouton
 * Phoning surélevé). Masqué sur /phoning : le cockpit affiche l'appel en
 * cours et le panneau de résultat directement dans la page.
 */
import { PhoneOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PHONING_PATH } from "@/components/call/call-result-modal";
import { useCallSession } from "@/components/call/call-session-provider";
import { zDuration } from "@/components/call/zurich";
import { formatPhone } from "@/lib/format";

export function CallInProgressWidget() {
  const pathname = usePathname();
  const { session, elapsedSeconds, openResultModal } = useCallSession();

  if (!session || pathname === PHONING_PATH) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[20px] bg-gradient-navy text-white shadow-arena-lg [--focus-ring:#ffffff] md:right-4 md:bottom-4"
    >
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span aria-hidden="true" className="relative flex size-2.5">
          <span className="absolute inline-flex size-full rounded-full bg-win-500 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-win-500" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
          Appel en cours
        </span>
        <span className="score-number ml-auto text-2xl text-white">
          <span className="sr-only">Durée : </span>
          {zDuration(elapsedSeconds)}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-1.5 pb-4">
        <div className="min-w-0">
          <Link
            href={`/prospects/${session.prospectId}`}
            className="block truncate text-[15px] font-extrabold text-white underline-offset-2 hover:underline"
          >
            {session.prospectRaisonSociale}
          </Link>
          <p className="mt-0.5 text-[13px] font-semibold text-navy-200 tabular-nums">
            {formatPhone(session.numero)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openResultModal}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-gradient-coral px-3 text-lg font-extrabold text-white shadow-cta text-shadow-[0_1px_1px_rgba(120,20,26,0.35)] transition-[filter] hover:brightness-105"
          >
            <PhoneOff aria-hidden="true" className="size-[18px]" />
            J&apos;ai raccroché
          </button>
          <Link
            href={PHONING_PATH}
            className="inline-flex h-11 items-center rounded-[12px] border border-white/25 bg-white/10 px-3 text-[13px] font-bold text-white transition-colors hover:bg-white/15"
          >
            Phoning
          </Link>
        </div>
      </div>
    </div>
  );
}
