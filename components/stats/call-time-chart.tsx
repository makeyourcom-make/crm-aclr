"use client";

/**
 * Temps au téléphone par jour (recharts), aux couleurs MYC Arena :
 * aire coral, grille #E5E8F0, axes #5B6478, infobulle navy.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDuration } from "@/lib/format";

interface CallTimeChartProps {
  data: Array<{ label: string; secondes: number; nbAppels: number }>;
}

export function CallTimeChart({ data }: CallTimeChartProps) {
  const total = data.reduce((s, d) => s + d.secondes, 0);
  return (
    <div
      className="h-56 w-full"
      role="img"
      aria-label={`Temps au téléphone par jour sur ${data.length} jours, total ${formatDuration(total)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="callTimeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F47174" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#F47174" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E5E8F0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#5B6478" }}
            stroke="#D5DAE6"
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#5B6478" }}
            stroke="#D5DAE6"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatDuration(Number(v))}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "#0E1936", strokeDasharray: "3 4" }}
            formatter={(value, _name, item) => {
              const secondes = Number(value);
              const nbAppels = item.payload?.nbAppels ?? 0;
              return [
                `${formatDuration(secondes)} · ${nbAppels} appel${nbAppels > 1 ? "s" : ""}`,
                "Temps téléphone",
              ];
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 12,
              border: "none",
              background: "#0E1936",
              color: "#FFFFFF",
              boxShadow: "0 12px 32px rgba(14,25,54,0.14)",
            }}
            itemStyle={{ color: "#FFFFFF" }}
            labelStyle={{ color: "#D1D6E3", fontWeight: 700 }}
          />
          <Area
            type="monotone"
            dataKey="secondes"
            stroke="#E95256"
            strokeWidth={2.5}
            fill="url(#callTimeGrad)"
            activeDot={{ r: 5, fill: "#F47174", stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
