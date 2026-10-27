"use client";

/**
 * Carte du prospect en cours : qui, pourquoi maintenant, numéro en très gros,
 * bouton Appeler (flux existant startCall via CallSessionProvider) ou
 * « J'ai raccroché » pendant l'appel, derniers échanges et notes de la fiche.
 *
 * Monté avec `key={prospect.id}` : le choix fixe / mobile repart à zéro à
 * chaque prospect.
 */
import {
  Building2,
  Flame,
  History,
  Lightbulb,
  MapPin,
  Phone,
  PhoneOff,
  SkipForward,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusPill } from "@/components/arena/pills";
import { TONE_CLASSES, TONE_HEX } from "@/components/arena/tones";
import type { CallSession } from "@/components/call/call-session-provider";
import { RESULT_META } from "@/components/call/call-results";
import { zDate, zDuration, zTime } from "@/components/call/zurich";
import { formatPhone } from "@/lib/format";
import {
  getActivityResultatLabel,
  getActivityTypeLabel,
  getProspectSecteurLabel,
  getProspectStatutLabel,
} from "@/lib/labels";
import type { PhoningQueueItem } from "@/lib/queries/phoning";
import { cn } from "@/lib/utils";

import {
  STATUT_TONE,
  contactName,
  heatOf,
  reasonPill,
  reasonsFor,
} from "./phoning-labels";

export interface ProspectCardProps {
  item: PhoningQueueItem;
  nowMs: number;
  /** Appel en cours (n'importe quel prospect), null sinon. */
  callSession: CallSession | null;
  elapsedSeconds: number;
  /** Raccroché (durée figée) pour l'appel en cours. */
  hungUp: boolean;
  starting: boolean;
  remaining: number;
  onCall: (numero: string) => void;
  onHangUp: () => void;
  onSkip: () => void;
}

