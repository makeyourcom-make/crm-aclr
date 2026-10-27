"use client";

/**
 * Héros de l'agenda : « N RDV cette semaine », objectif (s'il existe),
 * record, jauge segmentée, phrase coach, tuiles (à valider, à venir,
 * effectués, présence), prochain RDV avec compte à rebours et CTA
 * « Nouveau RDV ». Données réelles uniquement (lib/queries/agenda).
 */
import { Clock, Phone, Plus, Star, Target } from "lucide-react";

import { HeroPanel } from "@/components/arena/hero-panel";
import { Meter } from "@/components/arena/meter";
import { RubriqueIcon } from "@/components/arena/rubrique-icon";
import { Button } from "@/components/ui/button";
import {
  countdownLabel,
  formatKeyDate,
  formatKeyShort,
  relativeDayLabel,
  zDayKey,
  zTime,
} from "@/lib/queries/agenda-dates";
import { cn } from "@/lib/utils";

import { TYPE_META } from "./agenda-style";

import type { AgendaActivity, AgendaResults } from "@/lib/queries/agenda";

export interface HeroSubject {
  kind: "self" | "user" | "team";
  firstName: string;
}

interface AgendaHeroProps {
  results: AgendaResults;
  subject: HeroSubject;
  nowMs: number;
  onPrepare: (a: AgendaActivity) => void;
  onNewRdv: () => void;
}

const DARK_CHIP = "bg-navy-700/70 ring-1 ring-inset ring-white/10";

