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

import { formatDuration } from "@/lib/format";

interface CallTimeChartProps {
  data: Array<{ label: string; secondes: number; nbAppels: number }>;
}

export function CallTimeChart({ data }: CallTimeChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="callTimeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F47174" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#F47174" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
            tickFormatter={(v) => formatDuration(Number(v))}
            width={64}
          />
          <Tooltip
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
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
          />
          <Area
            type="monotone"
            dataKey="secondes"
            stroke="#F47174"
            strokeWidth={2}
            fill="url(#callTimeGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
