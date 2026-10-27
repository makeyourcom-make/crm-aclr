"use client";

/**
 * Graphique mensuel P&L : barres CA + lignes marges (couleurs MYC Arena).
 *
 * CA encaissé = vert succès · CA facturé = navy clair · marge réelle = trait
 * navy plein · marge projetée = pointillé coral. Une ligne verticale
 * « Aujourd'hui » sépare le passé de la projection.
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
  caEncaisse: "#12A150", // win-500
  caFacture: "#0E1936", // navy-700
  margeReelle: "#0E1936",
  margeProjetee: "#E95256", // coral-500
  grid: "#E5E8F0",
  axis: "#D5DAE6",
  tick: "#5B6478",
};

export function MonthlyPnLChart({ data }: MonthlyPnLChartProps) {
  // Index du premier mois futur pour la ligne de référence
  const firstFutureIdx = data.findIndex((d) => d.phase === "future");

  return (
    <div
      className="h-72 w-full sm:h-80"
      role="img"
      aria-label="Graphique du P&L mensuel : CA encaissé et facturé en barres, marges réelle et projetée en lignes. Le détail chiffré figure dans le tableau ci-dessous."
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 8, left: -4, bottom: 0 }}
        >
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: COLORS.tick, fontWeight: 600 }}
            stroke={COLORS.axis}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLORS.tick, fontWeight: 600 }}
            stroke={COLORS.axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              formatCHFCompact(Number(v)).replace("CHF ", "").replace("CHF", "")
            }
            width={60}
          />
          <Tooltip
            cursor={{ fill: "#EEF0F6" }}
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
              fontWeight: 600,
              borderRadius: 12,
              border: "1px solid #E5E8F0",
              boxShadow: "0 12px 32px rgba(14,25,54,0.14)",
              color: "#0E1936",
            }}
            labelStyle={{ fontWeight: 800, color: "#0E1936", marginBottom: 4 }}
          />

          {/* Ligne verticale entre passé et futur */}
          {firstFutureIdx > 0 && (
            <ReferenceLine
              x={data[firstFutureIdx - 1]?.label}
              stroke="#8A93A6"
              strokeDasharray="4 4"
              label={{
                value: "Aujourd'hui",
                position: "top",
                fill: COLORS.tick,
                fontSize: 11,
                fontWeight: 700,
              }}
            />
          )}

          <Bar
            dataKey="caEncaisse"
            fill={COLORS.caEncaisse}
            name="caEncaisse"
            radius={[6, 6, 0, 0]}
            fillOpacity={0.9}
            maxBarSize={28}
          />
          <Bar
            dataKey="caFacture"
            fill={COLORS.caFacture}
            name="caFacture"
            radius={[6, 6, 0, 0]}
            fillOpacity={0.18}
            maxBarSize={28}
          />
          <Line
            type="monotone"
            dataKey="margeReelle"
            stroke={COLORS.margeReelle}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COLORS.margeReelle }}
            activeDot={{ r: 5 }}
            name="margeReelle"
          />
          <Line
            type="monotone"
            dataKey="margeProjetee"
            stroke={COLORS.margeProjetee}
            strokeWidth={2.25}
            strokeDasharray="6 5"
            dot={{ r: 2.5, fill: COLORS.margeProjetee }}
            activeDot={{ r: 5 }}
            name="margeProjetee"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
