/**
 * Prochains RDV client (agenda de l'utilisateur), avec les XP en jeu
 * (+80 XP par RDV effectué). Server-safe.
 */
import { ArrowRight, Calendar, CalendarDays } from "lucide-react";
import Link from "next/link";

import { formatInt, plural } from "@/components/arena/format";
import { EmptyState } from "@/components/arena/empty-state";
import { SectionCard } from "@/components/arena/section-card";
import { XP_RULES } from "@/lib/gamification/rules";
import type { UpcomingRdv } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

import { daysFromToday, relativeDay, zDateShort, zTime, zWeekdayShort } from "./dates";

const TYPE_PILL: Record<string, string> = {
  RDV_PHYSIQUE: "bg-gold-50 text-gold-700",
  RDV_VISIO: "bg-info-50 text-info-700",
  RDV_TELEPHONIQUE: "bg-coral-50 text-coral-600",
};

export function UpcomingRdvSection({
  rdvs,
  restantsSemaine,
  today,
  className,
}: {
  rdvs: UpcomingRdv[];
  restantsSemaine: number;
  /** Clé « AAAA-MM-JJ » du jour (Europe/Zurich). */
  today: string;
  className?: string;
}) {
  const description =
    restantsSemaine > 0 ? (
      <>
        {plural(restantsSemaine, "RDV")} d&apos;ici dimanche · jusqu&apos;à{" "}
        <strong className="text-gold-700">
          +{formatInt(restantsSemaine * XP_RULES.rdvEffectue)} XP
        </strong>{" "}
        s&apos;ils sont effectués
      </>
    ) : rdvs.length > 0 ? (
      "Plus de RDV cette semaine · voici les suivants"
    ) : undefined;

  return (
    <SectionCard
      title="Prochains RDV"
      icon={Calendar}
      tone="gold"
      className={className}
      description={description}
      action={
        <Link
          href="/agenda"
          className="inline-flex min-h-6 items-center gap-1 text-[13px] font-bold text-info-700 hover:underline"
        >
          Agenda
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      }
    >
      {rdvs.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tone="gold"
          title="Aucun RDV à venir"
          description={`Un appel bien mené et le prochain s'affiche ici : +${XP_RULES.rdvPris} XP le RDV pris, +${XP_RULES.rdvEffectue} XP une fois effectué.`}
          action={
            <Link
              href="/phoning"
              className="inline-flex h-11 items-center rounded-[12px] bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-navy-600"
            >
              Lancer le phoning
            </Link>
          }
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rdvs.map((r) => {
            const proche = daysFromToday(r.date, today) <= 1;
            const rel = relativeDay(r.date, today);
            const nom = r.raisonSociale ?? r.sujet;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-[14px] border border-border p-3"
              >
                <div
                  className={cn(
                    "flex w-14 shrink-0 flex-col items-center rounded-[12px] py-2",
                    proche ? "bg-navy-700 text-white" : "bg-navy-50 text-foreground",
                  )}
                >
                  <span className="text-[11px] font-extrabold tracking-[0.06em] uppercase">
                    {zWeekdayShort(r.date)}
                  </span>
                  <span className="text-base font-extrabold tabular-nums">
                    {zDateShort(r.date)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {r.prospectId ? (
                    <Link
                      href={`/prospects/${r.prospectId}`}
                      className="truncate text-sm font-extrabold text-foreground hover:underline"
                    >
                      {nom}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-extrabold text-foreground">{nom}</span>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-extrabold tabular-nums">
                      <span className="sr-only">{rel} à </span>
                      {zTime(r.date)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        TYPE_PILL[r.type] ?? "bg-navy-50 text-foreground",
                      )}
                    >
                      {r.typeLabel}
                    </span>
                    {r.lieu && (
                      <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
                        {r.lieu}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
