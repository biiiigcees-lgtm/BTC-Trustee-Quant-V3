"use client";

import { useState, useMemo, useCallback } from "react";

interface PredictionResult {
  readonly verdict: "ABOVE" | "BELOW" | "PASS";
  readonly confidence: number;
  readonly ev: number;
  readonly kelly: number;
}

interface KalshiMarketPanelProps {
  readonly target: string;
  readonly price: number | null;
  readonly predictionResult: PredictionResult | null;
  readonly bankroll: number | null;
  readonly onTargetChange?: (target: string) => void;
}

const FRACTIONAL_KELLY = 0.25;

function getEdgeColor(edge: number): string {
  if (edge > 0) return "#00ff88";
  if (edge < 0) return "#ff4466";
  return "#555570";
}

function getEvColor(ev: number): string {
  return ev >= 0 ? "#00ff88" : "#ff4466";
}

export function KalshiMarketPanel({
  target,
  price,
  predictionResult,
  bankroll,
  onTargetChange,
}: KalshiMarketPanelProps) {
  const [kalshiProb, setKalshiProb] = useState(50);

  const handleTargetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTargetChange?.(e.target.value);
  }, [onTargetChange]);

  const impliedEdge = useMemo(() => {
    if (!predictionResult || predictionResult.verdict === "PASS") return 0;
    const modelProb = predictionResult.confidence / 100;
    const marketProb = kalshiProb / 100;
    return predictionResult.verdict === "ABOVE"
      ? (modelProb - marketProb) * 100
      : (marketProb - modelProb) * 100;
  }, [predictionResult, kalshiProb]);

  const kellyFraction = useMemo(() => {
    if (!predictionResult || predictionResult.verdict === "PASS" || !bankroll) return 0;
    return predictionResult.kelly * FRACTIONAL_KELLY;
  }, [predictionResult, bankroll]);

  const recommendedSize = useMemo(() => {
    if (!bankroll || kellyFraction <= 0) return 0;
    return (kellyFraction / 100) * bankroll;
  }, [bankroll, kellyFraction]);

  const ev = predictionResult?.ev ?? 0;

  const handleProbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setKalshiProb(Number.parseInt(e.target.value, 10));
  }, []);

  const edgeColor = getEdgeColor(impliedEdge);
  const evColor = getEvColor(ev);
  const edgeDisplay = impliedEdge > 0 ? `+${impliedEdge.toFixed(1)}%` : `${impliedEdge.toFixed(1)}%`;
  const evDisplay = ev >= 0 ? `+${ev.toFixed(1)}¢` : `${ev.toFixed(1)}¢`;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-3 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#ffaa00" }} />
            <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
              KALSHI MARKET
            </span>
          </div>
          {price !== null && (
            <span className="text-[8px] font-mono" style={{ color: "#3a3a50" }}>
              BTC ${price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Target Price Input */}
        <div className="rounded p-2" style={{ background: "var(--surface-2)" }}>
          <label htmlFor="kalshi-target" className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1 block">
            Kalshi Target Price (15min)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#8888aa]">$</span>
            <input
              id="kalshi-target"
              type="number"
              min={0}
              step={100}
              value={target}
              onChange={handleTargetChange}
              placeholder="Enter Kalshi target"
              aria-label="Kalshi target price for 15 minute round"
              title="Enter the target price from Kalshi's 15min round"
              className="flex-1 rounded px-2 py-1 text-sm font-mono font-bold text-[#ffaa00] bg-transparent border"
              style={{ borderColor: "#2a2a3a" }}
            />
          </div>
          <div className="text-[7px] font-mono text-[#3a3a50] mt-1">
            Input Kalshi&apos;s 15min round target price
          </div>
        </div>

        {/* Probability Slider */}
        <div>
          <label className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-2 block">
            Kalshi Market Probability
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={99}
              value={kalshiProb}
              onChange={handleProbChange}
              aria-label="Kalshi market probability"
              title="Kalshi market probability"
              className="flex-1 h-1 appearance-none rounded-full accent-[#4488ff]"
              style={{ background: "#1a1a2a" }}
            />
            <span className="text-lg font-mono font-bold text-[#4488ff] w-12 text-right">
              {kalshiProb}¢
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] font-mono text-[#00ff88]">YES {kalshiProb}¢</span>
            <span className="text-[8px] font-mono text-[#ff4466]">NO {100 - kalshiProb}¢</span>
          </div>
        </div>

        {/* Implied Edge */}
        <div className="rounded p-2" style={{ background: "var(--surface-2)" }}>
          <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Implied Edge</div>
          <div className="flex items-center gap-2">
            <span
              className="text-lg font-mono font-bold"
              style={{ color: edgeColor }}
            >
              {edgeDisplay}
            </span>
            <span className="text-[8px] font-mono text-[#3a3a50]">vs market</span>
          </div>
        </div>

        {/* Position Sizing */}
        <div className="rounded p-2" style={{ background: "var(--surface-2)" }}>
          <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Position Sizing</div>

          {/* Bankroll Display */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[7px] font-mono text-[#3a3a50]">Bankroll</span>
            <span className="text-[10px] font-mono text-[#e8e8f0]">
              ${(bankroll ?? 1000).toFixed(2)}
            </span>
          </div>

          {/* Kelly Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[7px] font-mono text-[#3a3a50]">Kelly</div>
              <div className="text-[10px] font-mono text-[#8888aa]">
                {predictionResult?.kelly?.toFixed(1) ?? "0.0"}%
              </div>
            </div>
            <div>
              <div className="text-[7px] font-mono text-[#3a3a50]">Frac. Kelly</div>
              <div className="text-[10px] font-mono text-[#8888aa]">
                {kellyFraction.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[7px] font-mono text-[#3a3a50]">Recommended</div>
              <div className="text-[10px] font-mono text-[#4488ff]">
                ${recommendedSize.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[7px] font-mono text-[#3a3a50]">EV</div>
              <div
                className="text-[10px] font-mono"
                style={{ color: evColor }}
              >
                {evDisplay}
              </div>
            </div>
          </div>
        </div>

        {/* Liquidity Note */}
        <div className="rounded p-2" style={{ background: "var(--surface-2)" }}>
          <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-1">Liquidity</div>
          <div className="text-[9px] font-mono text-[#3a3a50]">
            Connect Kalshi WebSocket for real-time order book depth
          </div>
        </div>
      </div>
    </div>
  );
}
