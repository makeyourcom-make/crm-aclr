"use client";

/**
 * Grille 12 mois du planning (ancien tableau, restylé MYC Arena) : une ligne
 * par service de chaque client, 12 mois glissants ; chaque mois se déplie en
 * 4 semaines (S1 1-7, S2 8-14, S3 15-21, S4 22-fin).
 * Mêmes sections dynamiques que la vue « Clients ».
 */
import { ChevronDown, ChevronRight, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  PLACEHOLDERS,
  addMonthsStr,
  etatTache,
  fmtDuree,
  monthLabel,
  monthOf,
  serviceLabelOf,
  serviceStyle,
  weekOfMonthStr,
} from "@/components/planning/shared";
import { TaskChip } from "@/components/planning/task-items";
import type { PlanningLigneDTO, PlanningTacheDTO } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

const SEMAINES = [1, 2, 3, 4] as const;
const SEMAINE_LABEL = { 1: "S1 · 1-7", 2: "S2 · 8-14", 3: "S3 · 15-21", 4: "S4 · 22-fin" } as const;
const TITRES = [
  "À traiter : retards et tâches de cette semaine",
  "À venir",
  "Rien de prévu sur la période",
  "Services à préciser",
] as const;

export function MonthGrid({
  from,
  today,
  taches,
  sections,
  onToggle,
  onOpenTask,
  onOpenLigne,
  onAdd,
}: {
  from: string;
  today: string;
  lignes: PlanningLigneDTO[];
  taches: PlanningTacheDTO[];
  sections: { id: 0 | 1 | 2 | 3; groupes: { ls: PlanningLigneDTO[] }[] }[];
  onToggle: (t: PlanningTacheDTO) => void;
  onOpenTask: (id: string) => void;
  onOpenLigne: (id: string) => void;
  onAdd: (c: { id: string; nom: string }, deja: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthOf(addMonthsStr(from, i))), [from]);
  const curMonth = monthOf(today);
  const curWeek = weekOfMonthStr(today);

  const index = useMemo(() => {
    const map = new Map<string, PlanningTacheDTO[]>(); // ligne|mois|semaine
    const charge = new Map<string, number>(); // mois → minutes
    for (const t of taches) {
      const late = etatTache(t, today) !== "ok";
      const p =
        late && monthOf(t.date) !== curMonth
          ? { m: curMonth, w: curWeek }
          : { m: monthOf(t.date), w: weekOfMonthStr(t.date) };
      const k = `${t.ligneId}|${p.m}|${p.w}`;
      map.set(k, [...(map.get(k) ?? []), t]);
      if (t.statut !== "FAIT") charge.set(p.m, (charge.get(p.m) ?? 0) + t.dureeMin);
    }
    return { map, charge };
  }, [taches, today, curMonth, curWeek]);

  const cell = (ligneId: string, m: string, weeks: readonly (1 | 2 | 3 | 4)[]) =>
    weeks
      .flatMap((w) => index.map.get(`${ligneId}|${m}|${w}`) ?? [])
      .sort((a, b) => a.date.localeCompare(b.date));

  const nbCols = months.reduce((s, m) => s + (expanded.has(m) ? 4 : 1), 0);
  const toggleMonth = (m: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });

  return (
    <div className="overflow-x-auto rounded-[16px] border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ground">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 w-32 min-w-32 sm:w-44 sm:min-w-44 border-r border-b border-border bg-ground px-2.5 py-2 text-left text-xs font-extrabold"
            >
              Client
            </th>
            <th
              rowSpan={2}
              className="z-20 w-36 min-w-36 sm:sticky sm:left-44 border-r border-b border-border bg-ground px-2.5 py-2 text-left text-xs font-extrabold"
            >
              Service
            </th>
            {months.map((m) => (
              <th
                key={m}
                colSpan={expanded.has(m) ? 4 : 1}
                className={cn(
                  "border-r border-b border-border px-1 py-1.5 text-xs font-extrabold",
                  m === curMonth && "bg-lvl-50 text-lvl-700",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleMonth(m)}
                  aria-expanded={expanded.has(m)}
                  className="inline-flex items-center gap-1 rounded-[6px] px-1 hover:bg-navy-50"
                  title={expanded.has(m) ? "Replier les semaines" : "Déplier en semaines"}
                >
                  {expanded.has(m) ? (
                    <ChevronDown aria-hidden="true" className="size-3" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-3" />
                  )}
                  {monthLabel(m)}
                </button>
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  {fmtDuree(index.charge.get(m) ?? 0)} à faire
                </span>
              </th>
            ))}
          </tr>
          <tr className="bg-ground/60">
            {months.map((m) =>
              expanded.has(m) ? (
                SEMAINES.map((w) => (
                  <th
                    key={`${m}-${w}`}
                    className="min-w-28 border-r border-b border-border px-1 py-1 text-[11px] font-semibold text-muted-foreground"
                  >
                    {SEMAINE_LABEL[w]}
                  </th>
                ))
              ) : (
                <th key={m} className="min-w-32 border-r border-b border-border" />
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => [
            <tr key={`sec-${sec.id}`} className="bg-navy-50">
              <td
                colSpan={2}
                className="sticky left-0 z-10 bg-navy-50 px-2.5 py-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase"
              >
                {TITRES[sec.id]} · {sec.groupes.length}
              </td>
              <td colSpan={nbCols} className="bg-navy-50" />
            </tr>,
            ...sec.groupes.map(({ ls }) => {
              const client = { id: ls[0]!.prospectId, nom: ls[0]!.client };
              const deja = ls.map((l) => l.service);
              return ls.map((l, i) => {
                const st = serviceStyle(l.service);
                return (
                  <tr key={l.id} className={cn(i === ls.length - 1 && "border-b-2 border-border")}>
                    {i === 0 && (
                      <td
                        rowSpan={ls.length}
                        className="sticky left-0 z-10 w-32 min-w-32 sm:w-44 sm:min-w-44 border-r border-b border-border bg-card px-2.5 py-1.5 align-top"
                      >
                        <Link
                          href={`/prospects/${client.id}`}
                          className="text-sm leading-tight font-bold text-foreground hover:underline"
                        >
                          {client.nom}
                        </Link>
                        <button
                          type="button"
                          onClick={() => onAdd(client, deja)}
                          className="mt-1 flex items-center gap-0.5 text-[11px] font-bold text-info-700 hover:underline"
                        >
                          <Plus aria-hidden="true" className="size-3" />
                          service
                        </button>
                      </td>
                    )}
                    <td className="z-10 w-36 min-w-36 sm:sticky sm:left-44 border-r border-b border-border bg-card px-2.5 py-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => onOpenLigne(l.id)}
                        className={cn(
                          "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-bold hover:ring-1 hover:ring-current",
                          st.pill,
                        )}
                        title="Régler les récurrences de ce service"
                      >
                        <Settings aria-hidden="true" className="size-3 shrink-0" />
                        <span className="truncate">{l.libelle ?? serviceLabelOf(l.service)}</span>
                      </button>
                    </td>
                    {PLACEHOLDERS.has(l.service) ? (
                      <td colSpan={nbCols} className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                        {l.service === "PACK"
                          ? "Pack : précise les services qu'il contient avec « + service » (Site, Réseaux sociaux, SEO...)."
                          : "Le contrat n'a pas de produit rattaché : choisis les services de ce client avec « + service »."}
                      </td>
                    ) : (
                      months.map((m) =>
                        (expanded.has(m) ? SEMAINES.map((w) => [w] as const) : [SEMAINES]).map((weeks) => (
                          <td
                            key={`${m}-${weeks.join("")}`}
                            className={cn(
                              "border-r border-b border-border px-1 py-1 align-top",
                              m === curMonth && "bg-lvl-50/40",
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
                );
              });
            }),
          ])}
        </tbody>
      </table>
    </div>
  );
}