export function AgendaHero({ results, subject, nowMs, onPrepare, onNewRdv }: AgendaHeroProps) {
  const { week, record, objectives } = results;
  const you = subject.kind === "self";
  const team = subject.kind === "team";
  const n = week.total;
  const weekly = objectives.weekly;
  const ton = you ? "ton" : "le";

  const eyebrowWho = you
    ? "Ta semaine"
    : team
      ? "Semaine de l'équipe"
      : `Semaine de ${subject.firstName}`;

  // Jauge : objectif hebdo s'il existe, sinon le record à battre.
  const goal = weekly ?? (record > 0 ? record + 1 : 0);
  const segCount = Math.max(goal, n);
  const useSegments = segCount > 0 && segCount <= 20;

  const copy = heroCopy({ n, weekly, record, ton });
  const libres =
    week.joursSansRdv > 0
      ? ` ${week.joursSansRdv === 1 ? "Il reste 1 jour ouvré" : `Il reste ${week.joursSansRdv} jours ouvrés`} sans RDV : de quoi caler du monde.`
      : "";

  const nPending = results.pending.length;
  const firstPending = results.pending[0];
  const presenceBase = results.month.fait + results.month.manque;
  const presence = presenceBase > 0 ? Math.round((results.month.fait / presenceBase) * 100) : null;

  const next = results.upcoming[0] ?? null;

  return (
    <HeroPanel aria-labelledby="agenda-hero-titre" className="flex flex-wrap items-stretch gap-5 sm:gap-6">
      {/* RDV de la semaine */}
      <div className="flex min-w-0 flex-[1.4_1_320px] flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <RubriqueIcon rubrique="agenda" size={36} />
          <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
            {eyebrowWho} · Lun {formatKeyShort(week.startKey)} - Dim {formatKeyShort(week.endKey)} ·
            Semaine {week.number}
          </span>
        </div>
        <h2 id="agenda-hero-titre" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="score-number text-[56px] leading-[0.95] text-white sm:text-[64px]">{n}</span>
          <span className="font-display text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
            RDV {team ? "de l'équipe " : ""}cette semaine
          </span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {weekly !== null && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-bold text-white">
              <Target aria-hidden="true" className="size-3.5" />
              Objectif {weekly}
            </span>
          )}
          {record > 0 && (
            <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-gold-500", DARK_CHIP)}>
              <Star aria-hidden="true" className="size-3.5 fill-gold-500" />
              Record {record}
            </span>
          )}
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-coral-400/20 px-3 text-[13px] font-bold text-coral-100">
            <Phone aria-hidden="true" className="size-3.5" />
            {week.rdvPrisPhoning} décroché{week.rdvPrisPhoning > 1 ? "s" : ""} au phoning
          </span>
        </div>

        {useSegments && (
          <>
            <div
              role="img"
              aria-label={`${n} RDV calés cette semaine${weekly !== null ? `, objectif ${weekly}` : ""}${record > 0 ? `, record ${record}` : ""}`}
              className="flex items-center gap-1.5"
            >
              {Array.from({ length: segCount }, (_, i) => {
                const filled = i < n;
                const toGoal = weekly !== null ? i < weekly : false;
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-3.5 min-w-0 flex-1 rounded-full border-2",
                      filled
                        ? "border-gold-500 bg-gold-500"
                        : toGoal
                          ? "border-dashed border-white/45 bg-white/[0.08]"
                          : "border-dashed border-gold-500 bg-white/[0.08]",
                    )}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-navy-200">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 rounded-[4px] bg-gold-500" />
                {n} calé{n > 1 ? "s" : ""}
              </span>
              {weekly !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-3 rounded-[4px] border-2 border-dashed border-white/45" />
                  {n < weekly ? `${weekly - n} pour l'objectif` : "Objectif atteint"}
                </span>
              )}
              {record > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-3 rounded-[4px] border-2 border-dashed border-gold-500" />
                  {you ? "Ton" : "Le"} record : {record}
                </span>
              )}
            </div>
          </>
        )}
        {!useSegments && goal > 0 && (
          <Meter value={n} max={goal} onDark tone="gold" label={weekly !== null ? "Objectif de la semaine" : "Record à battre"} />
        )}

        <p className="max-w-[560px] text-[15px] leading-normal font-semibold text-white">
          {copy}
          {libres}
        </p>

        {objectives.monthly !== null && (
          <Meter
            value={results.month.fait}
            max={objectives.monthly}
            onDark
            tone="gold"
            size="sm"
            label="Objectif du mois · RDV effectués"
            className="max-w-[560px]"
          />
        )}
      </div>

      {/* Tuiles */}
      <div className="grid min-w-0 flex-[1_1_250px] grid-cols-2 content-start gap-2.5">
        <HeroTile
          label="À valider"
          value={nPending}
          valueClass={nPending > 0 ? "text-coral-400" : "text-win-500"}
          sub={
            firstPending
              ? `${zTime(firstPending.date)} · ${(firstPending.prospect?.raisonSociale ?? firstPending.sujet).split(" / ")[0]}`
              : "Agenda à jour"
          }
        />
        <HeroTile label="À venir" value={week.aVenir} sub="d'ici dimanche" />
        <HeroTile
          label="Effectués"
          value={week.fait}
          valueClass="text-win-500"
          sub={week.fait > 0 ? "à transformer en propositions" : "cette semaine"}
        />
        <HeroTile
          label="Présence"
          value={presence !== null ? `${presence} %` : "-"}
          valueClass="text-gold-500"
          sub={
            presence !== null
              ? `ce mois · ${results.month.fait} sur ${presenceBase}`
              : "aucun RDV validé ce mois"
          }
        />
      </div>

      {/* Prochain RDV + CTA */}
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3 rounded-[16px] border border-white/15 bg-white/[0.06] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
            Prochain RDV
          </span>
          {next && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-gold-500 px-2.5 text-xs font-extrabold text-navy-700">
              <Clock aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
              {countdownLabel(new Date(next.date).getTime(), nowMs)}
            </span>
          )}
        </div>
        {next ? (
          <>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] break-words text-white">
                {next.prospect?.raisonSociale ?? next.sujet}
              </p>
              <p className="text-[13px] font-medium text-navy-200">
                {relativeDayLabel(zDayKey(next.date), results.todayKey)} {zTime(next.date)} ·{" "}
                {TYPE_META[next.type].short}
                {next.prospect?.ville ? ` · ${next.prospect.ville}` : ""}
                {team && next.user ? ` · ${next.user.name.split(" ")[0]}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onPrepare(next)}
              className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              Préparer ce RDV
            </Button>
          </>
        ) : (
          <p className="text-sm leading-snug font-semibold text-white">
            Plus aucun RDV client calé pour l&apos;instant. {you ? "La semaine n'attend que toi." : "Une session de phoning et ça repart."}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Button type="button" variant="hero" size="xl" onClick={onNewRdv} className="w-full">
            <Plus aria-hidden="true" strokeWidth={2.6} />
            Nouveau RDV
          </Button>
          <p className="text-center text-xs font-semibold text-navy-200">
            Chaque RDV est une chance de signer
          </p>
        </div>
      </div>

      <p className="sr-only">
        Semaine du {formatKeyDate(week.startKey)} au {formatKeyDate(week.endKey)}.
      </p>
    </HeroPanel>
  );
}

function HeroTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: number | string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-white/12 bg-white/[0.07] px-3.5 py-3">
      <div className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">{label}</div>
      <div className={cn("score-number mt-1 text-[32px] text-white", valueClass)}>{value}</div>
      <div className="truncate text-xs font-medium text-navy-200">{sub}</div>
    </div>
  );
}

function heroCopy({
  n,
  weekly,
  record,
  ton,
}: {
  n: number;
  weekly: number | null;
  record: number;
  ton: string;
}): string {
  if (weekly !== null) {
    if (n < weekly) {
      const beat = record >= weekly ? `, ${record + 1 - n} pour battre ${ton} record` : "";
      return `Encore ${weekly - n} RDV pour atteindre l'objectif${beat}.`;
    }
    if (n <= record) return `Objectif atteint. Encore ${record + 1 - n} RDV et ${ton} record de ${record} est battu.`;
    return `Objectif atteint et nouveau record : ${n} RDV. Transforme-les en propositions.`;
  }
  if (record === 0) {
    return n === 0
      ? "Aucun RDV client calé pour l'instant. Une session de phoning et la semaine démarre."
      : `${n} RDV calé${n > 1 ? "s" : ""} : prépare chaque rendez-vous pour en sortir une proposition.`;
  }
  if (n <= record) return `Encore ${record + 1 - n} RDV et ${ton} record de ${record} est battu.`;
  return `Nouveau record : ${n} RDV cette semaine. Chaque RDV est une chance de signer.`;
}
