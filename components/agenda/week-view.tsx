"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  markActivityDone,
  rescheduleActivity,
} from "@/app/(app)/activites/actions";
import { ActivityIcon } from "@/components/activities/activity-icon";
import { AddActivityDialog } from "@/components/agenda/add-activity-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { getActivityTypeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { AgendaActivity } from "@/lib/queries/agenda";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface ProspectOption {
  id: string;
  raisonSociale: string;
  ville: string | null;
}

interface WeekViewProps {
  weekStart: Date;
  activities: AgendaActivity[];
  prospects: ProspectOption[];
  /** Affiche le prénom du propriétaire sur chaque activité (vue admin "Toute l'équipe"). */
  showUserBadge?: boolean;
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WeekView({
  weekStart,
  activities,
  prospects,
  showUserBadge = false,
}: WeekViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Groupe par jour
  const grouped: AgendaActivity[][] = Array.from({ length: 7 }, () => []);
  for (const a of activities) {
    const d = new Date(a.date);
    d.setHours(0, 0, 0, 0);
    const dayIdx = Math.round(
      (d.getTime() - weekStart.getTime()) / 86400_000,
    );
    if (dayIdx >= 0 && dayIdx < 7) grouped[dayIdx].push(a);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {DAYS.map((label, idx) => {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + idx);
        const isToday = dayDate.getTime() === today.getTime();
        const isPast = dayDate < today;
        return (
          <Card
            key={idx}
            className={cn(
              isToday && "ring-2 ring-primary",
              isPast && "opacity-70",
            )}
          >
            <CardContent className="p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isToday && "text-primary",
                  )}
                >
                  {label}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {String(dayDate.getDate()).padStart(2, "0")}/
                  {String(dayDate.getMonth() + 1).padStart(2, "0")}
                </p>
              </div>

              {grouped[idx].length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/20 px-2 py-4 text-center text-[11px] text-muted-foreground">
                  —
                </p>
              ) : (
                <div className="space-y-1.5">
                  {grouped[idx].map((a) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      showUserBadge={showUserBadge}
                    />
                  ))}
                </div>
              )}

              {/* Bouton "+ Ajouter" pré-réglé sur ce jour */}
              <AddActivityDialog
                prospects={prospects}
                defaultDate={toIso(dayDate)}
                defaultTime="09:00"
                triggerMode="day"
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const STATUT_CLASSES: Record<string, string> = {
  PLANIFIE: "bg-blue-50 border-blue-200 text-blue-900",
  EN_COURS: "bg-amber-50 border-amber-200 text-amber-900",
  FAIT: "bg-emerald-50 border-emerald-200 text-emerald-900 opacity-60",
  MANQUE: "bg-red-50 border-red-200 text-red-900",
  REPLANIFIE: "bg-slate-50 border-slate-200 text-slate-700",
  ANNULE: "bg-slate-50 border-slate-200 text-slate-400 line-through",
};

// Palette par utilisateur (déterministe) pour distinguer Arthur vs Sophie
// dans la vue "Toute l'équipe". Couleur ≠ statut → on garde les couleurs
// de statut, on ajoute juste une pastille à côté du nom.
const USER_DOT_COLORS = [
  "#0E1936", // navy
  "#F47174", // coral
  "#2563eb",
  "#10b981",
  "#a855f7",
];
function colorForUser(userId: string): string {
  // Hash simple basé sur le userId pour assigner une couleur stable
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return USER_DOT_COLORS[Math.abs(h) % USER_DOT_COLORS.length];
}

function ActivityRow({
  activity: a,
  showUserBadge = false,
}: {
  activity: AgendaActivity;
  showUserBadge?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const markDone = () =>
    startTransition(async () => {
      const res = await markActivityDone(a.id);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Faite.");
    });

  const replanTomorrow = () =>
    startTransition(async () => {
      const tomorrow = new Date(a.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const res = await rescheduleActivity(a.id, tomorrow);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success("Replanifiée à J+1.");
    });

  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 text-xs",
        STATUT_CLASSES[a.statut],
      )}
    >
      <div className="flex items-center gap-1.5">
        <ActivityIcon type={a.type} size={20} />
        <span className="font-mono font-semibold tabular-nums">
          {formatTime(a.date)}
        </span>
        <span className="opacity-70">{getActivityTypeLabel(a.type)}</span>
        {showUserBadge && a.user && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-medium">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colorForUser(a.user.id) }}
            />
            {a.user.name.split(" ")[0]}
          </span>
        )}
      </div>
      <Link
        href={`/prospects/${a.prospect.id}`}
        className="mt-1 block truncate font-medium hover:underline"
      >
        {a.prospect.raisonSociale}
      </Link>
      <p className="truncate text-[10px] opacity-70">{a.sujet}</p>

      {(a.statut === "PLANIFIE" || a.statut === "EN_COURS") && (
        <div className="mt-1.5 flex gap-1">
          <button
            type="button"
            onClick={markDone}
            disabled={pending}
            className="flex-1 rounded border border-emerald-300 bg-white px-1 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            ✓ Fait
          </button>
          <button
            type="button"
            onClick={replanTomorrow}
            disabled={pending}
            className="flex-1 rounded border border-border bg-white px-1 py-0.5 text-[10px] hover:bg-muted disabled:opacity-50"
            title="Replanifier à demain"
          >
            J+1
          </button>
        </div>
      )}
    </div>
  );
}
