/**
 * Héros « Ton mois » (commerciale) en tête de /stats : contrats et CA signés
 * du mois vs objectif MENSUEL (CHF), appels du jour vs objectif quotidien,
 * série de régularité et records exprimés en résultats.
 *
 * Le CA signé du mois est celui de /stats (valeur 1re année des contrats
 * signés, `valeurAn1`) et il est libellé comme tel. Objectif absent = valeur
 * seule (jamais de chiffre inventé). Server-safe.
 */
import { CalendarCheck, Flame, Phone, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatDayKey, formatInt, pctOf } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { StreakPill } from "@/components/arena/pills";
import { ProgressRing } from "@/components/arena/progress-ring";
import type { Tone } from "@/components/arena/tones";
import { buttonVariants } from "@/components/ui/button";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import type { PlayerStats } from "@/lib/gamification/rules";
import type { CommercialMonth } from "@/lib/queries/pilotage";

function plural(n: number, one: string, many: string): string {
  return `${formatInt(n)} ${n > 1 ? many : one}`;
}

/** Montant compact pour le centre d'un anneau de 84 px : « 13.5k », « 186k ». */
function compact(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 100_000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return formatInt(v);
}

export function ResultsHero({ stats, month }: { stats: PlayerStats; month: CommercialMonth }) {
  const c = month.counters;
  const resteContrats =
    month.objectifSignatures != null ? Math.max(0, month.objectifSignatures - c.signatures) : null;
  const resteCa = month.objectifCa != null ? Math.max(0, month.objectifCa - c.caSigne) : null;

  let headline: string;
  if (resteContrats === null && resteCa === null) {
    headline =
      c.signatures > 0
        ? `${stats.firstName}, ${plural(c.signatures, "contrat signé", "contrats signés")} en ${month.monthName} pour ${formatCHFCompact(c.caSigne)}`
        : `${stats.firstName}, aucun contrat signé en ${month.monthName} pour l'instant`;
  } else if ((resteContrats ?? 0) === 0 && (resteCa ?? 0) === 0) {
    headline = `Objectif de ${month.monthName} atteint, ${stats.firstName} : ${formatCHFCompact(c.caSigne)} signés`;
  } else if (resteCa) {
    headline = `Il te manque ${formatCHFCompact(resteCa)} pour l'objectif de ${month.monthName}`;
  } else {
    headline = `Encore ${plural(resteContrats ?? 0, "contrat", "contrats")} pour l'objectif de ${month.monthName}`;
  }

  const appelsCible = stats.dailyTargets.appels;
  const appelsReste = Math.max(0, appelsCible - stats.today.appels);
  const appelsMsg =
    appelsReste > 0
      ? `Encore ${plural(appelsReste, "appel", "appels")} pour ton objectif du jour.`
      : "Objectif d'appels du jour atteint.";
  const streakMsg =
    stats.streak > 0
      ? `Série en cours : ${plural(stats.streak, "jour ouvré", "jours ouvrés")} avec l'objectif d'appels atteint.`
      : "Atteins ton objectif d'appels aujourd'hui pour lancer une série.";
  const r = stats.records;
  // Seulement quand le record est à portée (1 RDV), comme le coach du dashboard.
  const rdvRecordMsg =
    r.bestDayRdvPris > 0 && r.bestDayRdvPris - stats.today.rdvPris === 1
      ? "1 RDV de plus aujourd'hui et tu égales ton record."
      : null;

  return (
    <HeroPanel aria-labelledby="mois-titre" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-coral-100 uppercase">
          Ton mois · {month.monthLabel}
        </span>
        <StreakPill days={stats.streak} variant="dark" />
      </div>

      <div className="flex flex-col gap-2">
        <h2
          id="mois-titre"
          className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white sm:text-[34px]"
        >
          {headline}
        </h2>
        <p className="max-w-[640px] text-[15px] leading-relaxed text-navy-200">
          {appelsMsg} {rdvRecordMsg ? `${rdvRecordMsg} ` : ""}
          {streakMsg} {plural(month.workingDaysLeft, "jour ouvré reste", "jours ouvrés restent")} dans le
          mois.
        </p>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <Goal
          title="CA signé du mois"
          tone="gold"
          value={c.caSigne}
          max={month.objectifCa}
          center={month.objectifCa != null ? `${pctOf(c.caSigne, month.objectifCa)}%` : compact(c.caSigne)}
          line1={
            month.objectifCa != null
              ? `${formatCHFCompact(c.caSigne)} / ${formatCHFCompact(month.objectifCa)}`
              : formatCHFCompact(c.caSigne)
          }
          line2={
            resteCa != null
              ? resteCa > 0
                ? `Il manque ${formatCHFCompact(resteCa)} · valeur 1re année`
                : "Objectif atteint · valeur 1re année"
              : "Valeur 1re année des contrats signés"
          }
        />
        <Goal
          title="Contrats signés du mois"
          tone="coral"
          value={c.signatures}
          max={month.objectifSignatures}
          center={
            month.objectifSignatures != null
              ? `${formatInt(c.signatures)}/${formatInt(month.objectifSignatures)}`
              : formatInt(c.signatures)
          }
          line1={
            month.objectifSignatures != null
              ? `${pctOf(c.signatures, month.objectifSignatures)} % de ton objectif`
              : plural(c.signatures, "contrat signé", "contrats signés")
          }
          line2={
            resteContrats != null
              ? resteContrats > 0
                ? `${plural(resteContrats, "contrat", "contrats")} à signer`
                : "Objectif atteint"
              : "Pas d'objectif mensuel défini"
          }
        />
        <Goal
          title="Appels du jour"
          tone="green"
          value={stats.today.appels}
          max={appelsCible}
          center={`${formatInt(stats.today.appels)}/${formatInt(appelsCible)}`}
          line1={`${stats.today.rdvPris} RDV pris aujourd'hui`}
          line2={appelsReste > 0 ? `Encore ${plural(appelsReste, "appel", "appels")}` : "Objectif atteint"}
        />
      </div>

      <ul
        aria-label="Tes records"
        className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]"
      >
        <RecordItem
          icon={<CalendarCheck aria-hidden="true" className="size-4 text-gold-500" />}
          label="Meilleure journée en RDV pris"
          value={plural(r.bestDayRdvPris, "RDV", "RDV")}
          sub={r.bestDayRdvPrisDate ? `le ${formatDayKey(r.bestDayRdvPrisDate)}` : "Pas encore de RDV"}
        />
        <RecordItem
          icon={<Trophy aria-hidden="true" className="size-4 text-gold-500" />}
          label="Plus gros revenu mensuel"
          value={r.biggestContractMensuel > 0 ? `${formatCHF(r.biggestContractMensuel)} / mois` : "Aucun"}
          sub="Montant mensuel signé"
        />
        <RecordItem
          icon={<Flame aria-hidden="true" className="size-4 text-coral-500" />}
          label="Plus longue série"
          value={plural(stats.streakRecord, "jour ouvré", "jours ouvrés")}
          sub="Objectif d'appels atteint chaque jour"
        />
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link href="/phoning" className={buttonVariants({ variant: "hero", size: "lg" })}>
          <Phone aria-hidden="true" />
          Lancer le phoning
        </Link>
      </div>
    </HeroPanel>
  );
}

function RecordItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-[16px] border border-white/12 bg-white/6 p-3.5">
      <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">
        {icon}
        {label}
      </span>
      <span className="text-base font-extrabold text-white tabular-nums">{value}</span>
      <span className="text-xs text-navy-200">{sub}</span>
    </li>
  );
}

function Goal({
  title,
  tone,
  value,
  max,
  center,
  line1,
  line2,
}: {
  title: string;
  tone: Tone;
  value: number;
  max: number | null;
  center: string | null;
  line1: ReactNode;
  line2: ReactNode;
}) {
  const label =
    max != null ? `${title} : ${formatInt(value)} sur ${formatInt(max)}` : `${title} : ${formatInt(value)}`;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3.5 rounded-[16px] border border-white/12 bg-white/6 p-3.5">
      {max != null ? (
        <ProgressRing value={value} max={max} size={84} stroke={11} tone={tone} trackColor="#2F4470" label={label}>
          <span className="score-number text-[22px] text-white">{center ?? `${pctOf(value, max)}%`}</span>
        </ProgressRing>
      ) : (
        <span
          role="img"
          aria-label={label}
          className="flex size-[84px] shrink-0 items-center justify-center rounded-full border-[3px] border-dashed border-navy-500"
        >
          <span aria-hidden="true" className="score-number text-[20px] text-white">
            {center ?? formatInt(value)}
          </span>
        </span>
      )}
      <div className="flex min-w-0 flex-[1_1_120px] flex-col gap-1">
        <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">{title}</span>
        <span className="text-sm font-bold text-white">{line1}</span>
        <span className="text-xs text-navy-200">{line2}</span>
      </div>
    </div>
  );
}
