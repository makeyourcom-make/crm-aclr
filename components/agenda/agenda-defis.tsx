"use client";

/**
 * Défis agenda de la semaine : petits objectifs calculés sur les RDV réels
 * de la semaine en cours (pas d'XP en plus, juste de la motivation).
 */
import { CalendarCheck, CircleCheck, ShieldCheck, Trophy, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { SectionCard } from "@/components/arena/section-card";
import { cn } from "@/lib/utils";

import type { AgendaGame } from "@/lib/queries/agenda";

interface Defi {
  key: string;
  nom: string;
  icon: LucideIcon;
  value: number;
  max: number;
  /** Score affiché quand le défi n'est pas (encore) obtenu. */
  score?: string;
  got: boolean;
  lost?: boolean;
  hint: string;
}

export function AgendaDefis({ game, you }: { game: AgendaGame; you: boolean }) {
  const { week, record, objectives } = game;
  const n = week.total;
  const ton = you ? "ton" : "le";

  const first: Defi =
    objectives.weekly !== null
      ? {
          key: "pleine",
          nom: "Semaine pleine",
          icon: CalendarCheck,
          value: n,
          max: objectives.weekly,
          got: n >= objectives.weekly,
          hint:
            n >= objectives.weekly
              ? "Débloqué, quelle semaine !"
              : `Cale ${objectives.weekly - n} RDV de plus pour l'obtenir`,
        }
      : record > 0
        ? {
            key: "record",
            nom: "Record à battre",
            icon: CalendarCheck,
            value: n,
            max: record + 1,
            got: n > record,
            hint:
              n > record
                ? `Nouveau record : ${n} RDV`
                : `${record + 1 - n} RDV de plus et ${ton} record de ${record} tombe`,
          }
        : {
            key: "premier-cale",
            nom: "Premier RDV calé",
            icon: CalendarCheck,
            value: n,
            max: 1,
            got: n >= 1,
            hint: n >= 1 ? "La semaine est lancée" : "Un RDV au phoning et c'est parti",
          };

  const zeroLost = week.manque > 0;
  const finished = week.joursOuvresEcoules >= week.joursOuvres && week.joursOuvres > 0;
  const defis: Defi[] = [
    first,
    {
      key: "valide",
      nom: "Premier RDV validé",
      icon: CircleCheck,
      value: week.fait,
      max: 1,
      got: week.fait >= 1,
      hint:
        week.fait >= 1
          ? "Débloqué cette semaine"
          : game.pending[0]
            ? `Valide ${(game.pending[0].prospect?.raisonSociale ?? game.pending[0].sujet).split(" / ")[0]} pour le débloquer`
            : "Ton premier RDV effectué le débloque",
    },
    {
      key: "zero-manque",
      nom: "Zéro manqué",
      icon: ShieldCheck,
      value: zeroLost ? 0 : week.joursOuvresEcoules,
      max: Math.max(1, week.joursOuvres),
      score: zeroLost ? "Perdu" : `Jour ${week.joursOuvresEcoules}/${week.joursOuvres}`,
      got: !zeroLost && finished,
      lost: zeroLost,
      hint: zeroLost
        ? "Raté pour cette semaine, revanche lundi"
        : finished
          ? "Aucun RDV manqué cette semaine"
          : "Tiens bon jusqu'à vendredi soir",
    },
    {
      key: "visio",
      nom: "Roi de la visio",
      icon: Video,
      value: week.visio,
      max: 3,
      got: week.visio >= 3,
      hint: week.visio >= 3 ? "3 visios calées cette semaine" : "Propose la visio à tes prochains leads",
    },
  ];

  return (
    <SectionCard
      title="Défis agenda de la semaine"
      icon={Trophy}
      tone="violet"
      action={
        <Link href="/objectifs" className="text-[13px] font-bold text-info-700 hover:underline">
          Voir tous mes badges
        </Link>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {defis.map((d) => {
          const pct = Math.min(100, Math.round((d.value / Math.max(1, d.max)) * 100));
          const score = d.got ? "Obtenu" : (d.score ?? `${Math.min(d.value, d.max)}/${d.max}`);
          const DIcon = d.icon;
          return (
            <div
              key={d.key}
              className={cn(
                "flex items-center gap-3 rounded-[14px] border border-border p-3.5",
                d.got ? "bg-gold-50" : "bg-card",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full border-[3px]",
                  d.got
                    ? "border-gold-500 bg-card text-gold-700"
                    : "border-border-strong bg-ground text-muted-foreground",
                )}
              >
                <DIcon className="size-5" strokeWidth={2.2} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-1.5">
                  <span className="text-[13px] font-extrabold text-foreground">{d.nom}</span>
                  <span
                    className={cn(
                      "text-xs font-extrabold whitespace-nowrap tabular-nums",
                      d.got ? "text-win-700" : d.lost ? "text-alert-700" : "text-lvl-700",
                    )}
                  >
                    {score}
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`${d.nom} : ${score}`}
                  className="h-1.5 overflow-hidden rounded-full bg-navy-50"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      d.got ? "bg-win-500" : d.lost ? "bg-alert-500" : "bg-lvl-500",
                    )}
                    style={{ width: `${d.lost ? 100 : pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{d.hint}</span>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
