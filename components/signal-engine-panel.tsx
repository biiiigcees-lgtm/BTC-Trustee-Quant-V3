"use client";

import { useState, useEffect } from "react";

interface Signal {
  readonly id: string;
  readonly timestamp: number;
  readonly verdict: "ABOVE" | "BELOW" | "AWAITING";
  readonly confidence: number;
  readonly strike: number;
  readonly price: number;
  readonly expiryLabel: string;
  readonly status: "ACTIVE" | "EXPIRED" | "WIN" | "LOSS";
}

interface SignalEnginePanelProps {
  readonly signals: readonly Signal[];
  readonly onClear?: () => void;
}

const VERDICT_STYLES = {
  ABOVE: { color: "#00ff88", bg: "rgba(0, 255, 136, 0.1)", border: "rgba(0, 255, 136, 0.3)", icon: "▲" },
  BELOW: { color: "#ff4466", bg: "rgba(255, 68, 102, 0.1)", border: "rgba(255, 68, 102, 0.3)", icon: "▼" },
  AWAITING: { color: "#ffaa00", bg: "rgba(255, 170, 0, 0.1)", border: "rgba(255, 170, 0, 0.3)", icon: "○" },
} as const;

const STATUS_STYLES = {
  WIN: { color: "#00ff88", icon: "✓" },
  LOSS: { color: "#ff4466", icon: "✗" },
  OTHER: { color: "#8888aa", icon: "○" },
} as const;

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getStatusStyle(status: Signal["status"]) {
  if (status === "WIN") return STATUS_STYLES.WIN;
  if (status === "LOSS") return STATUS_STYLES.LOSS;
  return STATUS_STYLES.OTHER;
}

export function SignalEnginePanel({ signals, onClear }: SignalEnginePanelProps) {
  const [now, setNow] = useState(Date.now());

  // Refresh time display every 30s so "Xm ago" stays current
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const activeSignals = signals.filter((s) => s.status === "ACTIVE");
  const history = signals.filter((s) => s.status !== "ACTIVE").slice(-10).reverse();

  // Use `now` to prevent tree-shaking the interval (ensures re-render)
  const _tick = now;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-3 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#4488ff" }} />
            <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
              SIGNALS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[7px] font-mono" style={{ color: "#3a3a50" }}>
              {signals.length === 1 ? "1 signal" : `${signals.length} signals`}
            </span>
            {onClear && signals.length > 0 && (
              <button
                onClick={onClear}
                className="text-[7px] font-mono text-[#3a3a50] hover:text-[#ff4466] transition-colors"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Active Signals */}
        {activeSignals.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeSignals.map((signal) => {
              const style = VERDICT_STYLES[signal.verdict];
              return (
                <div
                  key={signal.id}
                  className="rounded p-2 flex items-center justify-between"
                  style={{
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: style.color }}
                    >
                      {style.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#e8e8f0]">
                        ${signal.strike.toLocaleString()}
                      </span>
                      <span className="text-[7px] font-mono text-[#3a3a50]">{signal.expiryLabel}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono font-bold" style={{ color: "#4488ff" }}>
                      {signal.confidence}%
                    </span>
                    <span className="text-[7px] font-mono text-[#3a3a50]">
                      {formatTimeAgo(signal.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col h-[80px] items-center justify-center gap-2">
            <div className="text-[10px] font-mono text-[#2a2a3a] uppercase tracking-[0.3em]">
              Awaiting Signal
            </div>
            <div className="w-2 h-2 rounded-full bg-[#1a1a2a] animate-pulse" />
          </div>
        )}

        {/* Signal History */}
        {history.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">Recent History</div>
            {history.map((signal) => {
              const statusStyle = getStatusStyle(signal.status);
              return (
                <div
                  key={signal.id}
                  className="rounded p-1.5 flex items-center justify-between"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[8px] font-mono"
                      style={{ color: statusStyle.color }}
                    >
                      {statusStyle.icon}
                    </span>
                    <span className="text-[8px] font-mono text-[#8888aa]">
                      ${signal.strike.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[7px] font-mono text-[#3a3a50]">
                    {formatTimeAgo(signal.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
