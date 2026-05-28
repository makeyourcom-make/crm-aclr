"use client";

/**
 * Widget flottant "Appel en cours" — affiché en bas à droite quand une
 * session d'appel est active. Cliquer sur "J'ai raccroché" ouvre la
 * modale de résultat.
 */
import Link from "next/link";

import { useCallSession } from "@/components/call/call-session-provider";
import { Icon } from "@/components/icon";
import { formatDuration, formatPhone } from "@/lib/format";

export function CallInProgressWidget() {
  const { session, elapsedSeconds, openResultModal } = useCallSession();

  if (!session) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-primary/30 bg-white shadow-2xl"
    >
      <div className="flex items-center gap-2.5 border-b border-border bg-primary/5 px-4 py-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-primary">
          Appel en cours
        </span>
        <span className="ml-auto font-mono text-sm tabular-nums">
          {formatDuration(elapsedSeconds)}
        </span>
      </div>

      <div className="px-4 py-3">
        <Link
          href={`/prospects/${session.prospectId}`}
          className="block text-sm font-semibold hover:underline"
        >
          {session.prospectRaisonSociale}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatPhone(session.numero)}
        </p>

        <button
          type="button"
          onClick={openResultModal}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Icon name="Phone" className="h-4 w-4 rotate-[135deg]" />
          J&apos;ai raccroché
        </button>
      </div>
    </div>
  );
}
