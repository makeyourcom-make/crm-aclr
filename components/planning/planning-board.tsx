"use client";

/**
 * Planning de production.
 *
 *  - Vue MOIS : une ligne par service de chaque client, 12 mois glissants ;
 *    chaque mois se déplie en 4 semaines (S1 1-7, S2 8-14, S3 15-21, S4 22-fin).
 *  - Vue SEMAINE : du lundi au vendredi, avec la charge de chaque jour.
 *  - Vue AUJOURD'HUI : les tâches du jour + les retards.
 *
 * Un clic sur le rond valide la tâche (vert) ; un clic sur le libellé ouvre le
 * détail. Une tâche non faite d'un mois passé est REPORTÉE sur le mois courant
 * (rouge) ; au-delà d'un mois de retard elle passe en rouge foncé (alerte).
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reequilibrer, setTacheStatut } from "@/app/(app)/dossiers/planning/actions";
import { Icon } from "@/components/icon";
import { AddLigneDialog } from "@/components/planning/add-ligne-dialog";
import { LigneDialog } from "@/components/planning/ligne-dialog";
import {
  CRITIQUE_CHIP,
  RETARD_CHIP,
  STATUT_META,
  addDaysStr,
  addMonthsStr,
  chipClass,
  dayLabel,
  dayOf,
  etatTache,
  fmtDuree,
  monthLabel,
  monthOf,
  weekOfMonthStr,
  type Statut,
} from "@/components/planning/shared";
import { TaskDialog } from "@/components/planning/task-dialog";
import { Button } from "@/components/ui/button";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import { SERVICES, libelleCourt, type ServiceCode } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";

type Vue = "mois" | "semaine" | "jour";
const PLACEHOLDERS = new Set(["A_CONFIGURER", "PACK"]);
const SEMAINES = [1, 2, 3, 4] as const;
const SEMAINE_LABEL = { 1: "S1 · 1-7", 2: "S2 · 8-14", 3: "S3 · 15-21", 4: "S4 · 22-fin" } as const;

export function PlanningBoard({
  vue,
  from,
  today,
  ownerId,
  ownerQuery,
  lignes,
  taches,
}: {
  vue: Vue;
  from: string;
  today: string;
  ownerId: string;
  ownerQuery: string;
  lignes: PlanningLigneDTO[];
  taches: PlanningTacheDTO[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [recalcPending, startRecalc] = useTransition();
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [override, setOverride] = useState<Record<string, Statut>>({});
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openLigne, setOpenLigne] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<null | { client?: { id: string; nom: string }; deja?: string[] }>(null);

  const all = useMemo(
    () => taches.map((t) => (override[t.id] ? { ...t, statut: override[t.id]! } : t)),
    [taches, override],
  );
  const ligneById = useMemo(() => new Map(lignes.map((l) => [l.id, l])), [lignes]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lignes.filter(
      (l) =>
        (!q || l.client.toLowerCase().includes(q)) &&
        (filtre.size === 0 || filtre.has(l.service)),
    );
  }, [lignes, search, filtre]);
  const visibleIds = useMemo(() => new Set(visibles.map((l) => l.id)), [visibles]);
  const tachesVisibles = useMemo(
    () => all.filter((t) => visibleIds.has(t.ligneId) && t.statut !== "ABANDONNEE"),
    [all, visibleIds],
  );

  const servicesPresents = useMemo(
    () => [...new Set(lignes.map((l) => l.service))].filter((s) => !PLACEHOLDERS.has(s)),
    [lignes],
  );

  const toggleDone = (t: PlanningTacheDTO) => {
    const next: Statut = t.statut === "FAIT" ? "A_FAIRE" : "FAIT";
    const prev = t.statut;
    setOverride((o) => ({ ...o, [t.id]: next }));
    startTransition(async () => {
      const res = await setTacheStatut(t.id, next);
      if (!res.ok) {
        setOverride((o) => ({ ...o, [t.id]: prev }));
        toast.error(res.error ?? "Échec.");
        return;
      }
      router.refresh();
    });
  };

  const recalculer = () => {
    if (
      !confirm(
        "Recalculer l'étalement ?\n\nLes tâches à venir non commencées (hors dates fixes) sont replacées pour lisser la charge de travail. Les dates modifiées à la main sur ces tâches seront recalculées.",
      )
    )
      return;
    startRecalc(async () => {
      const res = await reequilibrer(ownerId);
      if (!res.ok) {
        toast.error(res.error ?? "Échec.");
        return;
      }
      toast.success(`Étalement recalculé (${res.deplacees ?? 0} tâche(s) replacée(s)) ✓`);
      router.refresh();
    });
  };

  const tacheOuverte = openTask ? all.find((t) => t.id === openTask) : null;
  const ligneOuverte = openLigne ? ligneById.get(openLigne) : null;
  const href = (v: Vue, debut?: string) =>
    `/dossiers/planning?vue=${v}${debut ? `&debut=${debut}` : ""}${ownerQuery}`;

  return (
    <div>
      {/* Barre d'outils */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(
            [
              ["mois", "Mois"],
              ["semaine", "Semaine"],
              ["jour", "Aujourd'hui"],
            ] as const
          ).map(([v, label]) => (
            <Link
              key={v}
              href={href(v)}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium",
                vue === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {vue !== "jour" && (
          <div className="inline-flex items-center gap-1">
            <Link
              href={href(vue, vue === "mois" ? monthOf(addMonthsStr(from, -1)) : addDaysStr(from, -7))}
              className="rounded-md border border-border p-1.5 hover:bg-muted"
              aria-label="Précédent"
            >
              <Icon name="ChevronLeft" className="h-4 w-4" />
            </Link>
            <Link href={href(vue)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">
              {vue === "mois" ? "Mois en cours" : "Cette semaine"}
            </Link>
            <Link
              href={href(vue, vue === "mois" ? monthOf(addMonthsStr(from, 1)) : addDaysStr(from, 7))}
              className="rounded-md border border-border p-1.5 hover:bg-muted"
              aria-label="Suivant"
            >
              <Icon name="ChevronRight" className="h-4 w-4" />
            </Link>
            <span className="ml-1 text-sm font-medium">
              {vue === "mois"
                ? `${monthLabel(monthOf(from))} → ${monthLabel(monthOf(addMonthsStr(from, 11)))}`
                : `${dayLabel(from)} → ${dayLabel(addDaysStr(from, 4))}`}
            </span>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer un client…"
            className="h-8 w-48 rounded-md border border-input bg-background px-2.5 text-sm"
          />
          <Button size="sm" variant="outline" onClick={() => setAddFor({})}>
            <Icon name="Plus" className="mr-1 h-3.5 w-3.5" />
            Client / service
          </Button>
          <Button size="sm" variant="outline" onClick={recalculer} disabled={recalcPending}>
            <Icon name="Shuffle" className="mr-1 h-3.5 w-3.5" />
            {recalcPending ? "Calcul…" : "Recalculer l'étalement"}
          </Button>
        </div>
      </div>

      {/* Filtres services + légende */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        {servicesPresents.map((s) => {
          const meta = SERVICES[s as ServiceCode];
          const on = filtre.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() =>
                setFiltre((f) => {
                  const n = new Set(f);
                  if (n.has(s)) n.delete(s);
                  else n.add(s);
                  return n;
                })
              }
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-medium transition-opacity",
                meta?.badge,
                filtre.size > 0 && !on ? "opacity-40" : "",
                on ? "border-current" : "border-transparent",
              )}
            >
              {meta?.label ?? s}
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" />
        {(["A_FAIRE", "EN_COURS", "ATTENTE_CLIENT", "FAIT"] as Statut[]).map((s) => (
          <span key={s} className={cn("rounded border px-1.5 py-0.5", STATUT_META[s].chip)}>
            {STATUT_META[s].label}
          </span>
        ))}
        <span className={cn("rounded border px-1.5 py-0.5", RETARD_CHIP)}>En retard (reportée)</span>
        <span className={cn("rounded border px-1.5 py-0.5", CRITIQUE_CHIP)}>Retard &gt; 1 mois</span>
      </div>

      {lignes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Aucun client dans ce planning pour l&apos;instant.</p>
          <Button className="mt-3" onClick={() => setAddFor({})}>
            Ajouter un client / service
          </Button>
        </div>
      ) : vue === "mois" ? (
        <MonthView
          from={from}
          today={today}
          lignes={visibles}
          taches={tachesVisibles}
          expanded={expanded}
          setExpanded={setExpanded}
          onToggle={toggleDone}
          onOpenTask={setOpenTask}
          onOpenLigne={setOpenLigne}
          onAdd={(c, deja) => setAddFor({ client: c, deja })}
        />
      ) : vue === "semaine" ? (
        <WeekView
          from={from}
          today={today}
          taches={tachesVisibles}
          ligneById={ligneById}
          onToggle={toggleDone}
          onOpenTask={setOpenTask}
        />
      ) : (
        <DayView
          today={today}
          taches={tachesVisibles}
          ligneById={ligneById}
          onToggle={toggleDone}
          onOpenTask={setOpenTask}
        />
      )}

      {tacheOuverte && (
        <TaskDialog
          key={tacheOuverte.id}
          tache={tacheOuverte}
          client={ligneById.get(tacheOuverte.ligneId)?.client ?? ""}
          service={serviceLabel(ligneById.get(tacheOuverte.ligneId))}
          today={today}
          onClose={() => setOpenTask(null)}
        />
      )}
      {ligneOuverte && (
        <LigneDialog key={ligneOuverte.id} ligne={ligneOuverte} today={today} onClose={() => setOpenLigne(null)} />
      )}
      {addFor && (
        <AddLigneDialog
          ownerId={ownerId}
          client={addFor.client}
          dejaPresents={addFor.deja}
          onClose={() => setAddFor(null)}
        />
      )}
    </div>
  );
}

function serviceLabel(l?: PlanningLigneDTO): string {
  if (!l) return "";
  return l.libelle ?? SERVICES[l.service as ServiceCode]?.label ?? l.service;
}

// ---------------------------------------------------------------------------
// Pastille de tâche
// ---------------------------------------------------------------------------

function TaskChip({
  t,
  today,
  client,
  onToggle,
  onOpen,
}: {
  t: PlanningTacheDTO;
  today: string;
  client?: string;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpen: (id: string) => void;
}) {
  const etat = etatTache(t, today);
  const reportee = etat !== "ok" && monthOf(t.date) !== monthOf(today);
  return (
    <div
      className={cn("flex items-center gap-1 rounded border px-1 py-0.5 text-[11px] leading-tight", chipClass(t, today))}
      title={`${t.titre} · ${dayLabel(t.date)} · ${fmtDuree(t.dureeMin)} · ${etat === "ok" ? STATUT_META[t.statut].label : etat === "critique" ? "retard > 1 mois" : "en retard"}`}
    >
      <button
        type="button"
        onClick={() => onToggle(t)}
        className="shrink-0 rounded-full hover:scale-110"
        aria-label={t.statut === "FAIT" ? "Remettre à faire" : "Marquer comme fait"}
      >
        <Icon name={t.statut === "FAIT" ? "CircleCheck" : "Circle"} className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onOpen(t.id)} className="min-w-0 flex-1 truncate text-left">
        {client && <span className="font-semibold">{client} · </span>}
        {libelleCourt(t.code, t.titre)}
      </button>
      <span className="shrink-0 tabular-nums opacity-70">
        {reportee ? "↪ " : ""}
        {dayOf(t.date)}
        {reportee ? `/${Number(t.date.slice(5, 7))}` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue MOIS
// ---------------------------------------------------------------------------

function MonthView({
  from,
  today,
  lignes,
  taches,
  expanded,
  setExpanded,
  onToggle,
  onOpenTask,
  onOpenLigne,
  onAdd,
}: {
  from: string;
  today: string;
  lignes: PlanningLigneDTO[];
  taches: PlanningTacheDTO[];
  expanded: Set<string>;
  setExpanded: (fn: (s: Set<string>) => Set<string>) => void;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
  onOpenLigne: (id: string) => void;
  onAdd: (c: { id: string; nom: string }, deja: string[]) => void;
}) {
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthOf(addMonthsStr(from, i))), [from]);
  const curMonth = monthOf(today);
  const curWeek = weekOfMonthStr(today);

  // Une tâche en retard d'un mois passé s'affiche (reportée) sur le mois courant.
  const placeOf = (t: PlanningTacheDTO): { m: string; w: 1 | 2 | 3 | 4 } => {
    const late = etatTache(t, today) !== "ok";
    if (late && monthOf(t.date) !== curMonth) return { m: curMonth, w: curWeek };
    return { m: monthOf(t.date), w: weekOfMonthStr(t.date) };
  };

  const index = useMemo(() => {
    const map = new Map<string, PlanningTacheDTO[]>(); // ligne|mois|semaine
    const charge = new Map<string, number>(); // mois → minutes
    for (const t of taches) {
      const p = placeOf(t);
      const k = `${t.ligneId}|${p.m}|${p.w}`;
      map.set(k, [...(map.get(k) ?? []), t]);
      if (t.statut !== "FAIT") charge.set(p.m, (charge.get(p.m) ?? 0) + t.dureeMin);
    }
    return { map, charge };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches, today]);

  const cell = (ligneId: string, m: string, weeks: readonly (1 | 2 | 3 | 4)[]) =>
    weeks
      .flatMap((w) => index.map.get(`${ligneId}|${m}|${w}`) ?? [])
      .sort((a, b) => a.date.localeCompare(b.date));

  // Regroupe les lignes par client.
  const groupes = useMemo(() => {
    const g = new Map<string, PlanningLigneDTO[]>();
    for (const l of lignes) g.set(l.prospectId, [...(g.get(l.prospectId) ?? []), l]);
    return [...g.values()];
  }, [lignes]);

  const nbCols = months.reduce((s, m) => s + (expanded.has(m) ? 4 : 1), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th rowSpan={2} className="sticky left-0 z-20 w-44 min-w-44 border-b border-r border-border bg-muted px-2 py-2 text-left text-xs font-semibold">
              Client
            </th>
            <th rowSpan={2} className="sticky left-44 z-20 w-36 min-w-36 border-b border-r border-border bg-muted px-2 py-2 text-left text-xs font-semibold">
              Service
            </th>
            {months.map((m) => (
              <th
                key={m}
                colSpan={expanded.has(m) ? 4 : 1}
                className={cn(
                  "border-b border-r border-border px-1 py-1.5 text-xs font-semibold",
                  m === curMonth && "bg-primary/10",
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(m)) n.delete(m);
                      else n.add(m);
                      return n;
                    })
                  }
                  className="inline-flex items-center gap-1 rounded px-1 hover:bg-muted"
                  title={expanded.has(m) ? "Replier les semaines" : "Déplier en semaines"}
                >
                  <Icon name={expanded.has(m) ? "ChevronDown" : "ChevronRight"} className="h-3 w-3" />
                  {monthLabel(m)}
                </button>
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {fmtDuree(index.charge.get(m) ?? 0)} à faire
                </span>
              </th>
            ))}
          </tr>
          <tr className="bg-muted/30">
            {months.map((m) =>
              expanded.has(m) ? (
                SEMAINES.map((w) => (
                  <th key={`${m}-${w}`} className="min-w-28 border-b border-r border-border px-1 py-1 text-[10px] font-medium text-muted-foreground">
                    {SEMAINE_LABEL[w]}
                  </th>
                ))
              ) : (
                <th key={m} className="min-w-32 border-b border-r border-border" />
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {groupes.map((ls) => {
            const client = { id: ls[0]!.prospectId, nom: ls[0]!.client };
            const deja = ls.map((l) => l.service);
            return ls.map((l, i) => (
              <tr key={l.id} className={cn(i === ls.length - 1 && "border-b-2 border-border")}>
                {i === 0 && (
                  <td
                    rowSpan={ls.length}
                    className="sticky left-0 z-10 w-44 min-w-44 border-b border-r border-border bg-card px-2 py-1.5 align-top"
                  >
                    <p className="text-sm font-medium leading-tight">{client.nom}</p>
                    <button
                      type="button"
                      onClick={() => onAdd(client, deja)}
                      className="mt-1 text-[11px] text-primary hover:underline"
                    >
                      + service
                    </button>
                  </td>
                )}
                <td className="sticky left-44 z-10 w-36 min-w-36 border-b border-r border-border bg-card px-2 py-1.5 align-top">
                  <button
                    type="button"
                    onClick={() => onOpenLigne(l.id)}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:ring-1 hover:ring-current",
                      SERVICES[l.service as ServiceCode]?.badge ?? "bg-slate-100",
                    )}
                    title="Régler les récurrences de ce service"
                  >
                    <Icon name="Settings" className="h-3 w-3 shrink-0" />
                    <span className="truncate">{serviceLabel(l)}</span>
                  </button>
                </td>
                {PLACEHOLDERS.has(l.service) ? (
                  <td colSpan={nbCols} className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    {l.service === "PACK"
                      ? "Pack : précise les services qu'il contient avec « + service » (Site, Réseaux sociaux, SEO…)."
                      : "Le contrat n'a pas de produit rattaché : choisis les services de ce client avec « + service »."}
                  </td>
                ) : (
                  months.map((m) =>
                    (expanded.has(m) ? SEMAINES.map((w) => [w] as const) : [SEMAINES]).map((weeks) => (
                      <td
                        key={`${m}-${weeks.join("")}`}
                        className={cn(
                          "border-b border-r border-border px-1 py-1 align-top",
                          m === curMonth && "bg-primary/[0.03]",
                        )}
                      >
                        <div className="space-y-0.5">
                          {cell(l.id, m, weeks).map((t) => (
                            <TaskChip key={t.id} t={t} today={today} onToggle={onToggle} onOpen={onOpenTask} />
                          ))}
                        </div>
                      </td>
                    )),
                  )
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue SEMAINE
// ---------------------------------------------------------------------------

function WeekView({
  from,
  today,
  taches,
  ligneById,
  onToggle,
  onOpenTask,
}: {
  from: string;
  today: string;
  taches: PlanningTacheDTO[];
  ligneById: Map<string, PlanningLigneDTO>;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
}) {
  const jours = Array.from({ length: 5 }, (_, i) => addDaysStr(from, i));
  const retards = taches.filter((t) => t.date < from && etatTache(t, today) !== "ok");
  const col = (titre: string, list: PlanningTacheDTO[], highlight = false, alert = false) => (
    <div
      className={cn(
        "flex min-h-40 flex-col rounded-lg border border-border bg-card",
        highlight && "border-primary/50 ring-1 ring-primary/30",
        alert && "border-red-300 bg-red-50/40",
      )}
    >
      <div className="border-b border-border px-2 py-1.5">
        <p className={cn("text-xs font-semibold", alert && "text-red-700")}>{titre}</p>
        <p className="text-[10px] text-muted-foreground">
          {list.length} tâche(s) · {fmtDuree(list.filter((t) => t.statut !== "FAIT").reduce((s, t) => s + t.dureeMin, 0))} à faire
        </p>
      </div>
      <div className="flex-1 space-y-1 p-1.5">
        {list.map((t) => (
          <TaskChip
            key={t.id}
            t={t}
            today={today}
            client={ligneById.get(t.ligneId)?.client}
            onToggle={onToggle}
            onOpen={onOpenTask}
          />
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {col("En retard", retards, false, retards.length > 0)}
      {jours.map((d) =>
        col(
          dayLabel(d),
          taches.filter((t) => t.date === d),
          d === today,
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue AUJOURD'HUI
// ---------------------------------------------------------------------------

function DayView({
  today,
  taches,
  ligneById,
  onToggle,
  onOpenTask,
}: {
  today: string;
  taches: PlanningTacheDTO[];
  ligneById: Map<string, PlanningLigneDTO>;
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
}) {
  const critiques = taches.filter((t) => etatTache(t, today) === "critique");
  const retards = taches.filter((t) => etatTache(t, today) === "retard");
  const dujour = taches.filter((t) => t.date === today);
  const reste = [...critiques, ...retards, ...dujour].filter((t) => t.statut !== "FAIT");
  const total = reste.reduce((s, t) => s + t.dureeMin, 0);

  const section = (titre: string, list: PlanningTacheDTO[], tone?: "red" | "redDark") =>
    list.length > 0 && (
      <section className="space-y-1.5">
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
            tone === "red" && "text-red-700",
            tone === "redDark" && "text-red-800",
          )}
        >
          {titre} · {list.length}
        </h3>
        {list.map((t) => {
          const l = ligneById.get(t.ligneId);
          return (
            <div
              key={t.id}
              className={cn("flex items-center gap-3 rounded-lg border px-3 py-2", chipClass(t, today))}
            >
              <button type="button" onClick={() => onToggle(t)} aria-label="Marquer comme fait" className="shrink-0">
                <Icon name={t.statut === "FAIT" ? "CircleCheck" : "Circle"} className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onOpenTask(t.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">
                  {l?.client} <span className="font-normal opacity-80">· {t.titre}</span>
                </p>
                <p className="text-xs opacity-75">
                  {serviceLabel(l)} · {fmtDuree(t.dureeMin)}
                  {t.date !== today && ` · prévue le ${dayLabel(t.date)}`}
                </p>
              </button>
            </div>
          );
        })}
      </section>
    );

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm">
        <strong>{dayLabel(today)}</strong> · {reste.length} tâche(s) restante(s) · {fmtDuree(total)} de travail
      </p>
      {section("Retard de plus d'un mois", critiques, "redDark")}
      {section("En retard", retards, "red")}
      {section("Aujourd'hui", dujour)}
      {critiques.length + retards.length + dujour.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Rien de prévu aujourd&apos;hui. 🎉
        </div>
      )}
    </div>
  );
}
