"use client";

import { BacktestResult } from "@/lib/types";

interface BacktestStatsPanelProps {
  readonly result: BacktestResult | null;
}

export function BacktestStatsPanel({ result }: BacktestStatsPanelProps) {
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  if (!result) {
    return (
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1 h-1 rounded-full" style={{ background: "#00ff88" }} />
            <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
              BACKTEST STATS
            </span>
          </div>
          <div className="text-center py-4">
            <span className="text-[8px] font-mono text-[#5a5a70]">Run backtest to see results</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-1 h-1 rounded-full" style={{ background: "#00ff88" }} />
          <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
            BACKTEST STATS
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Total Return */}
          <div className="p-2 rounded" style={{ background: result.totalReturn >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Total Return</div>
            <div
              className="text-[10px] font-mono font-bold"
              style={{ color: result.totalReturn >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {formatPercent(result.totalReturn)}
            </div>
          </div>

          {/* Win Rate */}
          <div className="p-2 rounded" style={{ background: "rgba(255, 170, 0, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Win Rate</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#ffaa00" }}>
              {formatPercent(result.winRate)}
            </div>
          </div>

          {/* Total Trades */}
          <div className="p-2 rounded" style={{ background: "rgba(68, 136, 255, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Total Trades</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#4488ff" }}>
              {result.totalTrades}
            </div>
          </div>

          {/* Profit Factor */}
          <div className="p-2 rounded" style={{ background: "rgba(255, 102, 204, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Profit Factor</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#ff66cc" }}>
              {result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}
            </div>
          </div>

          {/* Net Profit */}
          <div className="p-2 rounded" style={{ background: result.netProfit >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Net Profit</div>
            <div
              className="text-[10px] font-mono font-bold"
              style={{ color: result.netProfit >= 0 ? "#22c55e" : "#ef4444" }}
            >
              {formatCurrency(result.netProfit)}
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="p-2 rounded" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Max Drawdown</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#ef4444" }}>
              {formatPercent(result.maxDrawdown * 100)}
            </div>
          </div>

          {/* Average Win */}
          <div className="p-2 rounded" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Avg Win</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#22c55e" }}>
              {formatCurrency(result.averageWin)}
            </div>
          </div>

          {/* Average Loss */}
          <div className="p-2 rounded" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
            <div className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider mb-1">Avg Loss</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#ef4444" }}>
              {formatCurrency(result.averageLoss)}
            </div>
          </div>
        </div>

        {/* Final Capital */}
        <div className="mt-2 p-2 rounded" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
          <div className="flex justify-between items-center">
            <span className="text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider">Final Capital</span>
            <span className="text-[10px] font-mono font-bold text-[#e8e8f0]">
              {formatCurrency(result.finalCapital)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