export function ProspectCard({
  item,
  nowMs,
  callSession,
  elapsedSeconds,
  hungUp,
  starting,
  remaining,
  onCall,
  onHangUp,
  onSkip,
}: ProspectCardProps) {
  const hasFixe = !!item.telephone;
  const hasMobile = !!item.telephoneMobile;
  const [choice, setChoice] = useState<"fixe" | "mobile">(hasFixe ? "fixe" : "mobile");
  const isMobile = choice === "mobile" && hasMobile;
  const numero = (isMobile ? item.telephoneMobile : item.telephone) ?? item.telephoneMobile ?? "";
  const contact = contactName(item);
  const firstName = item.contactPrenom?.trim() || "";
  const inCallHere = callSession?.prospectId === item.id;
  const inCallElsewhere = !!callSession && !inCallHere;
  const reason = reasonPill(item, nowMs);
  const heat = heatOf(item);
  const reasons = reasonsFor(item, nowMs);
  const statutTone = STATUT_TONE[item.statut];

  return (
    <section
      aria-label={`Prospect en cours : ${item.raisonSociale}`}
      className="flex flex-col gap-5 rounded-[20px] border border-border bg-card p-4 shadow-arena-lg sm:p-6"
    >
      {/* Pastilles + Passer */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={reason.tone}>{reason.label}</StatusPill>
        <StatusPill tone="navy" dot={false}>
          Tentative n°{item.tentatives + 1}
        </StatusPill>
        <StatusPill tone={heat.tone} icon={Flame}>
          Lead {heat.label}
        </StatusPill>
        <span className="flex-1" />
        <span className="text-[13px] font-bold text-muted-foreground">
          {remaining} dans la file
        </span>
        <button
          type="button"
          onClick={onSkip}
          disabled={inCallHere}
          title="Passer au suivant sans enregistrer d'appel"
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-50 disabled:opacity-50"
        >
          <SkipForward aria-hidden="true" className="size-4" />
          Passer
        </button>
      </div>

      {/* Identité */}
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] break-words text-foreground sm:text-[34px]">
          <Link
            href={`/prospects/${item.id}`}
            className="underline-offset-4 hover:underline"
            title="Ouvrir la fiche"
          >
            {item.raisonSociale}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
          {contact && (
            <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
              <User aria-hidden="true" className="size-4 text-subtle" />
              {contact}
              {item.contactFonction ? ` · ${item.contactFonction}` : ""}
            </span>
          )}
          {item.ville && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4 text-subtle" />
              {item.ville}
              {item.canton ? ` (${item.canton})` : ""}
            </span>
          )}
          {item.secteur && (
            <span className="inline-flex items-center gap-1.5">
              <Building2 aria-hidden="true" className="size-4 text-subtle" />
              {getProspectSecteurLabel(item.secteur)}
            </span>
          )}
          <StatusPill tone={statutTone}>{getProspectStatutLabel(item.statut)}</StatusPill>
          <span>
            Dernier appel : {item.dernierAppel ? zDate(item.dernierAppel) : "jamais"}
          </span>
        </div>
      </div>

      {/* Bloc téléphone */}
      <div className="flex flex-wrap items-center gap-4 rounded-[16px] border border-coral-100 bg-coral-50 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-coral-600 uppercase">
            {isMobile
              ? `Mobile${contact ? ` · ${contact}` : ""}`
              : `Téléphone fixe · ${item.raisonSociale}`}
          </span>
          <span className="score-number text-[clamp(28px,8vw,44px)] break-all text-foreground">
            {formatPhone(numero)}
          </span>
          {hasFixe && hasMobile && (
            <div role="group" aria-label="Numéro à composer" className="flex flex-wrap gap-2">
              <NumChip
                active={!isMobile}
                onClick={() => setChoice("fixe")}
                disabled={inCallHere}
                label={`Fixe · ${formatPhone(item.telephone)}`}
              />
              <NumChip
                active={isMobile}
                onClick={() => setChoice("mobile")}
                disabled={inCallHere}
                label={`Mobile · ${formatPhone(item.telephoneMobile)}`}
              />
            </div>
          )}
        </div>

        {inCallHere ? (
          <button
            type="button"
            onClick={onHangUp}
            disabled={hungUp}
            className="inline-flex h-16 min-w-[min(220px,100%)] flex-[0_1_260px] items-center max-sm:flex-[1_1_100%] justify-center gap-3 rounded-[16px] bg-navy-700 px-5 font-display text-[22px] font-extrabold text-white transition-colors hover:bg-navy-600 disabled:opacity-70"
          >
            <PhoneOff aria-hidden="true" className="size-6" />
            {hungUp ? "Raccroché" : "J'ai raccroché"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCall(numero)}
            disabled={starting || inCallElsewhere || !numero}
            title={`Démarrer le suivi d'appel - ${formatPhone(numero)}`}
            className="inline-flex h-16 min-w-[min(220px,100%)] flex-[0_1_260px] items-center max-sm:flex-[1_1_100%] justify-center gap-3 rounded-[16px] bg-gradient-coral px-5 font-display text-[22px] font-extrabold tracking-[-0.01em] text-white shadow-cta text-shadow-[0_1px_1px_rgba(120,20,26,0.35)] transition-[filter,transform] hover:brightness-105 active:translate-y-px disabled:opacity-60"
          >
            <Phone aria-hidden="true" className="size-6" />
            {starting ? "Lancement…" : `Appeler${firstName ? ` ${firstName}` : ""}`}
          </button>
        )}

        {inCallHere && callSession && (
          <div
            role="status"
            className="flex flex-[1_1_100%] items-center gap-2.5 rounded-[12px] bg-win-50 px-3.5 py-2.5 text-sm font-semibold text-win-700"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full bg-win-500 motion-safe:animate-pulse"
            />
            <span>
              {hungUp
                ? `Raccroché après ${zDuration(elapsedSeconds)} : choisis le résultat juste en dessous.`
                : `Appel en cours depuis ${zTime(callSession.startedAt)} · ${zDuration(elapsedSeconds)} · compose le ${formatPhone(callSession.numero)} sur ton téléphone, le CRM chronomètre pour toi.`}
            </span>
          </div>
        )}
        {inCallElsewhere && callSession && (
          <p className="flex-[1_1_100%] rounded-[12px] bg-gold-50 px-3.5 py-2.5 text-sm font-semibold text-gold-700">
            Un appel est en cours avec {callSession.prospectRaisonSociale} : enregistre son
            résultat avant d&apos;appeler ce prospect.
          </p>
        )}
      </div>

      {/* Pourquoi maintenant + historique */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(270px,100%),1fr))] gap-4">
        <div className="flex flex-col gap-3 rounded-[14px] border border-border p-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-[10px] bg-gold-50 text-gold-700"
            >
              <Lightbulb className="size-[18px]" />
            </span>
            <h3 className="text-[15px] font-extrabold text-foreground">
              Pourquoi l&apos;appeler maintenant
            </h3>
          </div>
          <ul className="flex flex-col gap-2">
            {reasons.map((t) => (
              <li key={t} className="flex gap-2 text-[13px] leading-snug text-foreground">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-win-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-[14px] border border-border p-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-[10px] bg-info-50 text-info-700"
            >
              <History className="size-[18px]" />
            </span>
            <h3 className="text-[15px] font-extrabold text-foreground">Derniers échanges</h3>
          </div>
          {item.recent.length === 0 ? (
            <p className="text-[13px] leading-snug text-muted-foreground">
              Aucun échange pour l&apos;instant. Premier appel : c&apos;est toi qui ouvres le
              bal, fais forte impression.
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {item.recent.map((a) => {
                const tone = a.resultat ? RESULT_META[a.resultat].tone : "navy";
                return (
                  <li
                    key={a.id}
                    className="flex flex-col gap-1 border-l-[3px] pl-3"
                    style={{ borderLeftColor: TONE_HEX[tone].solid }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">
                        {zDate(a.date)} · {zTime(a.date)}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {getActivityTypeLabel(a.type)}
                      </span>
                      {a.resultat && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold",
                            TONE_CLASSES[tone].bg,
                            TONE_CLASSES[tone].text,
                          )}
                        >
                          {getActivityResultatLabel(a.resultat)}
                        </span>
                      )}
                    </div>
                    {a.note ? (
                      <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground italic">
                        « {a.note} »
                      </span>
                    ) : (
                      <span className="line-clamp-1 text-[13px] text-muted-foreground">{a.sujet}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {item.notesGenerales && (
            <div className="mt-auto rounded-[10px] bg-ground px-3 py-2.5 text-[13px] leading-snug text-foreground">
              <strong>Notes de la fiche :</strong>{" "}
              <span className="line-clamp-4 whitespace-pre-line">{item.notesGenerales}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NumChip({
  active,
  onClick,
  disabled,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 rounded-full border px-3 text-[13px] font-bold transition-colors disabled:opacity-60",
        active
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
      )}
    >
      {label}
    </button>
  );
}
