"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markActivityDone } from "@/app/(app)/activites/actions";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { ACTIVITY_STATUT_TONE } from "@/components/activities/activity-tones";
import { resultToast } from "@/components/arena/celebrate";
import { StatusPill } from "@/components/arena/pills";
import { RESULT_META } from "@/components/call/call-results";
import { zDate, zTime } from "@/components/call/zurich";
import { DeleteActivityButton } from "@/components/common/entity-delete-buttons";
import { formatRelative } from "@/lib/format";
import {
  getActivityResultatLabel,
  getActivityStatutLabel,
  getActivityTypeLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { Activity, ActivityResultat, Prospect, User } from "@prisma/client";

type ActivityWithRefs = Activity & {
  prospect: Pick<Prospect, "id" | "raisonSociale" | "telephone"> | null;
  user?: Pick<User, "id" | "name"> | null;
};

interface ActivityRowProps {
  activity: ActivityWithRefs;
  /** Affiche le nom de la commerciale (vue admin). */
  showUser?: boolean;
  /**
   * ID du user connecté. Utilisé pour masquer "Marquer fait" sur les
   * activités appartenant à quelqu'un d'autre (Arthur n'a pas à clore
   * un appel planifié de Sophie).
   */
  currentUserId?: string;
}

export function ActivityRow({
  activity: a,
  showUser,
  currentUserId,
}: ActivityRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isPlanifiable = a.statut === "PLANIFIE" || a.statut === "EN_COURS";
  const isOverdue = isPlanifiable && a.date < new Date();
  // On affiche "Marquer fait" seulement si l'activité m'appartient
  // (ou si on n'a pas l'info - fallback sûr pour la fiche prospect).
  const isMine = !currentUserId || a.userId === currentUserId;
  const resultTone = a.resultat ? RESULT_META[a.resultat as ActivityResultat].tone : null;

  const handleMarkDone = () => {
    startTransition(async () => {
      const res = await markActivityDone(a.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      resultToast(
        `${getActivityTypeLabel(a.type)} marqué comme fait`,
        a.prospect?.raisonSociale ?? a.sujet,
      );
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-ground/70 sm:gap-3.5",
        isOverdue && "bg-alert-50/50 hover:bg-alert-50/80",
      )}
    >
      <ActivityIcon type={a.type} size={40} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {a.prospect ? (
            <Link
              href={`/prospects/${a.prospect.id}`}
              className="min-w-0 truncate font-bold text-foreground underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {a.prospect.raisonSociale}
            </Link>
          ) : (
            <span className="font-semibold text-muted-foreground italic">Note interne</span>
          )}
          <span className="text-xs font-semibold text-muted-foreground">
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
          {isOverdue && <StatusPill tone="red">En retard</StatusPill>}
        </div>

        <p className="mt-1 text-sm break-words text-foreground">{a.sujet}</p>

        <div className="mt-1 flex flex-wrap gap-x-2 text-xs font-medium text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {zDate(a.date)} · {zTime(a.date)}
          </span>
          <span>({formatRelative(a.date)})</span>
          {showUser && a.user && <span>· {a.user.name}</span>}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        {isPlanifiable && isMine && (
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground transition-colors hover:border-win-500 hover:bg-win-50 hover:text-win-700 disabled:opacity-50"
          >
            <Check aria-hidden="true" className="size-3.5" />
            {pending ? "…" : "Marquer fait"}
          </button>
        )}
        {isMine && <DeleteActivityButton activityId={a.id} />}
      </div>
    </div>
  );
}
