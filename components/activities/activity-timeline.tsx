import Link from "next/link";

import { ActivityIcon } from "@/components/activities/activity-icon";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import {
  getActivityResultatLabel,
  getActivityStatutLabel,
  getActivityTypeLabel,
  ACTIVITY_RESULTAT_COLORS,
} from "@/lib/labels";
import {
  formatDateLong,
  formatDuration,
  formatRelative,
  formatTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";

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
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  // Groupe par section : à venir (planifié dans le futur), aujourd'hui, passé
  const now = new Date();
  const upcoming = activities.filter(
    (a) =>
      a.date > now &&
      (a.statut === "PLANIFIE" || a.statut === "EN_COURS"),
  );
  const past = activities.filter((a) => !upcoming.includes(a));

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <Section title="À venir">
          <Timeline items={upcoming} showUser={showUser} />
        </Section>
      )}
      {past.length > 0 && (
        <Section title={upcoming.length > 0 ? "Historique" : undefined}>
          <Timeline items={past} showUser={showUser} />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
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
    <ol className="relative space-y-4 border-l border-border pl-6">
      {items.map((a) => (
        <li key={a.id} className="relative">
          {/* puce ronde sur la timeline */}
          <div className="absolute -left-[35px] top-0">
            <ActivityIcon type={a.type} size={28} />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium">
                {getActivityTypeLabel(a.type)}
              </span>
              <StatutPill statut={a.statut} />
              {a.resultat && <ResultatPill resultat={a.resultat} />}
              {a.rappelLeDe && (
                <span className="text-[11px] italic text-muted-foreground">
                  ↳ rappel auto suite à {getActivityTypeLabel(a.rappelLeDe.type)}{" "}
                  du {formatDateLong(a.rappelLeDe.date)}
                </span>
              )}
            </div>

            {a.emailId ? (
              <Link
                href={`/emails/${a.emailId}`}
                className="group inline-flex items-baseline gap-1 text-sm font-medium text-primary hover:underline"
              >
                {a.sujet}
                <Icon
                  name="ExternalLink"
                  className="h-3 w-3 opacity-60 group-hover:opacity-100"
                />
              </Link>
            ) : (
              <p className="text-sm">{a.sujet}</p>
            )}

            {a.notesResultat && (
              <p className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground italic">
                « {a.notesResultat} »
              </p>
            )}

            {a.contenu && !a.notesResultat && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {a.contenu}
              </p>
            )}

            <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
              <span>
                {formatDateLong(a.date)} · {formatTime(a.date)}
              </span>
              <span>({formatRelative(a.date)})</span>
              {a.duree2 ? (
                <span>· durée {formatDuration(a.duree2)}</span>
              ) : a.duree ? (
                <span>· {a.duree} min</span>
              ) : null}
              {showUser && a.user && <span>· {a.user.name}</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const STATUT_BADGE_CLASSES: Record<string, string> = {
  PLANIFIE: "bg-blue-100 text-blue-700",
  EN_COURS: "bg-amber-100 text-amber-700",
  FAIT: "bg-emerald-100 text-emerald-700",
  MANQUE: "bg-red-100 text-red-700",
  REPLANIFIE: "bg-slate-200 text-slate-700",
  ANNULE: "bg-slate-100 text-slate-500",
};

function StatutPill({ statut }: { statut: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal",
        STATUT_BADGE_CLASSES[statut] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getActivityStatutLabel(statut as never)}
    </Badge>
  );
}

const RESULTAT_BADGE_TONE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  slate: "bg-slate-100 text-slate-700",
};

function ResultatPill({ resultat }: { resultat: ActivityResultat }) {
  const tone = ACTIVITY_RESULTAT_COLORS[resultat];
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal",
        RESULTAT_BADGE_TONE[tone] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {getActivityResultatLabel(resultat)}
    </Badge>
  );
}
