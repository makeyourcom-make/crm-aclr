"use client";

/**
 * Vue JOUR du planning (MYC Arena) : « Mission du jour » (anneau des minutes
 * livrées aujourd'hui) + listes priorisées : le boss (retard > 1 mois), les
 * retards, les tâches du jour, puis les balles chez le client.
 */
import { PartyPopper } from "lucide-react";

import { ProgressRing } from "@/components/arena/progress-ring";
import { dayLong, etatTache, fmtDuree, serviceLabelOf } from "@/components/planning/shared";
import { TaskCard } from "@/components/planning/task-items";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

export function DayView({
  today,
  taches,
  jour,
  ligneById,
  flash,
  isSelf,
  filtre = false,
  onToggle,
  onOpenTask,
}: {
  today: string;
  taches: PlanningTacheDTO[];
  /** Mission du jour (toutes les tâches du jour, hors filtres). */
  jour: { totalMin: number; faitMin: number; count: number; resteCount: number; done: boolean };
  ligneById: Map<string, PlanningLigneDTO>;
  flash: string | null;
  isSelf: boolean;
  /** Un filtre (statut, service, recherche) masque une partie des tâches. */
  filtre?: boolean;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
}) {
  const passees = taches.filter((t) => t.date < today && etatTache(t, today) !== "ok");
  const critiques = passees.filter((t) => t.statut !== "ATTENTE_CLIENT" && etatTache(t, today) === "critique");
  const retards = passees.filter((t) => t.statut !== "ATTENTE_CLIENT" && etatTache(t, today) === "retard");
  const attente = passees.filter((t) => t.statut === "ATTENTE_CLIENT");
  const dujour = taches
    .filter((t) => t.date === today)
    .sort((a, b) => Number(a.statut === "FAIT") - Number(b.statut === "FAIT"));

  const pct = jour.totalMin ? Math.round((jour.faitMin / jour.totalMin) * 100) : jour.count ? 0 : 100;
  const resteMin = jour.totalMin - jour.faitMin;
  const recap = jour.resteCount
    ? `${jour.resteCount} tâche${jour.resteCount > 1 ? "s" : ""} restante${jour.resteCount > 1 ? "s" : ""} · ${fmtDuree(resteMin)} de travail`
    : jour.count
      ? "Tout est livré pour aujourd'hui."
      : "Aucune tâche prévue aujourd'hui.";

  const card = (t: PlanningTacheDTO) => {
    const l = ligneById.get(t.ligneId);
    return (
      <TaskCard
        key={t.id}
        t={t}
        today={today}
        layout="row"
        client={l?.client ?? ""}
        service={{ code: l?.service ?? "AUTRE", label: l ? (l.libelle ?? serviceLabelOf(l.service)) : "" }}
        flash={flash === t.id}
        onToggle={onToggle}
        onOpen={onOpenTask}
      />
    );
  };

  const blocs = [
    critiques.length > 0 && {
      key: "boss",
      titre: "Retard de plus d'un mois",
      sous: "Le boss : à abattre en premier",
      dot: "bg-alert-700",
      tx: "text-alert-700",
      list: critiques,
      vide: "",
    },
    {
      key: "retard",
      titre: "En retard",
      sous: "Reportées sur le mois en cours",
      dot: "bg-alert-500",
      tx: "text-alert-700",
      list: retards,
      vide: filtre ? "Aucun retard avec ces filtres." : isSelf ? "Aucun retard. Tu es à jour." : "Aucun retard.",
    },
    {
      key: "jour",
      titre: "Aujourd'hui",
      sous: recap,
      dot: "bg-lvl-500",
      tx: "text-lvl-700",
      list: dujour,
      vide: filtre
        ? "Aucune tâche du jour avec ces filtres."
        : "Rien de prévu aujourd'hui. Prends de l'avance sur demain.",
    },
    attente.length > 0 && {
      key: "attente",
      titre: "Balle chez le client",
      sous: "Hors retard : relance-les depuis leur fiche",
      dot: "bg-lvl-500",
      tx: "text-lvl-700",
      list: attente,
      vide: "",
    },
  ].filter(Boolean) as {
    key: string;
    titre: string;
    sous: string;
    dot: string;
    tx: string;
    list: PlanningTacheDTO[];
    vide: string;
  }[];

  return (
    <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
      {/* Mission du jour */}
      <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[20px] border border-border bg-ground p-6 text-center">
        {jour.done && <MiniConfettis />}
        <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Mission du jour · {dayLong(today)}
        </p>
        <ProgressRing
          value={jour.faitMin}
          max={Math.max(jour.totalMin, 1)}
          size={168}
          stroke={14}
          tone={jour.done ? "green" : "violet"}
          trackColor="#E5E8F0"
          label={`Mission du jour : ${fmtDuree(jour.faitMin)} livrées sur ${fmtDuree(jour.totalMin)}`}
          className={cn(jour.done && "motion-safe:animate-pop")}
        >
          <span className="score-number text-[40px] text-foreground">{pct} %</span>
          <span className="mt-1.5 text-xs font-semibold text-muted-foreground">
            {fmtDuree(jour.faitMin)} / {fmtDuree(jour.totalMin)}
          </span>
        </ProgressRing>
        <p className="font-display text-xl font-extrabold">
          {jour.done
            ? "Mission du jour pliée !"
            : jour.count
              ? `Encore ${fmtDuree(resteMin)} et ${isSelf ? "ta" : "la"} journée est pliée`
              : "Journée libre"}
        </p>
        <p className="text-sm text-muted-foreground">{recap}</p>
        {jour.done && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-win-50 px-3 py-1 text-xs font-extrabold text-win-700">
            <PartyPopper aria-hidden="true" className="size-3.5" />
            Machine de guerre
          </span>
        )}
      </div>

      {/* Listes priorisées */}
      <div className="flex min-w-0 flex-col gap-4">
        {blocs.map((b) => (
          <section key={b.key} aria-label={b.titre} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true" className={cn("size-2.5 rounded-full", b.dot)} />
              <h4 className={cn("text-[15px] font-extrabold", b.tx)}>
                {b.titre} · {b.list.length}
              </h4>
              <span className="text-xs text-muted-foreground">{b.sous}</span>
            </div>
            {b.list.map(card)}
            {b.list.length === 0 && b.vide && (
              <p
                className={cn(
                  "rounded-[14px] px-3.5 py-3 text-[13px] font-bold",
                  filtre ? "bg-ground text-muted-foreground" : "bg-win-50 text-win-700",
                )}
              >
                {b.vide}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Petits confettis locaux (chute courte) quand la journée est pliée. */
function MiniConfettis() {
  const pieces = [
    { left: "12%", w: 10, h: 6, c: "#F47174", d: "0s", r: 2 },
    { left: "24%", w: 8, h: 8, c: "#F5A524", d: "0.2s", r: 999 },
    { left: "38%", w: 12, h: 5, c: "#7C5CFC", d: "0.1s", r: 2 },
    { left: "52%", w: 7, h: 7, c: "#3B6FF6", d: "0.35s", r: 999 },
    { left: "66%", w: 11, h: 6, c: "#12A150", d: "0.15s", r: 2 },
    { left: "80%", w: 9, h: 9, c: "#F47174", d: "0.4s", r: 999 },
    { left: "90%", w: 10, h: 5, c: "#F5A524", d: "0.25s", r: 2 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-2 block motion-safe:animate-[myc-confetti_2.4s_ease-out_2_both]"
          style={{ left: p.left, width: p.w, height: p.h, background: p.c, borderRadius: p.r, animationDelay: p.d }}
        />
      ))}
    </div>
  );
}
