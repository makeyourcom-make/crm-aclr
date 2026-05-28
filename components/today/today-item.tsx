"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { markActivityDone } from "@/app/(app)/activites/actions";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { ClickToCall } from "@/components/call/click-to-call";
import { Icon } from "@/components/icon";
import { formatTime } from "@/lib/format";
import { getActivityTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { TodayActivity } from "@/lib/queries/today";

interface TodayItemProps {
  activity: TodayActivity;
  /** Si true, l'item est marqué comme "en retard" (fond rouge). */
  overdue?: boolean;
}

const isCallType = (t: string) =>
  t === "APPEL_SORTANT" || t === "APPEL_ENTRANT";
const isMeetingType = (t: string) =>
  t === "RDV_PHYSIQUE" || t === "RDV_VISIO" || t === "RDV_TELEPHONIQUE";

export function TodayItem({ activity: a, overdue }: TodayItemProps) {
  const [pending, startTransition] = useTransition();
  const handleMarkDone = () => {
    startTransition(async () => {
      const res = await markActivityDone(a.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Marquée comme faite.");
    });
  };

  const primaryPhone =
    a.prospect.telephoneMobile ?? a.prospect.telephone ?? null;
  const isCall = isCallType(a.type);
  const isMeeting = isMeetingType(a.type);

  return (
    <div
      className={cn(
        "group/item flex items-start gap-3 rounded-md border border-border bg-card px-3 py-3 transition-colors",
        overdue && "border-red-200 bg-red-50/30",
      )}
    >
      <ActivityIcon type={a.type} />

      <div className="min-w-0 flex-1">
        {/* En-tête : heure + type */}
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatTime(a.date)}
          </span>
          <span className="text-muted-foreground">
            {getActivityTypeLabel(a.type)}
          </span>
          {overdue && (
            <span className="font-medium text-red-600">· en retard</span>
          )}
        </div>

        {/* Ligne principale : nom prospect + ville */}
        <div className="mt-0.5">
          <Link
            href={`/prospects/${a.prospect.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {a.prospect.raisonSociale}
          </Link>
          {a.prospect.ville && (
            <span className="ml-2 text-xs text-muted-foreground">
              · {a.prospect.ville}
            </span>
          )}
        </div>

        {/* Sujet */}
        <p className="mt-0.5 text-sm">{a.sujet}</p>

        {/* Téléphone cliquable si activité d'appel */}
        {isCall && primaryPhone && (
          <div className="mt-1.5 text-xs">
            <ClickToCall
              prospectId={a.prospect.id}
              prospectRaisonSociale={a.prospect.raisonSociale}
              numero={primaryPhone}
              inline
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        {/* Bouton primaire selon type */}
        {isCall && primaryPhone ? (
          <ClickToCall
            prospectId={a.prospect.id}
            prospectRaisonSociale={a.prospect.raisonSociale}
            numero={primaryPhone}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Icon name="Phone" className="h-3 w-3" />
            Appeler
          </ClickToCall>
        ) : isMeeting ? (
          <Link
            href={`/prospects/${a.prospect.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Icon name="Calendar" className="h-3 w-3" />
            Voir RDV
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {pending ? "…" : "Marquer fait"}
          </button>
        )}

        {/* Bouton secondaire : marquer fait (pour les autres types) */}
        {(isCall || isMeeting) && (
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
            title="Marquer comme fait sans passer par la modale d'appel"
          >
            {pending ? "…" : "Marquer fait"}
          </button>
        )}
      </div>
    </div>
  );
}
