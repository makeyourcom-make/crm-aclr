"use client";

/**
 * Bandeau « RDV à valider » : RDV clients passés (14 derniers jours) pas
 * encore marqués effectués / manqués / annulés. Validation en un clic via
 * l'action serveur existante `validerRdv` (déléguée au parent).
 */
import { Check, CircleAlert, X } from "lucide-react";

import {
  JOURS_ABBR,
  dowOfKey,
  relativeDayLabel,
  zDayKey,
  zTime,
} from "@/lib/queries/agenda-dates";

import { TYPE_META } from "./agenda-style";

import type { AgendaActivity } from "@/lib/queries/agenda";

const MAX_ROWS = 5;

export type ValidationStatut = "FAIT" | "MANQUE" | "ANNULE";

interface PendingBannerProps {
  pending: AgendaActivity[];
  todayKey: string;
  busyId: string | null;
  showOwner: boolean;
  onValidate: (a: AgendaActivity, statut: ValidationStatut) => void;
  onOpen: (a: AgendaActivity) => void;
}

export function PendingBanner({
  pending,
  todayKey,
  busyId,
  showOwner,
  onValidate,
  onOpen,
}: PendingBannerProps) {
  if (pending.length === 0) return null;
  const rows = pending.slice(0, MAX_ROWS);
  const rest = pending.length - rows.length;
  const n = pending.length;

  return (
    <section
      aria-labelledby="agenda-a-valider"
      className="flex flex-col gap-3 rounded-[20px] border border-coral-100 border-l-[6px] border-l-alert-500 bg-card px-4 py-4 shadow-arena sm:px-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-alert-50 text-alert-700"
        >
          <CircleAlert className="size-[22px]" />
        </span>
        <div className="min-w-0">
          <h2 id="agenda-a-valider" className="text-base font-extrabold text-foreground">
            {n === 1 ? "1 RDV à valider" : `${n} RDV à valider`}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug font-medium text-muted-foreground">
            {n === 1 ? "Il est passé" : "Ils sont passés"} : dis comment ça s&apos;est passé,
            puis enchaîne sur la proposition.
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {rows.map((a) => {
          const key = zDayKey(a.date);
          const meta = TYPE_META[a.type];
          const TIcon = meta.icon;
          const busy = busyId === a.id;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => onOpen(a)}
                className="flex min-w-0 flex-[1_1_240px] items-center gap-3 rounded-[12px] text-left"
              >
                <span
                  aria-hidden="true"
                  className="flex w-12 shrink-0 flex-col items-center rounded-[12px] bg-alert-50 py-1.5 text-alert-700"
                >
                  <span className="text-[10px] font-extrabold tracking-[0.06em]">{JOURS_ABBR[dowOfKey(key)]}</span>
                  <span className="font-display text-lg leading-tight font-extrabold">
                    {Number(key.slice(8, 10))}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold text-foreground hover:underline">
                    {a.prospect?.raisonSociale ?? a.sujet}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <TIcon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {relativeDayLabel(key, todayKey)} {zTime(a.date)} · {meta.label}
                      {showOwner && a.user ? ` · ${a.user.name.split(" ")[0]}` : ""}
                    </span>
                  </span>
                </span>
              </button>
              {/* Téléphone : 3 boutons sur toute la largeur ; grand écran : en ligne */}
              <span className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onValidate(a, "FAIT")}
                  className="inline-flex min-h-12 flex-col items-center justify-center rounded-[12px] bg-win-700 px-2 text-white transition-colors hover:bg-win-500 disabled:opacity-50 sm:h-11 sm:min-h-0 sm:flex-row sm:gap-2 sm:px-3.5"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold">
                    <Check aria-hidden="true" className="size-[18px]" strokeWidth={2.6} />
                    Effectué
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onValidate(a, "MANQUE")}
                  className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[12px] border border-border-strong bg-card px-2 text-sm font-bold text-alert-700 transition-colors hover:bg-alert-50 disabled:opacity-50 sm:h-11 sm:min-h-0 sm:px-3"
                >
                  <X aria-hidden="true" className="size-4" strokeWidth={2.4} />
                  Manqué
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onValidate(a, "ANNULE")}
                  className="inline-flex min-h-12 items-center justify-center rounded-[12px] border border-border-strong bg-card px-2 text-sm font-bold text-foreground transition-colors hover:bg-navy-50 disabled:opacity-50 sm:h-11 sm:min-h-0 sm:px-3"
                >
                  Annulé
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <p className="text-xs font-semibold text-muted-foreground">
          Et {rest} autre{rest > 1 ? "s" : ""} : retrouve-les en pointillé rouge dans l&apos;agenda.
        </p>
      )}
    </section>
  );
}
