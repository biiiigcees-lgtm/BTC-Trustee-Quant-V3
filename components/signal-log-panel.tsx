"use client";

import { TradingSignal } from "@/lib/types";

interface SignalLogPanelProps {
  readonly signals: TradingSignal[];
  readonly onClear?: () => void;
}

export function SignalLogPanel({ signals, onClear }: SignalLogPanelProps) {
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatPrice = (price: number): string => {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStrengthStars = (strength: number): string => {
    return "★".repeat(strength) + "☆".repeat(3 - strength);
  };

  const recentSignals = signals.slice(-20).reverse();

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#ff66cc" }} />
            <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
              SIGNAL LOG
            </span>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[7px] font-mono text-[#ff4466] hover:text-[#ff6688] transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Signal Table */}
        {recentSignals.length === 0 ? (
          <div className="text-center py-4">
            <span className="text-[8px] font-mono text-[#5a5a70]">No signals yet</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-2 px-2 py-1 text-[7px] font-mono text-[#5a5a70] uppercase tracking-wider">
              <div>Time</div>
              <div>Direction</div>
              <div>Str</div>
              <div>Price</div>
            </div>

            {/* Signal Rows */}
            {recentSignals.map((signal) => (
              <div
                key={signal.id}
                className="grid grid-cols-4 gap-2 px-2 py-1.5 rounded"
                style={{
                  background: signal.direction === "BUY" ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
                }}
              >
                <div className="text-[8px] font-mono text-[#e8e8f0]">
                  {formatTimeAgo(signal.timestamp)}
                </div>
                <div
                  className="text-[8px] font-mono font-bold"
                  style={{
                    color: signal.direction === "BUY" ? "#22c55e" : "#ef4444",
                  }}
                >
                  {signal.direction}
                </div>
                <div className="text-[8px] font-mono" style={{ color: "#ffaa00" }}>
                  {getStrengthStars(signal.strength)}
                </div>
                <div className="text-[8px] font-mono text-[#e8e8f0]">
                  {formatPrice(signal.price)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
