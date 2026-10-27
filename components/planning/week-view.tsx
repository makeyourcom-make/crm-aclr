"use client";

/**
 * Vue SEMAINE du planning (MYC Arena) : une colonne « En retard » (tâches non
 * faites d'avant la semaine affichée, avec le bloc « Balle chez le client »)
 * puis du lundi au vendredi, avec la charge de chaque jour vs la capacité.
 */
import Link from "next/link";

import {
  CAPACITE_JOUR_MIN,
  addDaysStr,
  ddmm,
  dayLong,
  etatTache,
  fmtDuree,
  serviceLabelOf,
} from "@/components/planning/shared";
import { TaskCard, TaskCheck } from "@/components/planning/task-items";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import { libelleCourt } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";

export function WeekView({
  from,
  today,
  taches,
  ligneById,
  flash,
  filtre = false,
  onToggle,
  onOpenTask,
}: {
  from: string;
  today: string;
  taches: PlanningTacheDTO[];
  ligneById: Map<string, PlanningLigneDTO>;
  flash: string | null;
  /** Un filtre (statut, service, recherche) masque une partie des tâches. */
  filtre?: boolean;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
}) {
  const jours = Array.from({ length: 5 }, (_, i) => addDaysStr(from, i));
  const avant = taches.filter((t) => t.date < from && etatTache(t, today) !== "ok");
  const retards = avant.filter((t) => t.statut !== "ATTENTE_CLIENT");
  const attente = avant.filter((t) => t.statut === "ATTENTE_CLIENT");
  const retardMin = retards.reduce((s, t) => s + t.dureeMin, 0);

  const card = (t: PlanningTacheDTO) => {
    const l = ligneById.get(t.ligneId);
    return (
      <TaskCard
        key={t.id}
        t={t}
        today={today}
        client={l?.client ?? ""}
        service={{ code: l?.service ?? "AUTRE", label: l ? (l.libelle ?? serviceLabelOf(l.service)) : "" }}
        flash={flash === t.id}
        onToggle={onToggle}
        onOpen={onOpenTask}
      />
    );
  };

  return (
    <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
      {/* En retard */}
      <section
        aria-label="En retard"
        className={cn(
          "flex min-w-0 flex-col gap-2 rounded-[16px] border-2 p-3",
          retards.length ? "border-[#F6B9BC] bg-coral-50" : "border-[#BFE9CF] bg-[#F2FBF5]",
        )}
      >
        <div className="flex flex-col gap-1">
          <h4 className={cn("text-sm font-extrabold", retards.length ? "text-alert-700" : "text-win-700")}>En retard</h4>
          <p className="text-xs font-semibold text-muted-foreground">
            {retards.length
              ? `${retards.length} à chasser · ${fmtDuree(retardMin)}`
              : filtre
                ? "Aucun retard avec ces filtres"
                : "Rien à rattraper"}
          </p>
          <Jauge
            value={retardMin}
            max={180}
            color="bg-alert-500"
            label={`Retards à rattraper : ${fmtDuree(retardMin)}`}
          />
        </div>
        {retards.map(card)}
        {retards.length === 0 && !filtre && (
          <p className="rounded-[12px] bg-win-50 p-2.5 text-center text-xs font-bold text-win-700">Zéro retard. Propre.</p>
        )}
        {attente.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5 border-t border-dashed border-[#D9CEFF] pt-2.5">
            <p className="text-[11px] font-extrabold tracking-[0.08em] text-lvl-700 uppercase">Balle chez le client</p>
            {attente.map((t) => {
              const l = ligneById.get(t.ligneId);
              const court = libelleCourt(t.code, t.titre);
              return (
                <div key={t.id} className="flex items-start gap-2 rounded-[14px] bg-lvl-50 p-2.5">
                  {/* Validation en 1 clic conservée pour les tâches en attente client. */}
                  <TaskCheck t={t} today={today} label={`${court}, ${l?.client ?? ""}`} onToggle={onToggle} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenTask(t.id)}
                      className="rounded-[6px] text-left text-[13px] font-extrabold text-lvl-700"
                    >
                      {court}
                    </button>
                    <span className="text-xs font-semibold text-lvl-700">
                      {l?.client} · depuis le {ddmm(t.date)}
                    </span>
                    {l && (
                      <Link
                        href={`/prospects/${l.prospectId}`}
                        className="self-start text-xs font-extrabold text-lvl-700 underline underline-offset-2"
                      >
                        Relancer le client
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {jours.map((d) => {
        const list = taches.filter((t) => t.date === d);
        const tri = [...list].sort((a, b) => Number(a.statut === "FAIT") - Number(b.statut === "FAIT"));
        const tot = list.reduce((s, t) => s + t.dureeMin, 0);
        const reste = list.filter((t) => t.statut !== "FAIT").reduce((s, t) => s + t.dureeMin, 0);
        const ratio = tot / CAPACITE_JOUR_MIN;
        const isToday = d === today;
        return (
          <section
            key={d}
            aria-label={dayLong(d)}
            className={cn(
              "flex min-w-0 flex-col gap-2 rounded-[16px] border-2 p-3",
              isToday ? "border-lvl-500 bg-lvl-50" : "border-border bg-ground",
            )}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1.5">
                <h4 className="text-sm font-extrabold">{dayLong(d)}</h4>
                {isToday && (
                  <span className="rounded-full bg-lvl-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                    Aujourd&apos;hui
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                {list.length} tâche{list.length > 1 ? "s" : ""} ·{" "}
                {list.length === 0 ? "libre" : reste ? `${fmtDuree(reste)} à faire` : "tout est fait"}
              </p>
              <Jauge
                value={tot}
                max={CAPACITE_JOUR_MIN}
                color={ratio < 0.7 ? "bg-win-500" : ratio < 0.9 ? "bg-gold-500" : "bg-alert-500"}
                label={`Charge du jour : ${fmtDuree(tot)} sur ${fmtDuree(CAPACITE_JOUR_MIN)}`}
              />
            </div>
            {tri.map(card)}
            {list.length === 0 && (
              <p className="rounded-[12px] bg-card p-2.5 text-center text-xs font-bold text-muted-foreground">
                Rien de prévu
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Jauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div role="img" aria-label={label} className="h-1.5 overflow-hidden rounded-full bg-border">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
