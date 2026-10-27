/**
 * Héros « Ta saison » (commerciale) en tête de /stats : niveau, série, XP de
 * la semaine vs record, contrats et CA signés du mois vs objectif MENSUEL.
 * Objectif absent = valeur seule (jamais de chiffre inventé). Server-safe.
 */
import { Phone, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { HeroPanel } from "@/components/arena/hero-panel";
import { ProgressRing } from "@/components/arena/progress-ring";
import { LevelPill, StreakPill, XpPill } from "@/components/arena/pills";
import { XpBar } from "@/components/arena/xp-bar";
import { formatInt, formatXp, pctOf } from "@/components/arena/format";
import type { Tone } from "@/components/arena/tones";
import { buttonVariants } from "@/components/ui/button";
import { formatCHFCompact } from "@/lib/format";
import type { PlayerStats } from "@/lib/gamification/rules";
import type { PlayerMonth } from "@/lib/queries/pilotage";

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

export function PlayerHero({ player, month }: { player: PlayerStats; month: PlayerMonth }) {
  const c = month.counters;
  const resteContrats =
    month.objectifSignatures != null ? Math.max(0, month.objectifSignatures - c.signatures) : null;
  const resteCa = month.objectifCa != null ? Math.max(0, month.objectifCa - c.caSigne) : null;

  let headline: string;
  if (resteContrats === null && resteCa === null) {
    headline =
      c.signatures > 0
        ? `${player.firstName}, ${plural(c.signatures, "contrat signé", "contrats signés")} en ${month.monthName} : continue`
        : `${player.firstName}, le premier contrat de ${month.monthName} t'attend`;
  } else if ((resteContrats ?? 0) === 0 && (resteCa ?? 0) === 0) {
    headline = `Objectif de ${month.monthName} plié, ${player.firstName} : machine de guerre`;
  } else {
    const bits: string[] = [];
    if (resteContrats) bits.push(plural(resteContrats, "contrat", "contrats"));
    if (resteCa) bits.push(formatCHFCompact(resteCa));
    headline = `Encore ${bits.join(" et ")} pour plier ${month.monthName}`;
  }

  const record = player.xpRecordWeek;
  const recordMsg =
    record > 0
      ? player.xpWeek >= record
        ? `Record hebdo battu : ${formatXp(player.xpWeek)} cette semaine.`
        : `Tu es à ${formatXp(record - player.xpWeek)} de ton record hebdo (${formatXp(record)}).`
      : `${formatXp(player.xpWeek)} cette semaine : chaque appel compte.`;
  const streakMsg =
    player.streak >= 3
      ? `Tu es en feu : ${plural(player.streak, "jour", "jours")} de série.`
      : player.streak > 0
        ? `Série en cours : ${plural(player.streak, "jour", "jours")}, tiens le rythme.`
        : "Atteins ton objectif d'appels aujourd'hui pour lancer une série.";

  return (
    <HeroPanel aria-labelledby="saison-titre" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-coral-100 uppercase">
          Ta saison · {month.monthLabel}
        </span>
        <LevelPill level={player.level} variant="dark" />
        <StreakPill days={player.streak} variant="dark" />
        <XpPill xp={player.xpToday} label="aujourd'hui" variant="dark" />
      </div>

      <div className="flex flex-col gap-2">
        <h2
          id="saison-titre"
          className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white sm:text-[34px]"
        >
          {headline}
        </h2>
        <p className="max-w-[640px] text-[15px] leading-relaxed text-navy-200">
          {streakMsg} {recordMsg}{" "}
          {plural(month.workingDaysLeft, "jour ouvré reste", "jours ouvrés restent")} dans le mois.
        </p>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <Goal
          title="Contrats du mois"
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
                ? `${plural(resteContrats, "contrat", "contrats")} à aller chercher`
                : "Objectif atteint, bravo"
              : "Pas d'objectif mensuel défini"
          }
        />
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
                ? `Manque ${formatCHFCompact(resteCa)}`
                : "Objectif atteint, bravo"
              : "Valeur an 1 des contrats signés"
          }
        />
        <Goal
          title="XP de la semaine"
          tone="green"
          value={player.xpWeek}
          max={record > 0 ? record : null}
          center={record > 0 ? `${pctOf(player.xpWeek, record)}%` : formatInt(player.xpWeek)}
          line1={formatXp(player.xpWeek)}
          line2={record > 0 ? `Record : ${formatXp(record)}` : "Premier record en vue"}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-[16px] border border-white/12 bg-white/6 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 font-bold text-white">
            <Trophy aria-hidden="true" className="size-4 text-gold-500" />
            Niveau {player.level.level} · {player.level.name}
          </span>
          <span className="text-xs font-semibold text-navy-200 tabular-nums">
            {player.level.nextXp != null
              ? `${formatInt(player.level.xp)} / ${formatInt(player.level.nextXp)} XP · ${formatInt(player.level.xpToNext ?? 0)} XP avant ${player.level.nextName}`
              : `${formatInt(player.level.xp)} XP · niveau maximum`}
          </span>
        </div>
        <XpBar pct={player.level.pct} className="h-2 bg-navy-500" shine />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/phoning" className={buttonVariants({ variant: "hero", size: "lg" })}>
          <Phone aria-hidden="true" />
          Lancer le phoning
        </Link>
      </div>
    </HeroPanel>
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
