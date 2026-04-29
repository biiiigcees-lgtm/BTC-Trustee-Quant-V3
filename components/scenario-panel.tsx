"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import type { AllocatorResponse } from "@/app/api/allocator/route";

interface ScenarioPanelProps {
  scenarios: AllocatorResponse["scenarios"];
  capital: number;
}

function dollarGain(capital: number, pct: number) {
  const gain = (capital * pct) / 100;
  const sign = gain >= 0 ? "+" : "";
  return `${sign}$${Math.abs(gain).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

interface TooltipPayload {
  name: string;
  value: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const color = value >= 0 ? "var(--neon-green)" : "var(--neon-red)";
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-2 font-mono text-xs">
      <div className="text-[var(--muted-foreground)] mb-1">{label}</div>
      <div style={{ color }}>{value >= 0 ? "+" : ""}{value}%</div>
    </div>
  );
}

export function ScenarioPanel({ scenarios, capital }: ScenarioPanelProps) {
  const { best_case, base_case, worst_case } = scenarios;

  // Probability-weighted expected return
  const weightedReturn =
    (best_case.return_pct * best_case.probability +
      base_case.return_pct * base_case.probability +
      worst_case.return_pct * worst_case.probability) /
    100;

  const chartData = [
    { name: "BEST", value: best_case.return_pct, prob: best_case.probability },
    { name: "BASE", value: base_case.return_pct, prob: base_case.probability },
    { name: "WORST", value: worst_case.return_pct, prob: worst_case.probability },
  ];

  const scenarioCards = [
    {
      label: "BEST CASE",
      data: best_case,
      color: "var(--neon-green)",
      border: "border-[var(--neon-green)]/30",
      bg: "bg-[var(--neon-green)]/5",
      textColor: "text-[var(--neon-green)]",
    },
    {
      label: "BASE CASE",
      data: base_case,
      color: "var(--cyan)",
      border: "border-[var(--cyan)]/30",
      bg: "bg-[var(--cyan)]/5",
      textColor: "text-[var(--cyan)]",
    },
    {
      label: "WORST CASE",
      data: worst_case,
      color: "var(--neon-red)",
      border: "border-[var(--neon-red)]/30",
      bg: "bg-[var(--neon-red)]/5",
      textColor: "text-[var(--neon-red)]",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Weighted EV callout */}
      <div className="flex items-center justify-between p-3 rounded border border-[var(--border)] bg-[var(--surface-2)]">
        <div>
          <div className="text-[10px] text-[var(--muted-foreground)] font-mono mb-0.5">
            PROBABILITY-WEIGHTED EXPECTED RETURN
          </div>
          <div
            className={cn(
              "text-lg font-semibold font-mono",
              weightedReturn >= 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]"
            )}
          >
            {weightedReturn >= 0 ? "+" : ""}{weightedReturn.toFixed(1)}%
            <span className="text-xs text-[var(--muted-foreground)] ml-2">
              ({dollarGain(capital, weightedReturn)})
            </span>
          </div>
        </div>
        <div className="text-right text-[10px] text-[var(--muted-foreground)] font-mono">
          <div>Capital: ${capital.toLocaleString()}</div>
          <div className="text-[var(--amber)]">Probability weighted</div>
        </div>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {scenarioCards.map(({ label, data, color, border, bg, textColor }) => (
          <div key={label} className={cn("rounded border p-3", border, bg)}>
            <div className="text-[10px] font-mono text-[var(--muted-foreground)] mb-1">{label}</div>
            <div className={cn("text-xl font-semibold font-mono", textColor)}>
              {data.return_pct >= 0 ? "+" : ""}
              {data.return_pct}%
            </div>
            <div className="text-[10px] font-mono text-[var(--muted-foreground)] mb-2">
              {dollarGain(capital, data.return_pct)}
            </div>
            <div className="text-[10px] font-mono text-[var(--foreground)] leading-relaxed mb-2">
              {data.description}
            </div>
            {/* Probability bar */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-[var(--muted-foreground)] mb-1">
                <span>PROBABILITY</span>
                <span className={textColor}>{data.probability}%</span>
              </div>
              <div className="h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${data.probability}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div>
        <div className="text-[10px] text-[var(--muted-foreground)] font-mono mb-2">RETURN COMPARISON</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-ibm)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-ibm)" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.value >= 15
                        ? "var(--neon-green)"
                        : entry.value >= 0
                        ? "var(--cyan)"
                        : "var(--neon-red)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[var(--muted-foreground)] font-mono leading-relaxed border-t border-[var(--border)] pt-3">
        ⚠ Scenarios are probability estimates, not guarantees. Past performance does not predict future results.
        Capital preservation is prioritized above return generation. All investments carry risk of loss.
      </p>
    </div>
  );
}
