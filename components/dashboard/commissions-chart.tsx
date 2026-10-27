"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCHFCompact } from "@/lib/format";

interface CommissionsChartProps {
  data: Array<{ label: string; montant: number }>;
  /** Libellé affiché dans le tooltip (ex: "CA signé", "Commissions"). */
  tooltipLabel?: string;
}

/**
 * Courbe MYC Arena : trait navy, remplissage coral léger (charte : graphiques
 * navy / coral), grille #E5E8F0, axes en texte secondaire #5B6478.
 */
export function CommissionsChart({
  data,
  tooltipLabel = "CA signé",
}: CommissionsChartProps) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F47174" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#F47174" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E5E8F0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#5B6478", fontWeight: 600 }}
            stroke="#D5DAE6"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#5B6478", fontWeight: 600 }}
            stroke="#D5DAE6"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCHFCompact(v).replace("CHF ", "")}
            width={60}
          />
          <Tooltip
            formatter={(value) => [formatCHFCompact(Number(value)), tooltipLabel]}
            cursor={{ stroke: "#D5DAE6", strokeWidth: 1 }}
            contentStyle={{
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 12,
              border: "1px solid #E5E8F0",
              boxShadow: "0 8px 24px rgba(14,25,54,0.10)",
              color: "#0E1936",
            }}
          />
          <Area
            type="monotone"
            dataKey="montant"
            stroke="#0E1936"
            strokeWidth={2.5}
            fill="url(#commGrad)"
            activeDot={{ r: 5, fill: "#E95256", stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
