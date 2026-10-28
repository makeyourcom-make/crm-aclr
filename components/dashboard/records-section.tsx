/**
 * Records personnels exprimés en résultats : meilleure journée en RDV pris,
 * meilleur mois en CA signé, plus gros contrat (CHF / mois), plus longue
 * série. Données : getPlayerStats().records (rien d'inventé : un record
 * absent est dit tel quel).
 * Server-safe.
 */
import {
  CalendarPlus,
  Coins,
  FileSignature,
  Flame,
  Medal,
  type LucideIcon,
} from "lucide-react";

import { formatDayKey, plural } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import type { PlayerStats } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { monthKeyLabel } from "./dates";

interface RecordRow {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  value: string;
  /** Quand le record a été posé. */
  when?: string;
  /** Où tu en es par rapport à ce record. */
  coach: string;
  /** Record égalé ou battu en ce moment. */
  live?: boolean;
}

export function RecordsSection({
  stats,
  todayKey,
  className,
}: {
  stats: PlayerStats;
  /** Clé « AAAA-MM-JJ » du jour (Europe/Zurich). */
  todayKey: string;
  className?: string;
}) {
  const r = stats.records;
  const rdvToday = stats.today.rdvPris;
  const caMois = stats.month.caSigne;

  // Meilleure journée en RDV pris
  let rdvCoach: string;
  let rdvLive = false;
  if (r.bestDayRdvPris <= 0) {
    rdvCoach = "Ton premier RDV pris posera le record";
  } else if (r.bestDayRdvPrisDate === todayKey) {
    rdvCoach = "Record posé aujourd'hui";
    rdvLive = true;
  } else if (rdvToday >= r.bestDayRdvPris) {
    rdvCoach = "Égalé aujourd'hui : 1 RDV de plus et tu le bats";
    rdvLive = true;
  } else if (r.bestDayRdvPris - rdvToday === 1) {
    rdvCoach = "1 RDV de plus aujourd'hui et tu l'égales";
  } else {
    rdvCoach = `Aujourd'hui : ${plural(rdvToday, "RDV pris", "RDV pris")}`;
  }

  // Meilleur mois en CA signé
  let caCoach: string;
  let caLive = false;
  if (r.bestMonthCaSigne <= 0) {
    caCoach = "Ton premier contrat signé posera le record";
  } else if (r.bestMonthCaSigneKey === stats.month.monthKey) {
    caCoach = "C'est le mois en cours : chaque signature le repousse";
    caLive = true;
  } else {
    caCoach = `Il manque ${formatCHFCompact(Math.max(0, r.bestMonthCaSigne - caMois))} ce mois pour l'égaler`;
  }

  const rows: RecordRow[] = [
    {
      key: "rdv",
      label: "Meilleure journée en RDV pris",
      icon: CalendarPlus,
      tone: "gold",
      value: r.bestDayRdvPris > 0 ? plural(r.bestDayRdvPris, "RDV", "RDV") : "Aucun",
      when: r.bestDayRdvPrisDate ? `le ${formatDayKey(r.bestDayRdvPrisDate)}` : undefined,
      coach: rdvCoach,
      live: rdvLive,
    },
    {
      key: "ca",
      label: "Meilleur mois en CA signé",
      icon: Coins,
      tone: "green",
      value: r.bestMonthCaSigne > 0 ? formatCHFCompact(r.bestMonthCaSigne) : "Aucun",
      when: r.bestMonthCaSigneKey ? `en ${monthKeyLabel(r.bestMonthCaSigneKey)}` : undefined,
      coach: caCoach,
      live: caLive,
    },
    {
      key: "contrat",
      label: "Plus gros revenu mensuel",
      icon: FileSignature,
      tone: "violet",
      value: r.biggestContractMensuel > 0 ? `${formatCHF(r.biggestContractMensuel)} / mois` : "Aucun",
      coach:
        r.biggestContractMensuel > 0
          ? "Ton plus gros contrat te rapporte ça chaque mois"
          : "Pas encore de contrat mensuel signé",
    },
    {
      key: "serie",
      label: "Plus longue série",
      icon: Flame,
      tone: "coral",
      value: r.longestStreak > 0 ? plural(r.longestStreak, "jour") : "Aucune",
      coach:
        stats.streak > 0
          ? `Série en cours : ${plural(stats.streak, "jour")}${stats.streak >= r.longestStreak ? ", c'est ton record" : ""}`
          : "Atteins l'objectif d'appels du jour pour lancer une série",
      live: stats.streak > 0 && stats.streak >= r.longestStreak,
    },
  ];

  return (
    <SectionCard
      title="Tes records"
      icon={Medal}
      tone="violet"
      className={className}
      description="Tes meilleurs résultats à ce jour"
    >
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const t = TONE_CLASSES[row.tone];
          const Icon = row.icon;
          return (
            <li
              key={row.key}
              className={cn(
                "flex items-start gap-3 rounded-[14px] border p-3",
                row.live ? "border-win-500/35 bg-win-50/60" : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
                  t.bg,
                  t.text,
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-semibold text-muted-foreground">{row.label}</span>
                <span className="font-display text-lg leading-tight font-extrabold text-foreground tabular-nums">
                  {row.value}
                  {row.when && (
                    <span className="ml-1.5 font-sans text-xs font-semibold text-muted-foreground">
                      {row.when}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    row.live ? "text-win-700" : "text-muted-foreground",
                  )}
                >
                  {row.coach}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
