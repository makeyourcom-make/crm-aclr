"use client";

/**
 * CA signé sur 12 mois (valeur 1re année des contrats signés), barres cliquables :
 * mois en cours en coral, record en or, les autres en navy. Ligne pointillée
 * de l'objectif CA mensuel UNIQUEMENT s'il existe pour le mois.
 */
import { Star } from "lucide-react";
import { useState } from "react";

import { formatCHFCompact } from "@/lib/format";
import type { MonthPoint } from "@/lib/queries/pilotage";
import { cn } from "@/lib/utils";

const CHART_H = 150;

export function CaBars({ points }: { points: MonthPoint[] }) {
  const [idx, setIdx] = useState(Math.max(0, points.length - 1));
  const sel = points[idx];
  if (!sel) return null;

  const total = points.reduce((s, p) => s + p.caSigne, 0);
  const recordIdx = points.reduce((best, p, i) => (p.caSigne > (points[best]?.caSigne ?? 0) ? i : best), 0);
  const record = points[recordIdx];
  const objectifs = points.map((p) => p.objectifCa).filter((v): v is number => v != null);
  const objCourant = points[points.length - 1]?.objectifCa ?? null;
  const max = Math.max(1, ...points.map((p) => p.caSigne), ...objectifs);
  const ecart = sel.objectifCa != null ? sel.caSigne - sel.objectifCa : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-bold text-foreground">
          Total {formatCHFCompact(total)}
        </span>
        <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-bold text-foreground">
          Moyenne {formatCHFCompact(total / Math.max(1, points.length))} / mois
        </span>
        {record && record.caSigne > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-1 text-xs font-bold text-gold-700">
            <Star aria-hidden="true" className="size-3 fill-current" />
            Record : <span className="capitalize">{record.long}</span> {formatCHFCompact(record.caSigne)}
          </span>
        )}
        {objCourant != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-50 px-2.5 py-1 text-xs font-bold text-coral-600">
            <span aria-hidden="true" className="w-3.5 border-t-2 border-dashed border-coral-600" />
            Objectif mensuel {formatCHFCompact(objCourant)}
          </span>
        )}
      </div>

      <div className="relative" style={{ height: CHART_H + 24 }}>
        <div role="group" aria-label="CA signé par mois" className="absolute inset-0 flex items-end gap-1 sm:gap-1.5">
          {points.map((p, i) => {
            const h = p.caSigne > 0 ? Math.max(6, Math.round((p.caSigne / max) * CHART_H)) : 3;
            const objH = p.objectifCa != null ? Math.round((p.objectifCa / max) * CHART_H) : null;
            const color = p.isCurrent ? "bg-coral-400" : i === recordIdx && p.caSigne > 0 ? "bg-gold-500" : "bg-navy-500";
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={i === idx}
                aria-label={`${p.long} : ${formatCHFCompact(p.caSigne)} signés, ${p.nbSignatures} contrat${p.nbSignatures > 1 ? "s" : ""}`}
                onClick={() => setIdx(i)}
                className="group relative flex h-full min-w-0 flex-1 flex-col items-stretch justify-end gap-1.5 rounded-[8px] outline-none focus-visible:ring-3 focus-visible:ring-info-500/50"
              >
                {objH != null && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-coral-600"
                    style={{ bottom: objH + 22 }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block rounded-t-[8px] rounded-b-[4px] transition-[height,opacity] duration-500",
                    color,
                    i === idx ? "outline-3 outline-offset-2 outline-navy-700" : "group-hover:opacity-80",
                  )}
                  style={{ height: h }}
                />
                <span aria-hidden="true" className="block h-4 truncate text-center text-[11px] font-bold text-muted-foreground">
                  <span className="sm:hidden">{p.short.charAt(0).toUpperCase()}</span>
                  <span className="hidden sm:inline">{p.short}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-[14px] border border-border px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold capitalize">{sel.long}</span>
          <span className="flex flex-wrap gap-1.5">
            {idx === recordIdx && sel.caSigne > 0 && (
              <span className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-bold text-gold-700">
                Record des 12 mois
              </span>
            )}
            {sel.isCurrent && (
              <span className="rounded-full bg-coral-50 px-2.5 py-1 text-xs font-bold text-coral-600">
                Mois en cours
              </span>
            )}
          </span>
        </div>
        <span className="score-number text-[28px]">{formatCHFCompact(sel.caSigne)}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">
            {sel.nbSignatures} contrat{sel.nbSignatures > 1 ? "s" : ""} signé{sel.nbSignatures > 1 ? "s" : ""}
          </span>
          {ecart != null && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold",
                ecart >= 0 ? "bg-win-50 text-win-700" : "bg-gold-50 text-gold-700",
              )}
            >
              {ecart >= 0
                ? `+${formatCHFCompact(ecart)} au-dessus de l'objectif mensuel`
                : `Il manque ${formatCHFCompact(-ecart)} pour l'objectif mensuel`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
