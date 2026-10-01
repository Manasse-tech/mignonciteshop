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
import { GOLD } from "@/lib/types";

export interface PriceHistoryPoint {
  label: string;
  price: number;
}

interface PriceHistoryChartProps {
  data: PriceHistoryPoint[];
}

/** Graphique d'historique des prix — chargé en différé (next/dynamic). */
export default function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="priceHistoryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(201,169,97,0.3)" />
            <stop offset="100%" stopColor="rgba(201,169,97,0)" />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={["auto", "auto"]}
          width={52}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${Math.round(Number(value)).toLocaleString("fr-FR")} F`}
        />
        <Tooltip
          formatter={(value) => [`${Math.round(Number(value)).toLocaleString("fr-FR")} F CFA`, "Prix"]}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "var(--popover-foreground)",
          }}
          labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={GOLD}
          strokeWidth={2.5}
          fill="url(#priceHistoryGradient)"
          dot={false}
          activeDot={{ r: 4, fill: GOLD }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
