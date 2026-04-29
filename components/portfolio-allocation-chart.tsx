"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import type { AllocatorResponse } from "@/app/api/allocator/route";

interface PortfolioAllocationChartProps {
  allocationStrategy: AllocatorResponse["allocation_strategy"];
}

const POSITION_COLORS = [
  "#00ffe7", // cyan
  "#00e676", // neon green
  "#ffb300", // amber
  "#7b61ff", // purple
  "#ff6b6b", // coral
  "#4ecdc4", // teal
];

const CASH_COLOR = "#1a2a35";

interface TooltipPayload {
  name: string;
  value: number;
  payload?: { name: string; value: number; color?: string; rationale?: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-2 font-mono text-xs">
      <div className="text-[var(--foreground)]">{item.name}</div>
      <div className="text-[var(--cyan)]">{item.value}%</div>
    </div>
  );
}

export function PortfolioAllocationChart({ allocationStrategy }: PortfolioAllocationChartProps) {
  const { positions, cash_reserve_pct, total_deployed_pct } = allocationStrategy;

  // Build chart data: positions + cash slice
  const chartData = [
    ...positions.map((pos, i) => ({
      name: pos.asset,
      value: pos.allocation_pct,
      color: POSITION_COLORS[i % POSITION_COLORS.length],
      rationale: pos.rationale,
    })),
    {
      name: "Cash Reserve",
      value: cash_reserve_pct,
      color: CASH_COLOR,
      rationale: "Capital preservation buffer",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Rule badges */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--neon-green)]/30 text-[var(--neon-green)] bg-[var(--neon-green)]/5 font-mono">
          ≤30% PER POSITION ✓
        </span>
        <span
          className={cn(
            "text-[10px] px-2 py-0.5 rounded border font-mono",
            cash_reserve_pct >= 15
              ? "border-[var(--neon-green)]/30 text-[var(--neon-green)] bg-[var(--neon-green)]/5"
              : "border-[var(--neon-red)]/30 text-[var(--neon-red)] bg-[var(--neon-red)]/5"
          )}
        >
          {cash_reserve_pct}% CASH RESERVE {cash_reserve_pct >= 15 ? "✓" : "⚠"}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--cyan)]/30 text-[var(--cyan)] bg-[var(--cyan)]/5 font-mono">
          {total_deployed_pct}% DEPLOYED
        </span>
      </div>

      {/* Donut chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Position table */}
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_auto] text-[10px] text-[var(--muted-foreground)] font-mono px-2 mb-2 uppercase">
          <span>Asset</span>
          <span>Alloc %</span>
        </div>
        {chartData.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--surface-2)] transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <div className="text-xs font-mono text-[var(--foreground)] truncate">{item.name}</div>
              <div className="text-[10px] font-mono text-[var(--muted-foreground)] truncate">
                {"rationale" in item ? item.rationale : ""}
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-[var(--cyan)] shrink-0">
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
