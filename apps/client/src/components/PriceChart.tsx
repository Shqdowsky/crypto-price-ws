import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { PricePoint } from "../context/socket/socketReducer";

interface PriceChartProps {
  data: PricePoint[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
}

export function PriceChart({ data }: PriceChartProps) {
  if (data.length === 0) {
    return <p>Waiting for price data...</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} minTickGap={40} />
            <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `$${v.toFixed(2)}`} />
            <Tooltip
                labelFormatter={(ts) => formatTime(Number(ts))}
                formatter={(value) => {
                    const num = typeof value === "number" ? value : Number(value);
                    return [`$${num.toFixed(2)}`, "Price"];
                }}
            />
            <Line
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                dot={false}
                isAnimationActive={false}
            />
        </LineChart>
    </ResponsiveContainer>
  );
}