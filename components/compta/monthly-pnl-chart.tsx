"use client";

/**
 * Graphique mensuel P&L : barres CA + lignes marges.
 *
 * Mois passés en plein, mois futurs en pointillé (séparation visuelle).
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCHFCompact } from "@/lib/format";

interface MonthlyPnLChartProps {
  data: Array<{
    label: string;
    caFacture: number;
    caEncaisse: number;
    charges: number;
    salaires: number;
    margeReelle: number;
    margeProjetee: number;
    phase: "past" | "current" | "future";
  }>;
}

const COLORS = {
  caEncaisse: "#10b981", // emerald-500
  caFacture: "#0E1936", // navy
  margeReelle: "#0E1936",
  margeProjetee: "#F47174", // coral
};

export function MonthlyPnLChart({ data }: MonthlyPnLChartProps) {
  // Index du dernier mois passé pour la ligne de référence
  const firstFutureIdx = data.findIndex((d) => d.phase === "future");

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
            tickFormatter={(v) =>
              formatCHFCompact(Number(v)).replace("CHF ", "")
            }
            width={64}
          />
          <Tooltip
            formatter={(value, name) => {
              const label =
                name === "caEncaisse"
                  ? "CA encaissé"
                  : name === "caFacture"
                    ? "CA facturé"
                    : name === "margeReelle"
                      ? "Marge réelle"
                      : "Marge projetée";
              return [formatCHFCompact(Number(value)), label];
            }}
            labelFormatter={(label, payload) => {
              const phase = payload[0]?.payload?.phase;
              const suffix =
                phase === "current"
                  ? " (mois en cours)"
                  : phase === "future"
                    ? " (projeté)"
                    : "";
              return `${label}${suffix}`;
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
          />

          {/* Ligne verticale entre passé et futur */}
          {firstFutureIdx > 0 && (
            <ReferenceLine
              x={data[firstFutureIdx - 1]?.label}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: "Aujourd'hui",
                position: "top",
                fill: "#64748b",
                fontSize: 10,
              }}
            />
          )}

          <Bar
            dataKey="caEncaisse"
            fill={COLORS.caEncaisse}
            name="caEncaisse"
            radius={[3, 3, 0, 0]}
            fillOpacity={0.85}
          />
          <Bar
            dataKey="caFacture"
            fill={COLORS.caFacture}
            name="caFacture"
            radius={[3, 3, 0, 0]}
            fillOpacity={0.25}
          />
          <Line
            type="monotone"
            dataKey="margeReelle"
            stroke={COLORS.margeReelle}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name="margeReelle"
          />
          <Line
            type="monotone"
            dataKey="margeProjetee"
            stroke={COLORS.margeProjetee}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 2 }}
            name="margeProjetee"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
