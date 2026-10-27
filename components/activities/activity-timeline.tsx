/**
 * Timeline des activités d'un prospect (fiche prospect), MYC Arena.
 * Sections « À venir » (planifié dans le futur) puis « Historique ».
 * Server-safe (aucun hook) : rendu depuis la fiche prospect.
 */
import { CornerDownRight, ExternalLink, History } from "lucide-react";
import Link from "next/link";

import { ActivityIcon, ACTIVITY_TYPE_TONE } from "@/components/activities/activity-icon";
import { ACTIVITY_STATUT_TONE } from "@/components/activities/activity-tones";
import { AdresseRdvLink } from "@/components/activities/adresse-rdv-link";
import { StatusPill } from "@/components/arena/pills";
import { TONE_HEX } from "@/components/arena/tones";
import { RESULT_META } from "@/components/call/call-results";
import { zDate, zDuration, zTime } from "@/components/call/zurich";
import { formatRelative } from "@/lib/format";
import {
  getActivityResultatLabel,
  getActivityStatutLabel,
  getActivityTypeLabel,
} from "@/lib/labels";

import type { Activity, ActivityResultat, User } from "@prisma/client";

type ActivityWithRelations = Activity & {
  user?: Pick<User, "id" | "name"> | null;
  rappelLeDe?: Pick<Activity, "id" | "type" | "date"> | null;
};

interface ActivityTimelineProps {
  activities: ActivityWithRelations[];
  /** Si true, affiche le badge du contact ayant fait l'activité (utile en admin). */
  showUser?: boolean;
  emptyMessage?: string;
}

export function ActivityTimeline({
  activities,
  showUser = false,
  emptyMessage = "Aucune activité enregistrée pour ce prospect.",
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-border-strong px-6 py-8 text-center">
        <History aria-hidden="true" className="size-6 text-subtle" />
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Groupe par section : à venir (planifié dans le futur), puis le reste.
  const now = new Date();
  const upcoming = activities.filter(
    (a) => a.date > now && (a.statut === "PLANIFIE" || a.statut === "EN_COURS"),
  );
  const past = activities.filter((a) => !upcoming.includes(a));

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <Section title="À venir" count={upcoming.length}>
          <Timeline items={upcoming} showUser={showUser} />
        </Section>
      )}
      {past.length > 0 && (
        <Section title={upcoming.length > 0 ? "Historique" : undefined} count={past.length}>
          <Timeline items={past} showUser={showUser} />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title && (
        <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {title}
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-extrabold text-foreground tabular-nums">
            {count}
          </span>
        </h3>
      )}
      {children}
    </div>
  );
}

function Timeline({
  items,
  showUser,
}: {
  items: ActivityWithRelations[];
  showUser: boolean;
}) {
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-6">
      {items.map((a) => {
        const resultTone = a.resultat ? RESULT_META[a.resultat as ActivityResultat].tone : null;
        return (
          <li key={a.id} className="relative">
            {/* pastille sur la timeline */}
            <div className="absolute top-0 -left-[41px] rounded-[12px] bg-card p-0.5">
              <ActivityIcon type={a.type} size={30} />
            </div>

            <div
              className="space-y-1.5 rounded-[14px] border border-border border-l-[3px] bg-card px-3.5 py-3"
              style={{ borderLeftColor: TONE_HEX[ACTIVITY_TYPE_TONE[a.type]].solid }}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-bold text-foreground">
                  {getActivityTypeLabel(a.type)}
                </span>
                <StatusPill tone={ACTIVITY_STATUT_TONE[a.statut] ?? "navy"}>
                  {getActivityStatutLabel(a.statut)}
                </StatusPill>
                {a.resultat && resultTone && (
                  <StatusPill tone={resultTone} dot={false}>
                    {getActivityResultatLabel(a.resultat as ActivityResultat)}
                  </StatusPill>
                )}
              </div>

              {a.rappelLeDe && (
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground italic">
                  <CornerDownRight aria-hidden="true" className="size-3.5 shrink-0" />
                  Rappel auto suite à {getActivityTypeLabel(a.rappelLeDe.type).toLowerCase()} du{" "}
                  {zDate(a.rappelLeDe.date)}
                </p>
              )}

              {a.emailId ? (
                <Link
                  href={`/emails/${a.emailId}`}
                  className="group inline-flex items-baseline gap-1 text-sm font-semibold text-info-700 underline-offset-2 hover:underline"
                >
                  {a.sujet}
                  <ExternalLink
                    aria-hidden="true"
                    className="size-3 opacity-60 group-hover:opacity-100"
                  />
                </Link>
              ) : (
                <p className="text-sm break-words text-foreground">{a.sujet}</p>
              )}

              {a.adresseRdv && <AdresseRdvLink adresse={a.adresseRdv} size="md" />}

              {a.notesResultat && (
                <p className="rounded-[10px] bg-ground px-3 py-2 text-xs leading-relaxed text-muted-foreground italic">
                  « {a.notesResultat} »
                </p>
              )}

              {a.contenu && !a.notesResultat && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.contenu}</p>
              )}

              <div className="flex flex-wrap gap-x-2 text-xs font-medium text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {zDate(a.date)} · {zTime(a.date)}
                </span>
                <span>({formatRelative(a.date)})</span>
                {a.duree2 ? (
                  <span>· durée {zDuration(a.duree2)}</span>
                ) : a.duree ? (
                  <span>· {a.duree} min</span>
                ) : null}
                {showUser && a.user && <span>· {a.user.name}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
