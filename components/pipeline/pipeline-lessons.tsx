"use client";

/**
 * « Leçons du mois » : l'étape Perdu (zone de dépôt dnd-kit « PERDU »).
 * Les pertes du mois avec leur raison et la leçon retenue, comptées par
 * raison. Glisser une carte ici la classe perdue (la raison est demandée).
 */
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, Lightbulb } from "lucide-react";
import { useState } from "react";

import { formatCHFCompact } from "@/lib/format";
import type { PipelineDeal } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import { DraggableDealCard, type DealCardHandlers } from "./deal-card";
import { LOST_REASONS, parseRaisonPerte, pluralize } from "./pipeline-meta";

interface PipelineLessonsProps extends DealCardHandlers {
  /** Deals perdus visibles (après recherche). */
  deals: PipelineDeal[];
  /** Tous les deals perdus du mois sur la vue. */
  allLost: PipelineDeal[];
  nowMs: number;
}

export function PipelineLessons({
  deals,
  allLost,
  nowMs,
  onOpen,
  onMove,
}: PipelineLessonsProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "PERDU" });
  const [open, setOpen] = useState(true);

  const lostValue = allLost.reduce((s, d) => s + d.montant, 0);
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const d of allLost) {
    const { raison } = parseRaisonPerte(d.raisonPerte);
    if (raison) counts.set(raison, (counts.get(raison) ?? 0) + 1);
    else unknown += 1;
  }
  const n = allLost.length;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby="lecons-titre"
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5 shadow-arena transition-shadow",
        isOver && "ring-2 ring-alert-500 ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-alert-50 text-alert-700"
        >
          <Lightbulb className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-[1_1_260px]">
          <h2
            id="lecons-titre"
            className="font-display text-lg font-extrabold tracking-[-0.02em]"
          >
            Leçons du mois{" "}
            <span className="font-sans text-[13px] font-bold text-muted-foreground">
              · étape Perdu · proba 0 %
            </span>
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">
            {n} {pluralize(n, "deal perdu", "deals perdus")} · {formatCHFCompact(lostValue)} à
            reconquérir · glisse un deal ici pour le classer perdu
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LOST_REASONS.map((r) => {
            const c = counts.get(r) ?? 0;
            return (
              <span
                key={r}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                  c ? "bg-alert-50 text-alert-700" : "bg-ground text-muted-foreground",
                )}
              >
                {r} · {c}
              </span>
            );
          })}
          {unknown > 0 && (
            <span className="rounded-full bg-ground px-2.5 py-1 text-xs font-bold text-muted-foreground tabular-nums">
              Sans raison · {unknown}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="lecons-liste"
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-border-strong bg-card px-3.5 text-[13px] font-bold transition-colors hover:bg-navy-50"
        >
          {open ? "Masquer les leçons" : "Voir les leçons"}
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {/* Toujours rendu (hidden quand replié) : aria-controls pointe sur un
          élément existant. */}
      <div id="lecons-liste" hidden={!open}>
        {open && (deals.length > 0 ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
              {deals.map((d) => (
                <DraggableDealCard
                  key={d.id}
                  deal={d}
                  nowMs={nowMs}
                  variant="lost"
                  onOpen={onOpen}
                  onMove={onMove}
                />
              ))}
            </div>
          ) : (
            <p
              className={cn(
                "rounded-[14px] border-2 border-dashed border-border-strong px-4 py-4 text-center text-[13px] font-semibold",
                n === 0 ? "text-win-700" : "text-muted-foreground",
              )}
            >
              {n === 0
                ? "Zéro deal perdu ce mois sur cette vue. Propre."
                : "Aucun deal perdu ne correspond à la recherche."}
            </p>
          ))}
      </div>
    </section>
  );
}
