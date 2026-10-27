"use client";

/**
 * MRR vs charges sur 12 mois (recharts, couleurs du CRM).
 *  - aire navy : MRR en fin de mois (reconstitué pour les mois passés) ;
 *  - ligne rouge pointillée : total des charges saisies dans le mois ;
 *  - sélecteur de mois (boutons) + tuiles de détail du mois choisi.
 */
import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatInt } from "@/components/arena/format";
import { formatCHFCompact } from "@/lib/format";
import type { MonthPoint } from "@/lib/queries/pilotage";
import { cn } from "@/lib/utils";

import { MiniStat } from "./ui";

export function MrrChart({ points }: { points: MonthPoint[] }) {
  const [idx, setIdx] = useState(Math.max(0, points.length - 1));
  const sel = points[idx];
  if (!sel) return null;
  const prev = idx > 0 ? points[idx - 1] : null;
  const marge = sel.mrr - sel.charges;
  const evol = prev ? sel.mrr - prev.mrr : null;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3.5 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[3px] w-[18px] rounded-sm bg-navy-700" />
          MRR (fin de mois)
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-[18px] border-t-[3px] border-dashed border-alert-500" />
          Charges du mois
        </span>
      </div>

      <div
        className="h-56 w-full sm:h-64"
        role="img"
        aria-label={`MRR de ${formatCHFCompact(first.mrr)} en ${first.long} à ${formatCHFCompact(last.mrr)} en ${last.long} ; charges du mois de ${formatCHFCompact(first.charges)} à ${formatCHFCompact(last.charges)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2F4470" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#2F4470" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E5E8F0" vertical={false} />
            <XAxis
              dataKey="short"
              tick={{ fontSize: 11, fill: "#5B6478" }}
              stroke="#D5DAE6"
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5B6478" }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v) => formatInt(Number(v))}
            />
            <Tooltip
              cursor={{ stroke: "#0E1936", strokeDasharray: "3 4" }}
              labelFormatter={(_label, payload) => {
                const p = payload?.[0]?.payload as MonthPoint | undefined;
                return p ? p.long : String(_label);
              }}
              formatter={(value, name) => [
                formatCHFCompact(Number(value)),
                name === "mrr" ? "MRR" : "Charges du mois",
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 12,
                border: "none",
                background: "#0E1936",
                color: "#FFFFFF",
                boxShadow: "0 12px 32px rgba(14,25,54,0.14)",
              }}
              itemStyle={{ color: "#FFFFFF" }}
              labelStyle={{ color: "#D1D6E3", fontWeight: 700, textTransform: "capitalize" }}
            />
            <ReferenceLine x={sel.short} stroke="#0E1936" strokeWidth={1.5} strokeDasharray="3 4" />
            <Area
              type="monotone"
              dataKey="mrr"
              stroke="#0E1936"
              strokeWidth={3}
              fill="url(#mrrGrad)"
              activeDot={{ r: 6, fill: "#F47174", stroke: "#FFFFFF", strokeWidth: 3 }}
            />
            <Line
              type="monotone"
              dataKey="charges"
              stroke="#E5484D"
              strokeWidth={2.5}
              strokeDasharray="6 5"
              dot={false}
              activeDot={{ r: 5, fill: "#FFFFFF", stroke: "#E5484D", strokeWidth: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div role="group" aria-label="Choisir un mois" className="grid grid-cols-6 gap-1 sm:grid-cols-12">
        {points.map((p, i) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={i === idx}
            aria-label={p.long}
            onClick={() => setIdx(i)}
            className={cn(
              "h-8 min-w-0 overflow-hidden rounded-[8px] px-0.5 text-xs font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-info-500/50",
              i === idx ? "bg-navy-700 text-white" : "text-muted-foreground hover:bg-navy-50 hover:text-foreground",
            )}
          >
            {p.short}
          </button>
        ))}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <MiniStat label="Mois" value={<span className="capitalize">{sel.long}</span>} />
        <MiniStat label="MRR" value={formatCHFCompact(sel.mrr)} />
        <MiniStat
          label={sel.isCurrent ? "Charges du mois (en cours)" : "Charges du mois"}
          value={formatCHFCompact(sel.charges)}
          tone="red"
        />
        <MiniStat
          label="MRR - charges"
          value={`${formatCHFCompact(marge)}${sel.mrr > 0 ? ` · ${Math.round((marge / sel.mrr) * 100)} %` : ""}`}
          tone={marge >= 0 ? "green" : "red"}
        />
      </div>
      <p className="text-xs font-semibold text-muted-foreground">
        {evol === null
          ? "Point de départ de la période."
          : `${evol >= 0 ? "+" : "-"}${formatCHFCompact(Math.abs(evol))} de MRR vs le mois précédent.`}{" "}
        MRR des mois passés reconstitué d&apos;après les dates de signature et de fin des contrats ;
        charges = toutes les charges saisies du mois (TTC).
        {sel.isCurrent && " Mois en cours : les charges ne sont pas encore toutes saisies."}
      </p>
    </div>
  );
}
