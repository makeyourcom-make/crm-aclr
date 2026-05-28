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
}

export function CommissionsChart({ data }: CommissionsChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1F4E78" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#1F4E78" stopOpacity={0} />
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
            tickFormatter={(v) => formatCHFCompact(v).replace("CHF ", "")}
            width={56}
          />
          <Tooltip
            formatter={(value) => [formatCHFCompact(Number(value)), "Acquise"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
            }}
          />
          <Area
            type="monotone"
            dataKey="montant"
            stroke="#1F4E78"
            strokeWidth={2}
            fill="url(#commGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
