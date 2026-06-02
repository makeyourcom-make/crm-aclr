"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { markActivityDone } from "@/app/(app)/activites/actions";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { DeleteActivityButton } from "@/components/common/entity-delete-buttons";
import { Badge } from "@/components/ui/badge";
import {
  formatDateLong,
  formatRelative,
  formatTime,
} from "@/lib/format";
import {
  getActivityResultatLabel,
  getActivityStatutLabel,
  getActivityTypeLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { Activity, ActivityResultat, Prospect, User } from "@prisma/client";

type ActivityWithRefs = Activity & {
  prospect: Pick<Prospect, "id" | "raisonSociale" | "telephone">;
  user?: Pick<User, "id" | "name"> | null;
};

const STATUT_CLASSES: Record<string, string> = {
  PLANIFIE: "bg-blue-100 text-blue-700",
  EN_COURS: "bg-amber-100 text-amber-700",
  FAIT: "bg-emerald-100 text-emerald-700",
  MANQUE: "bg-red-100 text-red-700",
  REPLANIFIE: "bg-slate-200 text-slate-700",
  ANNULE: "bg-slate-100 text-slate-500",
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
  const [pending, startTransition] = useTransition();
  const isPlanifiable = a.statut === "PLANIFIE" || a.statut === "EN_COURS";
  const isOverdue =
    isPlanifiable && a.date < new Date();
  // On affiche "Marquer fait" seulement si l'activité m'appartient
  // (ou si on n'a pas l'info — fallback sûr pour la fiche prospect).
  const isMine = !currentUserId || a.userId === currentUserId;

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

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border px-3 py-3 last:border-0 transition-colors hover:bg-muted/30",
        isOverdue && "bg-red-50/40",
      )}
    >
      <ActivityIcon type={a.type} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            href={`/prospects/${a.prospect.id}`}
            className="font-medium text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {a.prospect.raisonSociale}
          </Link>
          <span className="text-xs text-muted-foreground">
            · {getActivityTypeLabel(a.type)}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              "font-normal",
              STATUT_CLASSES[a.statut] ?? "bg-slate-100 text-slate-600",
            )}
          >
            {getActivityStatutLabel(a.statut)}
          </Badge>
          {a.resultat && (
            <span className="text-[11px] text-muted-foreground italic">
              · {getActivityResultatLabel(a.resultat as ActivityResultat)}
            </span>
          )}
        </div>

        <p className="mt-0.5 text-sm">{a.sujet}</p>

        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          <span>
            {formatDateLong(a.date)} · {formatTime(a.date)}
          </span>
          <span>({formatRelative(a.date)})</span>
          {showUser && a.user && <span>· {a.user.name}</span>}
          {isOverdue && (
            <span className="font-medium text-red-600">· en retard</span>
          )}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {isPlanifiable && isMine && (
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
          >
            {pending ? "…" : "Marquer fait"}
          </button>
        )}
        {isMine && <DeleteActivityButton activityId={a.id} />}
      </div>
    </div>
  );
}
