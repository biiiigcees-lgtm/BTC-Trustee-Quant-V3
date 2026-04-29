"use client";

import { useState, useEffect, useMemo } from "react";

interface BankrollState {
  balance: number;
  initialBalance: number;
  pnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface KalshiBankrollPanelProps {
  readonly bankroll: number | null;
  readonly predHistory: ReadonlyArray<{
    readonly outcome: "WIN" | "LOSS" | "PENDING";
  }>;
  readonly onReset?: () => void;
}

const KALSHI_WIN_PAYOUT = 9;
const KALSHI_LOSS_COST = 10;
const INITIAL_BALANCE = 1000;

export function KalshiBankrollPanel({ bankroll, predHistory, onReset }: KalshiBankrollPanelProps) {
  const [stats, setStats] = useState<BankrollState>({
    balance: INITIAL_BALANCE,
    initialBalance: INITIAL_BALANCE,
    pnl: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
  });

  useEffect(() => {
    const settled = predHistory.filter((e) => e.outcome !== "PENDING");
    const wins = settled.filter((e) => e.outcome === "WIN").length;
    const losses = settled.filter((e) => e.outcome === "LOSS").length;
    const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
    const pnl = settled.reduce(
      (acc, e) => acc + (e.outcome === "WIN" ? KALSHI_WIN_PAYOUT : -KALSHI_LOSS_COST),
      0,
    );

    setStats({
      balance: bankroll ?? INITIAL_BALANCE,
      initialBalance: INITIAL_BALANCE,
      pnl,
      totalTrades: settled.length,
      wins,
      losses,
      winRate,
    });
  }, [bankroll, predHistory]);

  const pnlColor = stats.pnl >= 0 ? "#00ff88" : "#ff4466";
  const winRateColor = stats.winRate >= 55 ? "#00ff88" : stats.winRate >= 45 ? "#ffaa00" : "#ff4466";

  const pnlPct = useMemo(() => {
    if (stats.initialBalance === 0) return 0;
    return (stats.pnl / stats.initialBalance) * 100;
  }, [stats.pnl, stats.initialBalance]);

  const pnlDisplay = stats.pnl >= 0
    ? `+$${stats.pnl.toFixed(2)}`
    : `-$${Math.abs(stats.pnl).toFixed(2)}`;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-3 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#ff66cc" }} />
            <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
              BANKROLL
            </span>
          </div>
          {stats.totalTrades > 0 && (
            <span className="text-[7px] font-mono" style={{ color: "#3a3a50" }}>
              {stats.totalTrades} trades
            </span>
          )}
        </div>

        {/* Main Stats */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">Bankroll</span>
            <span className="text-sm font-mono font-bold text-[#e8e8f0]">
              ${stats.balance.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">PnL</span>
            <span className="text-xs font-mono font-bold" style={{ color: pnlColor }}>
              {pnlDisplay} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* PnL Progress Bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(Math.abs(pnlPct), 100)}%`,
              background: pnlColor,
            }}
          />
        </div>

        {/* Trade Stats Grid */}
        <div className="grid grid-cols-4 gap-1">
          <div className="rounded p-1.5 text-center" style={{ background: "var(--surface-2)" }}>
            <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Trades</div>
            <div className="text-[10px] font-mono font-bold text-[#e8e8f0]">{stats.totalTrades}</div>
          </div>
          <div className="rounded p-1.5 text-center" style={{ background: "var(--surface-2)" }}>
            <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Wins</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#00ff88" }}>{stats.wins}</div>
          </div>
          <div className="rounded p-1.5 text-center" style={{ background: "var(--surface-2)" }}>
            <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Losses</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: "#ff4466" }}>{stats.losses}</div>
          </div>
          <div className="rounded p-1.5 text-center" style={{ background: "var(--surface-2)" }}>
            <div className="text-[7px] font-mono text-[#3a3a50] uppercase">Win%</div>
            <div className="text-[10px] font-mono font-bold" style={{ color: winRateColor }}>
              {stats.winRate.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Reset Button */}
        {onReset && (
          <button
            onClick={onReset}
            className="text-[8px] font-mono text-[#3a3a50] hover:text-[#ff4466] transition-colors uppercase tracking-wider text-center"
          >
            Reset Bankroll
          </button>
        )}
      </div>
    </div>
  );
}
