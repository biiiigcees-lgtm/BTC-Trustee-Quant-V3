"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Sparkline } from "@/components/sparkline";
import { RsiGauge } from "@/components/rsi-gauge";
import { BTCTrajectoryAnalyzer, type TrajectoryResult } from "@/lib/btc-trajectory-analysis";
import { KalshiBankrollPanel } from "@/components/bankroll-panel";
import { KalshiMarketPanel } from "@/components/kalshi-market-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { SignalEnginePanel } from "@/components/signal-engine-panel";
import { MarketRegimeBadge } from "@/components/market-regime-badge";
import { DashboardTabs, type TabId } from "@/components/dashboard-tabs";
import { PriceHero } from "@/components/price-hero";
import { CountdownRing } from "@/components/countdown-ring";
import { VerdictHero } from "@/components/verdict-hero";
import { LiveChartPanel } from "@/components/live-chart-panel";
import { AIOptimizerPanel } from "@/components/ai-optimizer-panel";
import { IndicatorCard } from "@/components/indicator-card";
import { DiaryView } from "@/components/diary-view";
import { ForecastDisplay } from "@/components/forecast-display";
import { TradeControls } from "@/components/trade-controls";
import { KXBTC15MTimer } from "@/components/kxbtc15m-timer";
import { BetsLedger } from "@/components/bets-ledger";
import { useExchangeData } from "@/lib/use-exchange-data";

// ─── Technical indicator helpers ───────────────────────────────────────────

function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const slice = prices.slice(prices.length - period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  if (gains === 0) return 0;
  return 100 - 100 / (1 + gains / losses);
}

function calcMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
  // Requires at least 26 candles for EMA26 seed + 9 for signal EMA seed
  if (prices.length < 35) return null;

  // Incremental O(n) EMA — avoids re-scanning the array for every candle
  const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10;

  // Seed EMA12 on the first 12 bars, EMA26 on the first 26 bars
  let ema12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let ema26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

  // Walk bars 12-25 to bring EMA12 in sync with EMA26 at position 25
  for (let i = 12; i < 26; i++) ema12 = prices[i] * k12 + ema12 * (1 - k12);

  // From bar 26 onward, compute the MACD series incrementally
  const macdSeries: number[] = [];
  for (let i = 26; i < prices.length; i++) {
    ema12 = prices[i] * k12 + ema12 * (1 - k12);
    ema26 = prices[i] * k26 + ema26 * (1 - k26);
    macdSeries.push(ema12 - ema26);
  }

  if (macdSeries.length < 9) return null;

  // Signal: 9-period EMA of the MACD series (also incremental)
  let signal = macdSeries.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdSeries.length; i++) signal = macdSeries[i] * k9 + signal * (1 - k9);

  const macdLine = macdSeries[macdSeries.length - 1];
  return { macd: macdLine, signal, histogram: macdLine - signal };
}

function calcBollingerBands(
  prices: number[],
  period = 20
): { upper: number; middle: number; lower: number; pctB: number } | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  const last = prices[prices.length - 1];
  const pctB = std === 0 ? 0.5 : (last - lower) / (upper - lower);
  return { upper, middle: mean, lower, pctB };
}

function calcWindowBias(prices: number[]): number | null {
  if (prices.length < 2) return null;
  let up = 0, total = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] !== prices[i - 1]) {
      if (prices[i] > prices[i - 1]) up++;
      total++;
    }
  }
  if (total === 0) return null;
  return (up / total) * 100;
}

function calcMomentumScore(
  rsi: number | null,
  macd: { macd: number; histogram: number } | null,
  bb: { pctB: number } | null,
  ema9: number | null,
  ema21: number | null,
  windowBias: number | null
): number | null {
  let score = 50;
  let factors = 0;

  if (rsi !== null) {
    score += (rsi - 50) * 0.3;
    factors++;
  }
  if (macd !== null) {
    score += macd.histogram > 0 ? 8 : -8;
    score += macd.macd > 0 ? 4 : -4;
    factors++;
  }
  if (bb !== null) {
    score += (bb.pctB - 0.5) * 20;
    factors++;
  }
  if (ema9 !== null && ema21 !== null) {
    score += ema9 > ema21 ? 8 : -8;
    factors++;
  }
  if (windowBias !== null) {
    score += (windowBias - 50) * 0.2;
    factors++;
  }

  if (factors === 0) return null;
  return Math.max(0, Math.min(100, score));
}

function calcATR(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const slice = prices.slice(-(period + 1));
  let sum = 0;
  for (let i = 1; i < slice.length; i++) sum += Math.abs(slice[i] - slice[i - 1]);
  return sum / period;
}

function calcStochRSI(
  prices: number[],
  rsiPeriod = 14,
  stochPeriod = 14
): { k: number; d: number } | null {
  if (prices.length < rsiPeriod + stochPeriod + 3) return null;
  const rsiSeries: number[] = [];
  for (let i = rsiPeriod + 1; i <= prices.length; i++) {
    const v = calcRSI(prices.slice(0, i), rsiPeriod);
    if (v !== null) rsiSeries.push(v);
  }
  if (rsiSeries.length < stochPeriod + 3) return null;
  const kValues: number[] = [];
  for (let i = stochPeriod - 1; i < rsiSeries.length; i++) {
    const win = rsiSeries.slice(i - stochPeriod + 1, i + 1);
    const lo = Math.min(...win), hi = Math.max(...win);
    kValues.push(hi === lo ? 50 : ((rsiSeries[i] - lo) / (hi - lo)) * 100);
  }
  if (kValues.length < 3) return null;
  const k = kValues[kValues.length - 1];
  const d = kValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return { k, d };
}

function detectMarketRegime(
  ema9: number | null,
  ema21: number | null,
  bb: { upper: number; middle: number; lower: number } | null,
  atr: number | null,
  price: number | null
): string | null {
  if (!bb || !price) return null;
  const bbWidth = (bb.upper - bb.lower) / bb.middle;
  if (bbWidth < 0.003) return "SQUEEZE";
  if (atr !== null && atr / price > 0.003) return "VOLATILE";
  if (ema9 !== null && ema21 !== null) {
    const gap = (ema9 - ema21) / ema21;
    if (gap > 0.002) return "TRENDING UP";
    if (gap < -0.002) return "TRENDING DOWN";
  }
  return "RANGING";
}

function getCurrentSession(): { name: string; color: string } {
  const h = new Date().getUTCHours();
  if (h >= 13 && h < 16) return { name: "LONDON/NY", color: "var(--neon-green)" };
  if (h >= 7 && h < 13) return { name: "LONDON", color: "var(--cyan)" };
  if (h >= 16 && h < 22) return { name: "NEW YORK", color: "var(--amber)" };
  return { name: "ASIAN", color: "var(--muted-foreground)" };
}

function computeStrikeSuggestions(price: number, atr: number | null, regime: string | null): number[] {
  const step = atr ? Math.max(Math.round(atr * 0.5 / 50) * 50, 50) : Math.max(Math.round(price * 0.001 / 50) * 50, 50);
  const base = Math.round(price / step) * step;
  const up = regime === "TRENDING UP", down = regime === "TRENDING DOWN";
  if (up) return [base, base + step, base + step * 2];
  if (down) return [base - step * 2, base - step, base];
  return [base - step, base, base + step];
}

function playBeep(freq = 880, duration = 150, vol = 0.12) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch { /* ignore */ }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface PredictionResult {
  verdict: "ABOVE" | "BELOW" | "PASS";
  confidence: number;
  ev: number;
  kelly: number;
  reasoning: string[];
  modelVotes?: string[];
  modelAgreement?: number;
  passReason?: string | null;
  trajectory?: {
    movesNeeded: number | null;
    velocity: number | null;
    projectedOutcome: "ABOVE" | "BELOW" | null;
    momentumDir: string | null;
  };
}

interface MLPredictionResult {
  above_prob: number;
  below_prob: number;
  verdict: "ABOVE" | "BELOW" | "PASS";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  ob_signal: number;
  fund_rate: number;
  live_price: number;
  features: {
    rsi: number;
    macd_hist: number;
    bb_pct: number;
    volatility: number;
    momentum: number;
    ma_cross: number;
    vol_ratio: number;
  };
  model_meta?: {
    val_accuracy?: number;
    val_auc?: number;
    horizon_min?: number;
  };
}

interface PredictionHistoryEntry {
  verdict: "ABOVE" | "BELOW";
  confidence: number;
  strike: number;
  priceAtPrediction: number;
  expiryLabel: string;
  timestamp: number;
  outcome: "WIN" | "LOSS" | "PENDING";
  exitPrice?: number;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatBox({ label, value, valueColor, sub }: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5 rounded"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums" style={{ color: valueColor ?? "var(--foreground)" }}>
        {value}
      </span>
      {sub && (
        <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>{sub}</span>
      )}
    </div>
  );
}

function EmaIndicator({ ema9, ema21 }: { ema9: number | null; ema21: number | null }) {
  const signal =
    ema9 !== null && ema21 !== null
      ? ema9 > ema21
        ? { label: "BULLISH", color: "var(--neon-green)" }
        : ema9 < ema21
        ? { label: "BEARISH", color: "var(--neon-red)" }
        : { label: "NEUTRAL", color: "var(--muted-foreground)" }
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>
          TREND CHECK
        </span>
        {signal && (
          <span style={{ color: signal.color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>
            {signal.label}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div
          className="flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span style={{ color: "var(--amber)", fontSize: "10px" }}>EMA 9</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--amber)" }}>
            {ema9 !== null ? `$${ema9.toFixed(2)}` : "--"}
          </span>
        </div>
        <div
          className="flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span style={{ color: "var(--cyan)", fontSize: "10px" }}>EMA 21</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--cyan)" }}>
            {ema21 !== null ? `$${ema21.toFixed(2)}` : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}

function MacdRow({ macd }: { macd: { macd: number; signal: number; histogram: number } | null }) {
  if (!macd) {
    return (
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>MACD(12,26,9)</span>
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>--</span>
      </div>
    );
  }
  const bullish = macd.histogram > 0;
  const color = bullish ? "var(--neon-green)" : "var(--neon-red)";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>MACD(12,26,9)</span>
        <span style={{ color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>
          {bullish ? "BULLISH" : "BEARISH"}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>LINE</span>
          <span className="tabular-nums text-xs font-semibold" style={{ color: macd.macd > 0 ? "var(--neon-green)" : "var(--neon-red)" }}>
            {macd.macd > 0 ? "+" : ""}{macd.macd.toFixed(2)}
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>SIGNAL</span>
          <span className="tabular-nums text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
            {macd.signal.toFixed(2)}
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>HIST</span>
          <span className="tabular-nums text-xs font-semibold" style={{ color }}>
            {macd.histogram > 0 ? "+" : ""}{macd.histogram.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function BollingerRow({ bb, price }: {
  bb: { upper: number; middle: number; lower: number; pctB: number } | null;
  price: number | null;
}) {
  if (!bb || price === null) {
    return (
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>BOLL BANDS(20)</span>
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>--</span>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, bb.pctB * 100));
  const nearUpper = bb.pctB > 0.85;
  const nearLower = bb.pctB < 0.15;
  const squeeze = (bb.upper - bb.lower) / bb.middle < 0.002;
  const label = squeeze ? "SQUEEZE" : nearUpper ? "NEAR UPPER" : nearLower ? "NEAR LOWER" : "MID BAND";
  const color = nearUpper ? "var(--neon-red)" : nearLower ? "var(--neon-green)" : squeeze ? "var(--amber)" : "var(--cyan)";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>BOLL BANDS(20)</span>
        <span style={{ color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 5px ${color}88` }}
        />
      </div>
      <div className="flex justify-between" style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>
        <span>${bb.lower.toFixed(0)}</span>
        <span style={{ color: "var(--cyan)" }}>%B {bb.pctB.toFixed(2)}</span>
        <span>${bb.upper.toFixed(0)}</span>
      </div>
    </div>
  );
}

function MomentumScore({ score }: { score: number | null }) {
  if (score === null) return null;
  const bullish = score >= 55;
  const bearish = score <= 45;
  const color = bullish ? "var(--neon-green)" : bearish ? "var(--neon-red)" : "var(--amber)";
  const label = bullish ? "BULLISH BIAS" : bearish ? "BEARISH BIAS" : "NEUTRAL";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>MARKET VIBE</span>
        <div className="flex items-center gap-2">
          <span style={{ color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</span>
          <span className="font-bold tabular-nums" style={{ color, fontSize: "14px" }}>{score.toFixed(0)}</span>
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color, boxShadow: `0 0 8px ${color}88` }}
        />
        {/* Center line */}
        <div className="absolute top-0 left-1/2 h-full w-px opacity-40" style={{ background: "var(--muted-foreground)" }} />
      </div>
    </div>
  );
}

function StrikeDistance({ price, target }: { price: number | null; target: string }) {
  const t = parseFloat(target);
  if (!price || isNaN(t) || t === 0) return null;
  const diff = price - t;
  const pct = (diff / t) * 100;
  const above = diff > 0;
  const color = above ? "var(--neon-green)" : "var(--neon-red)";
  const absDiff = Math.abs(diff);
  const absPct = Math.abs(pct);
  return (
    <div
      className="rounded px-3 py-2 flex items-center justify-between"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>
        HOW FAR OFF
      </span>
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-xs font-semibold" style={{ color }}>
          {above ? "+" : "-"}${absDiff.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span
          className="tabular-nums font-bold text-xs px-1.5 py-0.5 rounded"
          style={{
            background: above ? "rgba(0,230,118,0.12)" : "rgba(255,77,106,0.12)",
            color,
            border: `1px solid ${color}44`,
          }}
        >
          {above ? "+" : "-"}{absPct.toFixed(3)}%
        </span>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "var(--neon-green)" : value >= 65 ? "var(--amber)" : "var(--muted-foreground)";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>CONFIDENCE</span>
        <span className="text-xs font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 8px ${color}` }}
          suppressHydrationWarning
        />
      </div>
    </div>
  );
}

function PredictionHistory({ history }: { history: PredictionHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>
        TRADE LOG
      </span>
      <div className="flex flex-col gap-1.5">
        {[...history].reverse().map((entry, i) => {
          const outcomeColor =
            entry.outcome === "WIN"
              ? "var(--neon-green)"
              : entry.outcome === "LOSS"
              ? "var(--neon-red)"
              : "var(--amber)";
          const verdictColor =
            entry.verdict === "ABOVE" ? "var(--neon-green)" : "var(--neon-red)";
          return (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: verdictColor, fontSize: "12px" }}>
                  {entry.verdict === "ABOVE" ? "▲" : "▼"}
                </span>
                <div className="flex flex-col">
                  <span className="tabular-nums" style={{ color: "var(--foreground)", fontSize: "10px" }}>
                    ${entry.strike.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>
                    {entry.expiryLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>
                  {entry.confidence}%
                </span>
                <span
                  className="px-1.5 py-0.5 rounded font-bold"
                  style={{
                    background:
                      entry.outcome === "WIN"
                        ? "rgba(0,230,118,0.12)"
                        : entry.outcome === "LOSS"
                        ? "rgba(255,77,106,0.12)"
                        : "rgba(255,179,0,0.12)",
                    color: outcomeColor,
                    fontSize: "9px",
                    letterSpacing: "0.08em",
                    border: `1px solid ${outcomeColor}44`,
                  }}
                >
                  {entry.outcome}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarketIntelPanel({
  fearGreed, fundingRate, change24h, volume24h, openInterest, oiDelta, high24h, low24h,
}: {
  fearGreed: { value: number; label: string } | null;
  fundingRate: number | null;
  change24h: number | null;
  volume24h: number | null;
  openInterest: number | null;
  oiDelta: number | null;
  high24h: number | null;
  low24h: number | null;
}) {
  if (!fearGreed && fundingRate === null && change24h === null) return null;
  const fngColor = fearGreed
    ? fearGreed.value <= 25 ? "var(--neon-green)"
    : fearGreed.value <= 45 ? "var(--amber)"
    : fearGreed.value <= 55 ? "var(--muted-foreground)"
    : fearGreed.value <= 75 ? "var(--amber)"
    : "var(--neon-red)"
    : "var(--muted-foreground)";
  const fundingColor = fundingRate !== null
    ? fundingRate > 0.0003 ? "var(--neon-red)"
    : fundingRate > 0 ? "var(--amber)"
    : fundingRate < -0.0003 ? "var(--neon-green)"
    : "var(--neon-green)"
    : "var(--muted-foreground)";
  const changeColor = change24h !== null
    ? change24h >= 0 ? "var(--neon-green)" : "var(--neon-red)"
    : "var(--muted-foreground)";
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>MARKET SNAPSHOT</span>
      <div className="grid grid-cols-2 gap-2">
        {fearGreed !== null && (
          <div className="flex flex-col gap-1 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>FEAR & GREED</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold tabular-nums" style={{ color: fngColor }}>{fearGreed.value}</span>
              <span style={{ color: fngColor, fontSize: "9px" }}>{fearGreed.label.toUpperCase()}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div style={{ width: `${fearGreed.value}%`, height: "100%", background: fngColor, borderRadius: "9999px" }} />
            </div>
          </div>
        )}
        {fundingRate !== null && (
          <div className="flex flex-col gap-1 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>FUNDING RATE</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: fundingColor }}>
              {fundingRate >= 0 ? "+" : ""}{(fundingRate * 100).toFixed(4)}%
            </span>
            <span style={{ color: fundingColor, fontSize: "9px" }}>
              {fundingRate > 0 ? "LONGS PAYING" : "SHORTS PAYING"}
            </span>
          </div>
        )}
        {change24h !== null && (
          <div className="flex flex-col gap-1 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>24H CHANGE</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: changeColor }}>
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
            {high24h !== null && low24h !== null && (
              <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>
                H ${high24h.toFixed(0)} · L ${low24h.toFixed(0)}
              </span>
            )}
          </div>
        )}
        {volume24h !== null && (
          <div className="flex flex-col gap-1 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>24H VOLUME</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              ${volume24h >= 1e9 ? `${(volume24h / 1e9).toFixed(2)}B` : `${(volume24h / 1e6).toFixed(0)}M`}
            </span>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>BTCUSDT QUOTE</span>
          </div>
        )}
        {openInterest !== null && (
          <div className="flex flex-col gap-1 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>OPEN INTEREST</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--cyan)" }}>
                ${(openInterest / 1e9).toFixed(2)}B
              </span>
              {oiDelta !== null && Math.abs(oiDelta) > 1e6 && (
                <span style={{ fontSize: "9px", fontWeight: 700, color: oiDelta > 0 ? "var(--neon-green)" : "var(--neon-red)" }}>
                  {oiDelta > 0 ? "▲" : "▼"} {Math.abs(oiDelta) >= 1e9 ? `${(Math.abs(oiDelta) / 1e9).toFixed(2)}B` : `${(Math.abs(oiDelta) / 1e6).toFixed(0)}M`}
                </span>
              )}
            </div>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>
              {oiDelta !== null && Math.abs(oiDelta) > 1e6
                ? oiDelta > 0 ? "OI RISING · LONGS ADDING" : "OI FALLING · COVERING"
                : "FUTURES OI"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StochRsiRow({ stochRsi }: { stochRsi: { k: number; d: number } | null }) {
  if (!stochRsi) {
    return (
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>STOCH RSI</span>
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>--</span>
      </div>
    );
  }
  const overbought = stochRsi.k > 80, oversold = stochRsi.k < 20;
  const color = overbought ? "var(--neon-red)" : oversold ? "var(--neon-green)" : "var(--cyan)";
  const label = overbought ? "OVERBOUGHT" : oversold ? "OVERSOLD" : "NEUTRAL";
  const crossColor = stochRsi.k > stochRsi.d ? "var(--neon-green)" : "var(--neon-red)";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>STOCH RSI</span>
        <span style={{ color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <div className="flex gap-2">
        {[
          { label: "K", value: stochRsi.k, color },
          { label: "D", value: stochRsi.d, color: "var(--muted-foreground)" },
          { label: "K-D", value: Math.abs(stochRsi.k - stochRsi.d), color: crossColor, prefix: stochRsi.k > stochRsi.d ? "▲" : "▼" },
        ].map(({ label: l, value, color: c, prefix }) => (
          <div key={l} className="flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>{l}</span>
            <span className="tabular-nums text-xs font-semibold" style={{ color: c }}>{prefix ?? ""}{value.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${stochRsi.k}%`, background: color, boxShadow: `0 0 5px ${color}88` }} />
      </div>
    </div>
  );
}

function AtrRow({ atr, price }: { atr: number | null; price: number | null }) {
  if (!atr || !price) {
    return (
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>ATR(14)</span>
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>--</span>
      </div>
    );
  }
  const atrPct = (atr / price) * 100;
  const label = atrPct > 0.2 ? "HIGH VOL" : atrPct > 0.08 ? "MED VOL" : "LOW VOL";
  const color = atrPct > 0.2 ? "var(--neon-red)" : atrPct > 0.08 ? "var(--amber)" : "var(--neon-green)";
  return (
    <div className="flex justify-between items-center">
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>ATR(14)</span>
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>±${atr.toFixed(0)} ({atrPct.toFixed(3)}%)</span>
        <span style={{ color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</span>
      </div>
    </div>
  );
}

// ─── New elite components ──────────────────────────────────────────────────

function DeltaPanel({
  buyVolume, sellVolume, obImbalance, largeTrades, cvd5m,
}: {
  buyVolume: number; sellVolume: number;
  obImbalance: number | null;
  largeTrades: { side: "BUY" | "SELL"; amount: number; time: number }[];
  cvd5m: number;
}) {
  const total = buyVolume + sellVolume;
  const buyPct = total > 0 ? (buyVolume / total) * 100 : 50;
  const isBuyHeavy = buyPct > 58, isSellHeavy = buyPct < 42;
  const deltaColor = isBuyHeavy ? "var(--neon-green)" : isSellHeavy ? "var(--neon-red)" : "var(--amber)";
  const obBullish = obImbalance !== null && obImbalance > 0.60;
  const obBearish = obImbalance !== null && obImbalance < 0.40;
  const obColor = obBullish ? "var(--neon-green)" : obBearish ? "var(--neon-red)" : "var(--amber)";
  if (total === 0 && obImbalance === null) return null;
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>MONEY FLOW</span>
        {obImbalance !== null && (
          <span style={{ color: obColor, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em" }}>
            OB {(obImbalance * 100).toFixed(0)}% BIDS {obBullish ? "▲" : obBearish ? "▼" : "—"}
          </span>
        )}
      </div>
      {total > 0 && (
        <>
          <div className="flex justify-between" style={{ fontSize: "10px" }}>
            <span style={{ color: "var(--neon-green)" }}>BUY ${(buyVolume / 1000).toFixed(0)}K</span>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>60s DELTA</span>
            <span style={{ color: "var(--neon-red)" }}>SELL ${(sellVolume / 1000).toFixed(0)}K</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div style={{ width: `${buyPct}%`, background: "var(--neon-green)", height: "100%", transition: "width 0.5s" }} />
            <div style={{ width: `${100 - buyPct}%`, background: "var(--neon-red)", height: "100%", transition: "width 0.5s" }} />
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: deltaColor, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em" }}>
              {isBuyHeavy ? `BUY PRESSURE (+${(buyPct - 50).toFixed(1)}%)` : isSellHeavy ? `SELL PRESSURE (${(buyPct - 50).toFixed(1)}%)` : "BALANCED FLOW"}
            </span>
            {cvd5m !== 0 && (
              <span style={{ fontSize: "9px", fontWeight: 700, color: cvd5m > 0 ? "var(--neon-green)" : "var(--neon-red)" }}>
                CVD {cvd5m > 0 ? "▲" : "▼"} {cvd5m >= 1e6 ? `$${(Math.abs(cvd5m) / 1e6).toFixed(1)}M` : `$${(Math.abs(cvd5m) / 1000).toFixed(0)}K`}
              </span>
            )}
          </div>
        </>
      )}
      {largeTrades.length > 0 && (
        <div className="flex flex-col gap-1">
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px", letterSpacing: "0.08em" }}>WHALE MOVES</span>
          {largeTrades.slice(-3).reverse().map((t, i) => (
            <div key={i} className="flex justify-between items-center px-2 py-1 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <span style={{ color: t.side === "BUY" ? "var(--neon-green)" : "var(--neon-red)", fontSize: "10px", fontWeight: 700 }}>
                {t.side === "BUY" ? "▲" : "▼"} {t.side}
              </span>
              <span className="tabular-nums" style={{ color: "var(--foreground)", fontSize: "10px" }}>
                ${(t.amount / 1000).toFixed(0)}K
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BankrollPanel({
  bankroll, onChange, dollarKelly, kellyPct,
}: {
  bankroll: number | null; onChange: (v: number | null) => void;
  dollarKelly: number | null; kellyPct: number | null;
}) {
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>YOUR STACK</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none" style={{ color: "var(--muted-foreground)" }}>$</span>
        <input
          type="number"
          placeholder="10000"
          value={bankroll ?? ""}
          onChange={(e) => { const v = parseFloat(e.target.value); onChange(isNaN(v) || v <= 0 ? null : v); }}
          className="w-full pl-7 pr-3 py-2 rounded text-sm tabular-nums outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "inherit" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cyan)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>
      {dollarKelly !== null && bankroll !== null && (
        <div className="flex items-center justify-between px-2 py-1.5 rounded" style={{ background: "rgba(0,255,231,0.06)", border: "1px solid rgba(0,255,231,0.2)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>KELLY BET</span>
          <div className="flex items-baseline gap-1.5">
            <span className="tabular-nums font-bold" style={{ color: "var(--cyan)", fontSize: "18px" }}>
              ${dollarKelly.toFixed(2)}
            </span>
            <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>({kellyPct?.toFixed(1)}% of ${bankroll.toLocaleString()})</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EventsWarning({ events }: { events: { title: string; minutesUntil: number }[] }) {
  if (events.length === 0) return null;
  const imminent = events.filter((e) => e.minutesUntil <= 30);
  return (
    <div className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
      style={{ background: imminent.length > 0 ? "rgba(255,77,106,0.08)" : "rgba(255,179,0,0.07)", border: `1px solid ${imminent.length > 0 ? "rgba(255,77,106,0.4)" : "rgba(255,179,0,0.35)"}` }}>
      <span style={{ color: imminent.length > 0 ? "var(--neon-red)" : "var(--amber)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>
        {imminent.length > 0 ? "⚠ IMMINENT HIGH-IMPACT EVENT" : "UPCOMING ECONOMIC RISK"}
      </span>
      {events.slice(0, 3).map((e, i) => (
        <div key={i} className="flex justify-between items-center">
          <span style={{ color: "var(--foreground)", fontSize: "10px" }}>{e.title}</span>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>
            {e.minutesUntil < 60 ? `${e.minutesUntil}m` : `${Math.round(e.minutesUntil / 60)}h`}
          </span>
        </div>
      ))}
      {imminent.length > 0 && (
        <span style={{ color: "var(--neon-red)", fontSize: "9px" }}>AI will likely recommend PASS</span>
      )}
    </div>
  );
}

function ModelVotesBadge({ votes, agreement }: { votes: string[]; agreement: number }) {
  const total = votes.filter((v) => v !== "ERR").length;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span style={{ color: "var(--muted-foreground)", fontSize: "9px", letterSpacing: "0.06em" }}>AI VOTES</span>
      {votes.map((v, i) => {
        const c = v === "ABOVE" ? "var(--neon-green)" : v === "BELOW" ? "var(--neon-red)" : v === "PASS" ? "var(--amber)" : "var(--muted-foreground)";
        return (
          <span key={i} className="px-1.5 py-0.5 rounded font-bold" style={{ background: `${c}15`, border: `1px solid ${c}40`, color: c, fontSize: "9px", letterSpacing: "0.06em" }}>
            M{i + 1} {v === "ABOVE" ? "▲" : v === "BELOW" ? "▼" : v === "PASS" ? "—" : "?"}
          </span>
        );
      })}
      {total > 0 && (
        <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>{agreement}/{total} agree</span>
      )}
    </div>
  );
}

function PriceAlertManager({
  alerts, alertInput, currentPrice, onInputChange, onAdd, onRemove, notifPermission, onRequestPermission,
}: {
  alerts: { price: number; direction: "above" | "below" }[];
  alertInput: string; currentPrice: number | null;
  onInputChange: (v: string) => void;
  onAdd: (price: number, direction: "above" | "below") => void;
  onRemove: (i: number) => void;
  notifPermission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const num = parseFloat(alertInput);
  const isValid = !isNaN(num) && num > 0 && num >= 1000 && num <= 1_000_000;
  const direction: "above" | "below" | null = currentPrice && isValid
    ? num > currentPrice ? "above" : "below"
    : null;
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>PRICE ALERTS</span>
        {notifPermission !== "granted" && (
          <button onClick={onRequestPermission} className="px-2 py-0.5 rounded" style={{ background: "rgba(0,255,231,0.08)", border: "1px solid rgba(0,255,231,0.25)", color: "var(--cyan)", fontSize: "9px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
            ENABLE PUSH
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none" style={{ color: "var(--muted-foreground)" }}>$</span>
          <input
            type="number"
            placeholder="84500"
            value={alertInput}
            onChange={(e) => onInputChange(e.target.value)}
            className="w-full pl-7 pr-3 py-2 rounded text-sm tabular-nums outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "inherit" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cyan)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
        <button
          onClick={() => { if (isValid && direction) { onAdd(num, direction); onInputChange(""); } }}
          disabled={!isValid || !direction}
          className="px-3 py-2 rounded font-bold transition-all disabled:opacity-40"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: direction ? (direction === "above" ? "var(--neon-green)" : "var(--neon-red)") : "var(--muted-foreground)", fontFamily: "inherit", fontSize: "11px", cursor: isValid && direction ? "pointer" : "not-allowed" }}
        >
          {direction === "above" ? "▲" : direction === "below" ? "▼" : "+"} SET
        </button>
      </div>
      {alerts.length > 0 && (
        <div className="flex flex-col gap-1">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: a.direction === "above" ? "var(--neon-green)" : "var(--neon-red)", fontSize: "10px" }}>
                  {a.direction === "above" ? "▲" : "▼"}
                </span>
                <span className="tabular-nums" style={{ color: "var(--foreground)", fontSize: "10px" }}>
                  ${a.price.toLocaleString()}
                </span>
              </div>
              <button onClick={() => onRemove(i)} style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontFamily: "inherit" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalibrationPanel({ history }: { history: PredictionHistoryEntry[] }) {
  const buckets = [
    { label: "50–60%", min: 50, max: 60 },
    { label: "60–70%", min: 60, max: 70 },
    { label: "70–80%", min: 70, max: 80 },
    { label: "80–99%", min: 80, max: 100 },
  ].map(({ label, min, max }) => {
    const entries = history.filter((e) => e.outcome !== "PENDING" && e.confidence >= min && e.confidence < max);
    const wins = entries.filter((e) => e.outcome === "WIN").length;
    return { label, expected: (min + max) / 2, actual: entries.length > 0 ? (wins / entries.length) * 100 : -1, count: entries.length };
  }).filter((b) => b.count > 0);

  if (buckets.length === 0) return null;
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>ACCURACY CHECK</span>
      {buckets.map((b) => {
        const over = b.actual >= b.expected;
        const color = over ? "var(--neon-green)" : "var(--neon-red)";
        return (
          <div key={b.label} className="flex flex-col gap-1">
            <div className="flex justify-between" style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>
              <span>{b.label} <span style={{ color: "var(--foreground)" }}>({b.count} trades)</span></span>
              <span style={{ color }}>{b.actual.toFixed(0)}% actual {over ? "≥" : "<"} {b.expected.toFixed(0)}% expected</span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${b.expected}%`, background: "var(--border)", borderRadius: "9999px" }} />
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(b.actual, 100)}%`, background: color, borderRadius: "9999px", opacity: 0.8 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsPanel({ history }: { history: PredictionHistoryEntry[] }) {
  const settled = history.filter((e) => e.outcome !== "PENDING");
  if (settled.length < 3) return null;

  // Current streak
  let streakCount = 1;
  const streakType = settled.at(-1)!.outcome as "WIN" | "LOSS";
  for (let i = settled.length - 2; i >= 0; i--) {
    if (settled[i].outcome === streakType) streakCount++;
    else break;
  }

  // Win rate over last 10
  const last10 = settled.slice(-10);
  const last10Wins = last10.filter((e) => e.outcome === "WIN").length;
  const last10WR = Math.round((last10Wins / last10.length) * 100);

  // Simulated P&L (flat $10 per trade)
  let pnl = 0;
  for (const e of settled) {
    pnl += e.outcome === "WIN" ? 9 : -10; // ~1.8x payout typical for binary
  }

  const streakColor = streakType === "WIN" ? "var(--neon-green)" : "var(--neon-red)";
  const pnlColor = pnl >= 0 ? "var(--neon-green)" : "var(--neon-red)";
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>HOW YOU'RE DOING</span>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>STREAK</span>
          <span className="font-bold tabular-nums" style={{ color: streakColor, fontSize: "14px" }}>{streakCount}{streakType === "WIN" ? "W" : "L"}</span>
        </div>
        <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>LAST 10</span>
          <span className="font-bold tabular-nums" style={{ color: last10WR >= 55 ? "var(--neon-green)" : last10WR >= 45 ? "var(--amber)" : "var(--neon-red)", fontSize: "14px" }}>{last10WR}%</span>
        </div>
        <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>SIM P&L</span>
          <span className="font-bold tabular-nums" style={{ color: pnlColor, fontSize: "14px" }}>{pnl >= 0 ? "+" : ""}${pnl}</span>
        </div>
      </div>
    </div>
  );
}

function LiquidationPanel({ liquidations }: { liquidations: { side: "LONG" | "SHORT"; amount: number; price: number; time: number }[] }) {
  if (liquidations.length === 0) return null;
  const totalLong = liquidations.filter((l) => l.side === "LONG").reduce((s, l) => s + l.amount, 0);
  const totalShort = liquidations.filter((l) => l.side === "SHORT").reduce((s, l) => s + l.amount, 0);
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>WRECKED TRADERS</span>
        <div className="flex gap-2" style={{ fontSize: "9px" }}>
          {totalLong > 0 && <span style={{ color: "var(--neon-red)" }}>LONG ${(totalLong / 1e6).toFixed(2)}M liq'd</span>}
          {totalShort > 0 && <span style={{ color: "var(--neon-green)" }}>SHORT ${(totalShort / 1e6).toFixed(2)}M liq'd</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {[...liquidations].reverse().slice(0, 5).map((l, i) => {
          const isLong = l.side === "LONG";
          const color = isLong ? "var(--neon-red)" : "var(--neon-green)";
          return (
            <div key={i} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color, fontSize: "10px", fontWeight: 700 }}>{isLong ? "▼ LONG LIQ" : "▲ SHORT LIQ"}</span>
                <span style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>@${l.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              </div>
              <span className="tabular-nums font-bold" style={{ color, fontSize: "10px" }}>
                ${l.amount >= 1_000_000 ? `${(l.amount / 1e6).toFixed(2)}M` : `${(l.amount / 1000).toFixed(0)}K`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VwapRow({ vwap, price }: { vwap: number | null; price: number | null }) {
  if (!vwap || !price) {
    return (
      <div className="flex justify-between items-center">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>VWAP(5m)</span>
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>--</span>
      </div>
    );
  }
  const aboveVwap = price > vwap;
  const pctDiff = ((price - vwap) / vwap) * 100;
  const color = aboveVwap ? "var(--neon-green)" : "var(--neon-red)";
  return (
    <div className="flex justify-between items-center">
      <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.08em" }}>VWAP(5m)</span>
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>${vwap.toFixed(2)}</span>
        <span style={{ color, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em" }}>
          {aboveVwap ? "ABOVE" : "BELOW"} {pctDiff >= 0 ? "+" : ""}{pctDiff.toFixed(3)}%
        </span>
      </div>
    </div>
  );
}

function StrikeSuggestions({ price, atr, marketRegime, onSelect }: {
  price: number | null; atr: number | null; marketRegime: string | null; onSelect: (s: string) => void;
}) {
  if (!price) return null;
  const strikes = computeStrikeSuggestions(price, atr, marketRegime);
  const labels = marketRegime === "TRENDING UP" ? ["ATM", "OTM+", "OTM++"] : marketRegime === "TRENDING DOWN" ? ["OTM--", "OTM-", "ATM"] : ["OTM-", "ATM", "OTM+"];
  return (
    <div className="flex flex-col gap-1.5">
      <span style={{ color: "var(--muted-foreground)", fontSize: "9px", letterSpacing: "0.08em" }}>SUGGESTED TARGETS</span>
      <div className="flex gap-1.5">
        {strikes.map((s, i) => {
          const pct = ((s - price) / price) * 100;
          const itm = s <= price;
          const color = itm ? "var(--neon-green)" : "var(--amber)";
          return (
            <button
              key={s}
              onClick={() => onSelect(String(s))}
              className="flex-1 flex flex-col items-center gap-0.5 px-1.5 py-2 rounded"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--cyan)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <span style={{ color: "var(--muted-foreground)", fontSize: "8px" }}>{labels[i]}</span>
              <span className="tabular-nums font-bold" style={{ color: "var(--foreground)", fontSize: "10px" }}>${s.toLocaleString()}</span>
              <span style={{ color, fontSize: "8px" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Kalshi 15-min synchronized countdown helpers ─────────────────────────

function getSecondsToNextKalshi(): number {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const msIntoWindow = now % windowMs;
  return Math.ceil((windowMs - msIntoWindow) / 1000);
}

function getNextKalshiExpiryLabel(): string {
  const now = new Date();
  const windowMs = 15 * 60 * 1000;
  const nextBoundary = new Date(Math.ceil(now.getTime() / windowMs) * windowMs);
  const hh = nextBoundary.getUTCHours().toString().padStart(2, "0");
  const mm = nextBoundary.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function Page() {
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const assetRef = useRef<"BTC" | "ETH">("BTC");

  const [price, setPrice] = useState<number | null>(null);
  const [priceDir, setPriceDir] = useState<"up" | "down" | "">("");
  const [source, setSource] = useState<"loading" | "live" | "error">("loading");
  const [closes, setCloses] = useState<number[]>([]);

  // Exchange data hook for real-time WebSocket
  const exchangeData = useExchangeData("BTC/USD");

  // Indicators
  const [ema9, setEma9] = useState<number | null>(null);
  const [ema21, setEma21] = useState<number | null>(null);
  const [rsi, setRsi] = useState<number | null>(null);
  const [macd, setMacd] = useState<{ macd: number; signal: number; histogram: number } | null>(null);
  const [bb, setBb] = useState<{ upper: number; middle: number; lower: number; pctB: number } | null>(null);
  const [windowBias, setWindowBias] = useState<number | null>(null);
  const [momentumScore, setMomentumScore] = useState<number | null>(null);

  // Kalshi synchronized countdown
  const [expirySeconds, setExpirySeconds] = useState<number>(() => getSecondsToNextKalshi());
  const [expiryLabel, setExpiryLabel] = useState<string>(() => getNextKalshiExpiryLabel());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevExpiryWindowRef = useRef<string>(getNextKalshiExpiryLabel());

  // Prediction
  const [target, setTarget] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [predError, setPredError] = useState<string | null>(null);
  const [mlResult, setMlResult] = useState<MLPredictionResult | null>(null);
  const [predHistory, setPredHistory] = useState<PredictionHistoryEntry[]>([]);

  // WebSocket / real-time state
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [buyVolume, setBuyVolume] = useState(0);
  const [sellVolume, setSellVolume] = useState(0);
  const [obImbalance, setObImbalance] = useState<number | null>(null);
  const [largeTrades, setLargeTrades] = useState<{ side: "BUY" | "SELL"; amount: number; time: number }[]>([]);
  const [liquidations, setLiquidations] = useState<{ side: "LONG" | "SHORT"; amount: number; price: number; time: number }[]>([]);
  const [vwap, setVwap] = useState<number | null>(null);
  const [cvd5m, setCvd5m] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Bankroll
  const [bankroll, setBankroll] = useState<number | null>(null);

  // Price alerts
  const [priceAlerts, setPriceAlerts] = useState<{ price: number; direction: "above" | "below" }[]>([]);
  const [alertInput, setAlertInput] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Market intelligence state
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string } | null>(null);
  const [fundingRate, setFundingRate] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [volume24h, setVolume24h] = useState<number | null>(null);
  const [high24h, setHigh24h] = useState<number | null>(null);
  const [low24h, setLow24h] = useState<number | null>(null);
  const [openInterest, setOpenInterest] = useState<number | null>(null);
  const [oiDelta, setOiDelta] = useState<number | null>(null);
  const [pcRatio, setPcRatio] = useState<number | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<{ title: string; minutesUntil: number }[]>([]);
  // Advanced indicators
  const [atr, setAtr] = useState<number | null>(null);
  const [stochRsi, setStochRsi] = useState<{ k: number; d: number } | null>(null);
  const [marketRegime, setMarketRegime] = useState<string | null>(null);

  // Kalshi-extracted feature states (restore from localStorage if available)
  const [aggressiveness, setAggressiveness] = useState<"CONSERVATIVE" | "MODERATE" | "AGGRESSIVE">(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("btc-oracle-settings") || "{}");
      return saved.aggressiveness ?? "MODERATE";
    } catch { return "MODERATE"; }
  });
  const [alertThreshold, setAlertThreshold] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("btc-oracle-settings") || "{}");
      return saved.alertThreshold ?? 70;
    } catch { return 70; }
  });
  const [showExplainability, setShowExplainability] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("btc-oracle-settings") || "{}");
      return saved.showExplainability ?? true;
    } catch { return true; }
  });
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [rlEnabled, setRlEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("btc-oracle-settings") || "{}");
      return saved.compactMode ?? false;
    } catch { return false; }
  });
  const [signals, setSignals] = useState<Array<{
    id: string;
    timestamp: number;
    verdict: "ABOVE" | "BELOW" | "AWAITING";
    confidence: number;
    strike: number;
    price: number;
    expiryLabel: string;
    status: "ACTIVE" | "EXPIRED" | "WIN" | "LOSS";
  }>>([]);

  const priceDirRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const accumulatedClosesRef = useRef<number[]>([]);
  const seededRef = useRef(false);
  const priceRef = useRef<number | null>(null);
  const closesRef = useRef<number[]>([]);
  const ema9Ref = useRef<number | null>(null);
  const ema21Ref = useRef<number | null>(null);
  const rsiRef = useRef<number | null>(null);
  const macdRef = useRef<{ macd: number; signal: number; histogram: number } | null>(null);
  const bbRef = useRef<{ upper: number; middle: number; lower: number; pctB: number } | null>(null);
  const windowBiasRef = useRef<number | null>(null);
  const targetRef = useRef("");
  const loadingRef = useRef(false);
  const fearGreedRef = useRef<{ value: number; label: string } | null>(null);
  const fundingRateRef = useRef<number | null>(null);
  const change24hRef = useRef<number | null>(null);
  const openInterestRef = useRef<number | null>(null);
  const prevOpenInterestRef = useRef<number | null>(null);
  const oiDeltaRef = useRef<number | null>(null);
  const atrRef = useRef<number | null>(null);
  const stochRsiRef = useRef<{ k: number; d: number } | null>(null);
  const marketRegimeRef = useRef<string | null>(null);
  const pcRatioRef = useRef<number | null>(null);
  const upcomingEventsRef = useRef<{ title: string; minutesUntil: number }[]>([]);
  const buyVolumeRef = useRef(0);
  const sellVolumeRef = useRef(0);
  const obImbalanceRef = useRef<number | null>(null);
  const bankrollRef = useRef<number | null>(null);
  const priceAlertsRef = useRef<{ price: number; direction: "above" | "below" }[]>([]);
  // Timing refs for WebSocket accumulation
  const lastCloseTimeRef = useRef(0);
  const lastIndicatorUpdateRef = useRef(0);
  const tradeBufferRef = useRef<{ time: number; usdValue: number; isBuy: boolean }[]>([]);
  const vwapBufferRef = useRef<{ time: number; price: number; qty: number }[]>([]);
  const cvdBufferRef = useRef<{ time: number; delta: number }[]>([]);
  const liquidationsRef = useRef<{ side: "LONG" | "SHORT"; amount: number; price: number; time: number }[]>([]);
  const vwapRef = useRef<number | null>(null);
  const cvd5mRef = useRef(0);
  const soundEnabledRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { priceRef.current = price; }, [price]);
  useEffect(() => { closesRef.current = closes; }, [closes]);
  useEffect(() => { ema9Ref.current = ema9; }, [ema9]);
  useEffect(() => { ema21Ref.current = ema21; }, [ema21]);
  useEffect(() => { rsiRef.current = rsi; }, [rsi]);
  useEffect(() => { macdRef.current = macd; }, [macd]);
  useEffect(() => { bbRef.current = bb; }, [bb]);
  useEffect(() => { windowBiasRef.current = windowBias; }, [windowBias]);
  useEffect(() => { targetRef.current = target; }, [target]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { fearGreedRef.current = fearGreed; }, [fearGreed]);
  useEffect(() => { fundingRateRef.current = fundingRate; }, [fundingRate]);
  useEffect(() => { change24hRef.current = change24h; }, [change24h]);
  useEffect(() => { openInterestRef.current = openInterest; }, [openInterest]);
  useEffect(() => { atrRef.current = atr; }, [atr]);
  useEffect(() => { stochRsiRef.current = stochRsi; }, [stochRsi]);
  useEffect(() => { marketRegimeRef.current = marketRegime; }, [marketRegime]);
  useEffect(() => { pcRatioRef.current = pcRatio; }, [pcRatio]);
  useEffect(() => { upcomingEventsRef.current = upcomingEvents; }, [upcomingEvents]);
  useEffect(() => { bankrollRef.current = bankroll; }, [bankroll]);
  useEffect(() => { priceAlertsRef.current = priceAlerts; }, [priceAlerts]);
  useEffect(() => { vwapRef.current = vwap; }, [vwap]);
  useEffect(() => { cvd5mRef.current = cvd5m; }, [cvd5m]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { assetRef.current = asset; }, [asset]);

  // ── Reset all state when asset changes ───────────────────────────────
  useEffect(() => {
    // Reset price / source state
    setPrice(null);
    setPriceDir("");
    setSource("loading");
    setCloses([]);
    // Reset indicators
    setEma9(null); setEma21(null); setRsi(null); setMacd(null); setBb(null);
    setWindowBias(null); setMomentumScore(null); setAtr(null); setStochRsi(null);
    setMarketRegime(null);
    // Reset prediction state
    setTarget(""); setTargetError(null); setResult(null); setMlResult(null);
    setPredError(null);
    // Reset market intel
    setFearGreed(null); setFundingRate(null); setChange24h(null);
    setVolume24h(null); setHigh24h(null); setLow24h(null);
    setOpenInterest(null); setOiDelta(null); setPcRatio(null); setUpcomingEvents([]);
    // Reset flow / WS state
    setBuyVolume(0); setSellVolume(0); setObImbalance(null);
    setLargeTrades([]); setLiquidations([]); setVwap(null); setCvd5m(0);
    // Reset prediction history (per-asset)
    try {
      const key = `${asset.toLowerCase()}-pred-history`;
      const h = localStorage.getItem(key);
      setPredHistory(h ? (JSON.parse(h) as PredictionHistoryEntry[]) : []);
    } catch { setPredHistory([]); }
    // Reset refs
    accumulatedClosesRef.current = [];
    seededRef.current = false;
    prevPriceRef.current = null;
    priceRef.current = null;
    closesRef.current = [];
    ema9Ref.current = null; ema21Ref.current = null;
    rsiRef.current = null; macdRef.current = null; bbRef.current = null;
    windowBiasRef.current = null; atrRef.current = null;
    stochRsiRef.current = null; marketRegimeRef.current = null;
    tradeBufferRef.current = [];
    vwapBufferRef.current = [];
    cvdBufferRef.current = [];
    liquidationsRef.current = [];
    vwapRef.current = null; cvd5mRef.current = 0;
    buyVolumeRef.current = 0; sellVolumeRef.current = 0;
    obImbalanceRef.current = null;
    fearGreedRef.current = null; fundingRateRef.current = null;
    change24hRef.current = null; openInterestRef.current = null;
    pcRatioRef.current = null; upcomingEventsRef.current = [];
    prevOpenInterestRef.current = null; oiDeltaRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // ── Persist prediction history, bankroll, alerts to localStorage ─────
  useEffect(() => {
    try {
      const h = localStorage.getItem("btc-pred-history");
      if (h) { const p = JSON.parse(h); if (Array.isArray(p)) setPredHistory(p); }
      const b = localStorage.getItem("btc-bankroll");
      if (b) { const n = parseFloat(b); if (!isNaN(n) && n > 0) setBankroll(n); }
      const a = localStorage.getItem("btc-alerts");
      if (a) { const p = JSON.parse(a); if (Array.isArray(p)) setPriceAlerts(p); }
    } catch { /* ignore */ }
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(`${asset.toLowerCase()}-pred-history`, JSON.stringify(predHistory)); } catch { /* ignore */ }
  }, [predHistory, asset]);

  useEffect(() => {
    try { if (bankroll !== null) localStorage.setItem("btc-bankroll", String(bankroll)); } catch { /* ignore */ }
  }, [bankroll]);

  useEffect(() => {
    try { localStorage.setItem(`${asset.toLowerCase()}-alerts`, JSON.stringify(priceAlerts)); } catch { /* ignore */ }
  }, [priceAlerts, asset]);

  // ── Binance WebSocket: real-time price, volume, order book ───────────
  useEffect(() => {
    let ws: WebSocket;
    let wsFutures: WebSocket;
    let wsDepth: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectFuturesTimer: ReturnType<typeof setTimeout>;
    let reconnectDepthTimer: ReturnType<typeof setTimeout>;
    let active = true;
    const TRADE_WINDOW_MS = 60_000;

    function recalcIndicators(history: number[], newPrice: number) {
      const newEma9 = calcEMA(history, 9);
      const newEma21 = calcEMA(history, 21);
      const newRsi = calcRSI(history);
      const newMacd = calcMACD(history);
      const newBb = calcBollingerBands(history);
      const newWindowBias = calcWindowBias(history);
      const newMomentum = calcMomentumScore(newRsi, newMacd, newBb, newEma9, newEma21, newWindowBias);
      const newAtr = calcATR(history);
      const newStochRsi = calcStochRSI(history);
      const newRegime = detectMarketRegime(newEma9, newEma21, newBb, newAtr, newPrice);
      setCloses([...history]);
      setEma9(newEma9);        setEma21(newEma21);
      setRsi(newRsi);          setMacd(newMacd);
      setBb(newBb);            setWindowBias(newWindowBias);
      setMomentumScore(newMomentum);
      setAtr(newAtr);          setStochRsi(newStochRsi);
      setMarketRegime(newRegime);
      ema9Ref.current = newEma9;  ema21Ref.current = newEma21;
      rsiRef.current = newRsi;    macdRef.current = newMacd;
      bbRef.current = newBb;      windowBiasRef.current = newWindowBias;
      atrRef.current = newAtr;    stochRsiRef.current = newStochRsi;
      marketRegimeRef.current = newRegime;
    }

    function checkAlerts(newPrice: number) {
      const triggered = priceAlertsRef.current.filter((a) =>
        (a.direction === "above" && newPrice >= a.price) ||
        (a.direction === "below" && newPrice <= a.price)
      );
      if (triggered.length === 0) return;
      if ("Notification" in window && Notification.permission === "granted") {
        triggered.forEach((a) => {
          new Notification(`${assetRef.current} Price Alert`, {
            body: `${assetRef.current} $${newPrice.toLocaleString()} is ${a.direction} your alert at $${a.price.toLocaleString()}`,
            icon: "/icons/icon-192.svg",
          });
        });
      }
      setPriceAlerts((prev) =>
        prev.filter((a) =>
          !((a.direction === "above" && newPrice >= a.price) ||
            (a.direction === "below" && newPrice <= a.price))
        )
      );
    }

    // ── Helper: process a single trade tick (shared by WS + fallback) ────
    function processTrade(newPrice: number, qty: number, isBuy: boolean) {
      if (isNaN(newPrice) || isNaN(qty) || newPrice <= 0 || qty <= 0) return;
      const usdValue = newPrice * qty;

      if (prevPriceRef.current !== null && newPrice !== prevPriceRef.current) {
        setPriceDir(newPrice > prevPriceRef.current ? "up" : "down");
        if (priceDirRef.current) clearTimeout(priceDirRef.current);
        priceDirRef.current = setTimeout(() => setPriceDir(""), 600);
      }
      prevPriceRef.current = newPrice;
      priceRef.current = newPrice;
      setPrice(newPrice);
      setSource("live");
      checkAlerts(newPrice);

      const now = Date.now();
      if (seededRef.current && now - lastCloseTimeRef.current >= 2000) {
        accumulatedClosesRef.current = [...accumulatedClosesRef.current, newPrice].slice(-300);
        lastCloseTimeRef.current = now;
        closesRef.current = accumulatedClosesRef.current;
      }
      if (seededRef.current && now - lastIndicatorUpdateRef.current >= 2000) {
        lastIndicatorUpdateRef.current = now;
        recalcIndicators(accumulatedClosesRef.current, newPrice);
      }

      const buf = tradeBufferRef.current;
      buf.push({ time: now, usdValue, isBuy });
      while (buf.length > 0 && buf[0].time < now - TRADE_WINDOW_MS) buf.shift();
      // Hard cap: prevent unbounded growth on extremely active markets
      while (buf.length > 500) buf.shift();
      const buyVol = buf.filter((x) => x.isBuy).reduce((s, x) => s + x.usdValue, 0);
      const sellVol = buf.filter((x) => !x.isBuy).reduce((s, x) => s + x.usdValue, 0);
      setBuyVolume(buyVol); setSellVolume(sellVol);
      buyVolumeRef.current = buyVol; sellVolumeRef.current = sellVol;

      const VWAP_WINDOW = 5 * 60_000;
      const vBuf = vwapBufferRef.current;
      vBuf.push({ time: now, price: newPrice, qty });
      while (vBuf.length > 0 && vBuf[0].time < now - VWAP_WINDOW) vBuf.shift();
      const sumPV = vBuf.reduce((s, x) => s + x.price * x.qty, 0);
      const sumQ = vBuf.reduce((s, x) => s + x.qty, 0);
      const newVwap = sumQ > 0 ? sumPV / sumQ : null;
      setVwap(newVwap); vwapRef.current = newVwap;

      const CVD_WINDOW = 5 * 60_000;
      const cBuf = cvdBufferRef.current;
      cBuf.push({ time: now, delta: isBuy ? usdValue : -usdValue });
      while (cBuf.length > 0 && cBuf[0].time < now - CVD_WINDOW) cBuf.shift();
      const newCvd = cBuf.reduce((s, x) => s + x.delta, 0);
      setCvd5m(newCvd); cvd5mRef.current = newCvd;

      if (usdValue > 50_000) {
        setLargeTrades((prev) => [...prev.slice(-4), { side: isBuy ? "BUY" : "SELL", amount: usdValue, time: now }]);
      }
    }

    // ── Primary WS: Coinbase Advanced Trade (reliable, public, no auth) ──
    let retryCount = 0;

    function connect() {
      setWsStatus("connecting");
      ws = new WebSocket("wss://advanced-trade-ws.coinbase.com");

      ws.onopen = () => {
        if (!active) return;
        // Subscribe to live trades + heartbeat (keeps connection alive)
        ws.send(JSON.stringify({ type: "subscribe", product_ids: [`${asset}-USD`], channel: "market_trades" }));
        ws.send(JSON.stringify({ type: "subscribe", product_ids: [`${asset}-USD`], channel: "heartbeats" }));
        setWsStatus("live");
        retryCount = 0;
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as {
            channel: string;
            events?: { type: string; trades?: { price: string; size: string; side: string }[] }[];
          };
          if (msg.channel !== "market_trades") return;
          for (const evt of msg.events ?? []) {
            for (const trade of evt.trades ?? []) {
              processTrade(parseFloat(trade.price), parseFloat(trade.size), trade.side === "BUY");
            }
          }
        } catch { /* ignore malformed message */ }
      };

      ws.onerror = () => { if (active) setWsStatus("error"); };
      ws.onclose = () => {
        if (!active) return;
        setWsStatus("error");
        retryCount++;
        const delay = Math.min(1500 * Math.pow(2, Math.min(retryCount - 1, 5)), 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    // ── Depth WS: Binance order book imbalance (silent — OB is bonus) ────
    const assetLower = asset.toLowerCase();
    const DEPTH_URLS = [
      `wss://stream.binance.com:9443/ws/${assetLower}usdt@depth20@500ms`,
      `wss://stream.binance.com:443/ws/${assetLower}usdt@depth20@500ms`,
      `wss://stream1.binance.com:9443/ws/${assetLower}usdt@depth20@500ms`,
    ];
    let depthIdx = 0;

    function connectDepth() {
      wsDepth = new WebSocket(DEPTH_URLS[depthIdx % DEPTH_URLS.length]);
      wsDepth.onmessage = (event) => {
        if (!active) return;
        try {
          const d = JSON.parse(event.data) as { bids: [string, string][]; asks: [string, string][] };
          const bidUsd = d.bids.slice(0, 10).reduce((s, [p, q]) => s + parseFloat(p) * parseFloat(q), 0);
          const askUsd = d.asks.slice(0, 10).reduce((s, [p, q]) => s + parseFloat(p) * parseFloat(q), 0);
          const total = bidUsd + askUsd;
          if (total > 0) { const imb = bidUsd / total; setObImbalance(imb); obImbalanceRef.current = imb; }
        } catch { /* ignore */ }
      };
      wsDepth.onerror = () => { /* silent */ };
      wsDepth.onclose = () => {
        if (!active) return;
        depthIdx++;
        reconnectDepthTimer = setTimeout(connectDepth, 10_000);
      };
    }

    // ── Futures WS: Binance liquidations (silent — bonus data) ───────────
    function connectFutures() {
      wsFutures = new WebSocket(`wss://fstream.binance.com/stream?streams=${assetLower}usdt@forceOrder`);
      wsFutures.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as { stream: string; data: { o: { S: string; q: string; ap?: string; p?: string } } };
          if (!msg.stream?.includes("forceOrder")) return;
          const qty = parseFloat(msg.data.o.q);
          const liqPrice = parseFloat(msg.data.o.ap ?? msg.data.o.p ?? "0");
          if (!liqPrice || liqPrice <= 0) return;
          const usdAmt = qty * liqPrice;
          if (usdAmt > 100_000) {
            const side: "LONG" | "SHORT" = msg.data.o.S === "SELL" ? "LONG" : "SHORT";
            const entry = { side, amount: usdAmt, price: liqPrice, time: Date.now() };
            liquidationsRef.current = [...liquidationsRef.current.slice(-9), entry];
            setLiquidations([...liquidationsRef.current]);
          }
        } catch { /* ignore */ }
      };
      wsFutures.onerror = () => { /* silent */ };
      wsFutures.onclose = () => { if (active) reconnectFuturesTimer = setTimeout(connectFutures, 5000); };
    }

    connect();
    connectDepth();
    connectFutures();
    return () => {
      active = false;
      ws?.close(); wsDepth?.close(); wsFutures?.close();
      clearTimeout(reconnectTimer); clearTimeout(reconnectDepthTimer); clearTimeout(reconnectFuturesTimer);
      if (priceDirRef.current) clearTimeout(priceDirRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // ── Market intel poll (30s): seed + F&G, funding, OI, P/C, events ────
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function fetchIntel() {
      try {
        const res = await fetch(`/api/${asset.toLowerCase()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          price?: number; closes?: number[];
          fearGreed?: { value: number; label: string } | null;
          fundingRate?: number | null; change24h?: number | null;
          volume24h?: number | null; high24h?: number | null; low24h?: number | null;
          openInterest?: number | null; pcRatio?: number | null;
          upcomingEvents?: { title: string; minutesUntil: number }[];
        };
        if (!active) return;

        // Seed historical closes once
        if (!seededRef.current && data.closes && data.closes.length > 1) {
          accumulatedClosesRef.current = [...data.closes];
          seededRef.current = true;
          closesRef.current = accumulatedClosesRef.current;
          lastCloseTimeRef.current = Date.now();
          lastIndicatorUpdateRef.current = Date.now();
          const p = data.price ?? data.closes.at(-1) ?? 0;
          if (p) recalcIndicatorsStatic(data.closes, p);
        }

        if (data.fearGreed !== undefined) setFearGreed(data.fearGreed ?? null);
        if (data.fundingRate !== undefined) setFundingRate(data.fundingRate ?? null);
        if (data.change24h !== undefined) setChange24h(data.change24h ?? null);
        if (data.volume24h !== undefined) setVolume24h(data.volume24h ?? null);
        if (data.high24h !== undefined) setHigh24h(data.high24h ?? null);
        if (data.low24h !== undefined) setLow24h(data.low24h ?? null);
        if (data.openInterest !== undefined) {
          const newOI = data.openInterest ?? null;
          setOpenInterest(newOI);
          openInterestRef.current = newOI;
          if (newOI !== null && prevOpenInterestRef.current !== null) {
            const delta = newOI - prevOpenInterestRef.current;
            setOiDelta(delta);
            oiDeltaRef.current = delta;
          }
          prevOpenInterestRef.current = newOI;
        }
        if (data.pcRatio !== undefined) { setPcRatio(data.pcRatio ?? null); pcRatioRef.current = data.pcRatio ?? null; }
        if (data.upcomingEvents !== undefined) { setUpcomingEvents(data.upcomingEvents ?? []); upcomingEventsRef.current = data.upcomingEvents ?? []; }
      } catch { /* ignore */ } finally {
        if (active) timer = setTimeout(fetchIntel, 15_000);
      }
    }

    // Shared indicator recalc used by the seed (no closure issues since only reads refs/calls stable setters)
    function recalcIndicatorsStatic(history: number[], p: number) {
      const e9 = calcEMA(history, 9);
      const e21 = calcEMA(history, 21);
      const r = calcRSI(history);
      const mc = calcMACD(history);
      const b = calcBollingerBands(history);
      const wb = calcWindowBias(history);
      const ms = calcMomentumScore(r, mc, b, e9, e21, wb);
      const at = calcATR(history);
      const sr = calcStochRSI(history);
      const reg = detectMarketRegime(e9, e21, b, at, p);
      setCloses([...history]);
      setEma9(e9);          setEma21(e21);
      setRsi(r);            setMacd(mc);
      setBb(b);             setWindowBias(wb);
      setMomentumScore(ms); setAtr(at);
      setStochRsi(sr);      setMarketRegime(reg);
      ema9Ref.current = e9;  ema21Ref.current = e21;
      rsiRef.current = r;    macdRef.current = mc;
      bbRef.current = b;     windowBiasRef.current = wb;
      atrRef.current = at;   stochRsiRef.current = sr;
      marketRegimeRef.current = reg;
    }

    fetchIntel();
    return () => { active = false; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // ── REST price fallback: Coinbase via /api/{asset} when WS is down ──────
  useEffect(() => {
    if (wsStatus === "live") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function pollPrice() {
      try {
        const res = await fetch(`/api/${asset.toLowerCase()}`);
        if (!res.ok || !active) return;
        const data = await res.json() as { price?: number };
        if (!data.price || !active) return;
        const newPrice = data.price;

        if (prevPriceRef.current !== null && newPrice !== prevPriceRef.current) {
          setPriceDir(newPrice > prevPriceRef.current ? "up" : "down");
          if (priceDirRef.current) clearTimeout(priceDirRef.current);
          priceDirRef.current = setTimeout(() => setPriceDir(""), 600);
        }
        prevPriceRef.current = newPrice;
        priceRef.current = newPrice;
        setPrice(newPrice);
        setSource("live");

        // Keep closes + indicators fresh while WS is down
        if (seededRef.current) {
          const now = Date.now();
          if (now - lastCloseTimeRef.current >= 5000) {
            accumulatedClosesRef.current = [...accumulatedClosesRef.current, newPrice].slice(-300);
            lastCloseTimeRef.current = now;
            closesRef.current = accumulatedClosesRef.current;
            // Recalc indicators inline
            const hist = accumulatedClosesRef.current;
            const e9 = calcEMA(hist, 9); const e21 = calcEMA(hist, 21);
            const r = calcRSI(hist); const mc = calcMACD(hist);
            const b = calcBollingerBands(hist); const wb = calcWindowBias(hist);
            const at = calcATR(hist); const sr = calcStochRSI(hist);
            const reg = detectMarketRegime(e9, e21, b, at, newPrice);
            setCloses([...hist]);
            setEma9(e9); setEma21(e21); setRsi(r); setMacd(mc);
            setBb(b); setWindowBias(wb); setAtr(at); setStochRsi(sr); setMarketRegime(reg);
            setMomentumScore(calcMomentumScore(r, mc, b, e9, e21, wb));
            ema9Ref.current = e9; ema21Ref.current = e21; rsiRef.current = r;
            macdRef.current = mc; bbRef.current = b; windowBiasRef.current = wb;
            atrRef.current = at; stochRsiRef.current = sr; marketRegimeRef.current = reg;
          }
        }

        // Price alerts
        const triggered = priceAlertsRef.current.filter((a) =>
          (a.direction === "above" && newPrice >= a.price) ||
          (a.direction === "below" && newPrice <= a.price)
        );
        if (triggered.length > 0) {
          if ("Notification" in window && Notification.permission === "granted") {
            triggered.forEach((a) => new Notification(`${assetRef.current} Price Alert`, {
              body: `${assetRef.current} $${newPrice.toLocaleString()} is ${a.direction} your alert at $${a.price.toLocaleString()}`,
              icon: "/icons/icon-192.svg",
            }));
          }
          setPriceAlerts((prev) => prev.filter((a) =>
            !((a.direction === "above" && newPrice >= a.price) ||
              (a.direction === "below" && newPrice <= a.price))
          ));
        }
      } catch { /* ignore */ } finally {
        if (active) timer = setTimeout(pollPrice, 5_000);
      }
    }

    pollPrice();
    return () => { active = false; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus, asset]);

  // ── Kalshi wall-clock countdown + auto-predict on new window ──────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const newLabel = getNextKalshiExpiryLabel();
      setExpirySeconds(getSecondsToNextKalshi());
      setExpiryLabel(newLabel);

      // Detect window rollover: auto-run prediction for the new window
      if (
        prevExpiryWindowRef.current !== newLabel &&
        targetRef.current &&
        !isNaN(parseFloat(targetRef.current)) &&
        !loadingRef.current &&
        priceRef.current !== null
      ) {
        prevExpiryWindowRef.current = newLabel;
        runPredictionInternal(true);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Resolve pending history entries once expiry passes ────────────────
  useEffect(() => {
    if (!price) return;
    setPredHistory((prev) =>
      prev.map((entry) => {
        if (entry.outcome !== "PENDING") return entry;
        // Resolve if the expiry window has passed
        if (Date.now() > entry.timestamp + 15 * 60 * 1000 + 5000) {
          const outcome =
            (entry.verdict === "ABOVE" && price > entry.strike) ||
            (entry.verdict === "BELOW" && price < entry.strike)
              ? "WIN"
              : "LOSS";
          return { ...entry, outcome, exitPrice: price };
        }
        return entry;
      })
    );
  }, [price]);

  // ── Auto-predict when user types a valid target price ────────────────
  const autoPredictDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const num = parseFloat(target);
    const minStrike = asset === "ETH" ? 100 : 1_000;
    const maxStrike = asset === "ETH" ? 100_000 : 1_000_000;
    if (!target || isNaN(num) || num < minStrike || num > maxStrike || !price) return;
    if (autoPredictDebounceRef.current) clearTimeout(autoPredictDebounceRef.current);
    autoPredictDebounceRef.current = setTimeout(() => {
      // Skip if a prediction is already running (avoids duplicate in-flight requests)
      if (loadingRef.current) return;
      runPredictionInternal();
    }, 2000);
    return () => {
      if (autoPredictDebounceRef.current) clearTimeout(autoPredictDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, price, asset]);

  // ── Core prediction logic (shared by button + auto) ───────────────────
  async function runPredictionInternal(isAuto = false) {
    const t = targetRef.current;
    const p = priceRef.current;
    if (!p || !t || isNaN(parseFloat(t))) return;

    // ── Circuit breaker: auto-PASS after 3+ consecutive losses ───────────
    const settledNow = predHistory.filter((e) => e.outcome !== "PENDING");
    let recentStreak = 0;
    for (let i = settledNow.length - 1; i >= 0; i--) {
      if (settledNow[i].outcome === "LOSS") recentStreak++;
      else break;
    }
    if (recentStreak >= 3) {
      setResult({
        verdict: "PASS",
        confidence: 0,
        reasoning: [
          `⚡ CIRCUIT BREAKER ACTIVE — ${recentStreak} consecutive losses detected.`,
          "Capital preservation mode: all trades blocked until streak resets.",
          "Take a break, reassess market conditions, then clear history to resume.",
        ],
        ev: 0,
        kelly: 0,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setResult(null);
    setMlResult(null);
    setPredError(null);

    const currentEma9 = ema9Ref.current;
    const currentEma21 = ema21Ref.current;
    const currentRsi = rsiRef.current;
    const currentMacd = macdRef.current;
    const currentBb = bbRef.current;
    const currentWindowBias = windowBiasRef.current;
    const currentCloses = closesRef.current;

    try {
      const events = upcomingEventsRef.current;
      const imminentEvents = events.filter((e) => e.minutesUntil <= 15).map((e) => e.title);
      const buyVol = buyVolumeRef.current;
      const sellVol = sellVolumeRef.current;
      const totalFlow = buyVol + sellVol;
      // Clamp to valid ranges to prevent schema rejection from floating-point edge cases
      const rawBuyDelta = totalFlow > 0 ? (buyVol / totalFlow) * 100 : null;
      const buyDelta = rawBuyDelta != null ? Math.max(0, Math.min(100, rawBuyDelta)) : null;
      const rawObImbalance = obImbalanceRef.current;
      const safeObImbalance = rawObImbalance != null && isFinite(rawObImbalance)
        ? Math.max(0, Math.min(1, rawObImbalance)) : null;

      const recentLiqs = liquidationsRef.current.slice(-5).map((l) => ({
        side: l.side, amount: l.amount, price: l.price,
      }));

      // Compute large trade counts from the 60s rolling buffer (already tracks isBuy + usdValue)
      const LARGE_THRESHOLD = 50_000;
      const largeBuysCount = tradeBufferRef.current.filter((x) => x.isBuy && x.usdValue > LARGE_THRESHOLD).length;
      const largeSellsCount = tradeBufferRef.current.filter((x) => !x.isBuy && x.usdValue > LARGE_THRESHOLD).length;

      // Ensure closes is never empty — seed with current price as fallback
      const safeCloses = currentCloses.length > 0 ? currentCloses.slice(-30) : [p];

      // Fire ML prediction in parallel — best-effort, never blocks main result
      void fetch(`/api/ml?target=${encodeURIComponent(t)}&price=${encodeURIComponent(String(p))}`)
        .then((r) => r.json())
        .then((d: MLPredictionResult & { error?: string }) => { if (!d.error) setMlResult(d); })
        .catch(() => { /* ML backend offline — silently ignore */ });

      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: assetRef.current,
          price: p,
          ema9: currentEma9,
          ema21: currentEma21,
          rsi: currentRsi,
          macd: currentMacd,
          bb: currentBb,
          windowBias: currentWindowBias,
          closes: safeCloses,
          target: t,
          expiryLabel: getNextKalshiExpiryLabel(),
          secondsToExpiry: getSecondsToNextKalshi(),
          fearGreed: fearGreedRef.current,
          fundingRate: fundingRateRef.current,
          change24h: change24hRef.current,
          openInterest: openInterestRef.current,
          openInterestDelta: oiDeltaRef.current,
          atr: atrRef.current,
          stochRsi: stochRsiRef.current,
          marketRegime: marketRegimeRef.current,
          obImbalance: safeObImbalance,
          buyDelta,
          largeBuys: largeBuysCount,
          largeSells: largeSellsCount,
          pcRatio: pcRatioRef.current,
          eventsImminent: imminentEvents.length > 0 ? imminentEvents : null,
          vwap: vwapRef.current,
          cvd5m: cvd5mRef.current,
          session: getCurrentSession().name,
          recentLiquidations: recentLiqs.length > 0 ? recentLiqs : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      const pred = data as PredictionResult;
      setResult(pred);

      // Sound alert on result
      if (soundEnabledRef.current) {
        if (pred.verdict === "ABOVE") playBeep(880, 120, 0.1);
        else if (pred.verdict === "BELOW") playBeep(440, 120, 0.1);
        else playBeep(660, 80, 0.06); // PASS
      }

      // Push notification for auto-predict only (window boundary rollover)
      if (isAuto && "Notification" in window && Notification.permission === "granted" && pred.verdict !== "PASS") {
        new Notification(`BTC Oracle: ${pred.verdict}`, {
          body: `Strike $${parseFloat(t).toLocaleString()} · ${pred.confidence}% confidence · EV ${pred.ev >= 0 ? "+" : ""}${pred.ev}%`,
          icon: "/icons/icon-192.svg",
        });
      }

      // Only log to history if we actually took a position (not PASS)
      if (pred.verdict !== "PASS") {
        const entry: PredictionHistoryEntry = {
          verdict: pred.verdict as "ABOVE" | "BELOW",
          confidence: pred.confidence,
          strike: parseFloat(t),
          priceAtPrediction: p,
          expiryLabel: getNextKalshiExpiryLabel(),
          timestamp: Date.now(),
          outcome: "PENDING",
        };
        setPredHistory((prev) => [...prev.slice(-9), entry]);

        // Add to signals
        const newSignal = {
          id: `sig-${Date.now()}`,
          timestamp: Date.now(),
          verdict: pred.verdict as "ABOVE" | "BELOW",
          confidence: pred.confidence,
          strike: parseFloat(t),
          price: p,
          expiryLabel: getNextKalshiExpiryLabel(),
          status: "ACTIVE" as const,
        };
        setSignals((prev) => [...prev.slice(-19), newSignal]);
      }
    } catch (err) {
      setPredError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  const runPrediction = () => runPredictionInternal();

  // ── Instant local trajectory analysis (no API — runs in <1ms) ────────
  const quickRead = useMemo((): TrajectoryResult | null => {
    const t = parseFloat(target);
    if (!target || isNaN(t) || t <= 0 || !price) return null;
    const totalFlow = buyVolume + sellVolume;
    const buyDelta  = totalFlow > 0 ? (buyVolume / totalFlow) * 100 : null;
    const analyzer  = new BTCTrajectoryAnalyzer();
    return analyzer.analyze({
      price,
      target: t,
      secondsToExpiry: expirySeconds,
      closes,
      rsi,
      macd,
      bb,
      ema9,
      ema21,
      atr,
      stochRsi,
      obImbalance,
      buyDelta,
      cvd5m,
      largeBuys:  largeTrades.filter((x) => x.side === "BUY").length,
      largeSells: largeTrades.filter((x) => x.side === "SELL").length,
      fearGreed,
      fundingRate,
      vwap,
      marketRegime,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    target, price, expirySeconds,
    // primitive deps to avoid stale re-renders from object references
    rsi, macd?.histogram, bb?.pctB, ema9, ema21, atr, stochRsi?.k,
    obImbalance, buyVolume, sellVolume, cvd5m,
    fearGreed?.value, fundingRate, vwap, marketRegime,
    largeTrades.length,
    // closes.length triggers re-analysis as new candles arrive
    closes.length,
  ]);

  // ── Derived display values ────────────────────────────────────────────
  const priceColor =
    priceDir === "up" ? "var(--neon-green)" : priceDir === "down" ? "var(--neon-red)" : "var(--cyan)";

  const timerPct = (expirySeconds / (15 * 60)) * 100;
  const timerColor =
    timerPct > 50 ? "var(--neon-green)" : timerPct > 25 ? "var(--amber)" : "var(--neon-red)";

  const dotColor =
    wsStatus === "live" ? "var(--neon-green)" : source === "live" ? "var(--amber)" : "var(--amber)";

  const dollarKelly = bankroll && result && result.verdict !== "PASS" && result.kelly > 0
    ? (result.kelly / 100) * bankroll : null;

  const wins = predHistory.filter((e) => e.outcome === "WIN").length;
  const settled = predHistory.filter((e) => e.outcome !== "PENDING").length;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : null;

  // ── Risk awareness ────────────────────────────────────────────────────
  const settledHistory = predHistory.filter((e) => e.outcome !== "PENDING");

  // Consecutive loss streak
  let recentLossStreak = 0;
  for (let i = settledHistory.length - 1; i >= 0; i--) {
    if (settledHistory[i].outcome === "LOSS") recentLossStreak++;
    else break;
  }
  const circuitBreakerActive = recentLossStreak >= 3;

  // Session P&L (sim: $9 win / -$10 loss — Kalshi ~90% payout)
  const sessionPnL = settledHistory.reduce((acc, e) => acc + (e.outcome === "WIN" ? 9 : -10), 0);

  // Danger zone: RSI at extremes AND elevated volatility
  const rsiExtreme = rsi !== null && (rsi >= 78 || rsi <= 22);
  const highVol = atr !== null && price !== null && (atr / price) > 0.005;
  const inDangerZone = rsiExtreme && highVol;

  return (
    <main className="min-h-screen flex items-start justify-center p-4 pt-6 scanline-overlay" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-2xl flex flex-col gap-3">

        {/* ── Asset tab + Header bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {(["BTC", "ETH"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className="flex-1 py-2 px-4 text-xs font-bold transition-all"
                style={{
                  fontFamily: "inherit",
                  letterSpacing: "0.12em",
                  background: asset === a ? "rgba(0,255,231,0.1)" : "var(--surface)",
                  color: asset === a ? "var(--cyan)" : "var(--muted-foreground)",
                  borderRight: a === "BTC" ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                }}
              >
                {a} / USD
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {winRate !== null && (
              <div className="flex flex-col items-end">
                <span style={{ color: "var(--muted-foreground)", fontSize: "9px", letterSpacing: "0.06em" }}>WIN RATE</span>
                <span className="font-bold tabular-nums" style={{
                  color: winRate >= 60 ? "var(--neon-green)" : winRate >= 45 ? "var(--amber)" : "var(--neon-red)",
                  fontSize: "14px",
                }}>
                  {winRate}%
                </span>
              </div>
            )}
            <button
              onClick={() => setSoundEnabled((v) => { soundEnabledRef.current = !v; return !v; })}
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              className="px-2.5 py-1.5 rounded-lg transition-all"
              style={{ background: soundEnabled ? "rgba(0,255,231,0.1)" : "var(--surface-2)", border: `1px solid ${soundEnabled ? "var(--cyan)" : "var(--border)"}`, color: soundEnabled ? "var(--cyan)" : "var(--muted-foreground)", fontSize: "10px", fontFamily: "inherit", cursor: "pointer", lineHeight: 1, letterSpacing: "0.04em", fontWeight: 700 }}
            >
              {soundEnabled ? "SND ON" : "SND OFF"}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="status-dot relative" data-live={source === "live" ? "true" : undefined} style={{ background: dotColor }} />
              <span style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.06em" }}>
                {wsStatus === "live" ? "LIVE DATA" : source === "live" ? "BACKUP FEED" : "CONNECTING..."}
              </span>
            </div>
          </div>
        </div>

        {/* ── App title with gradient ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="gradient-text font-black" style={{ fontSize: "14px", letterSpacing: "0.2em" }}>
            {asset} BINARY ORACLE
          </h1>
          <div className="flex items-center gap-2">
            {(() => {
              const sess = getCurrentSession();
              return (
                <span className="px-2 py-0.5 rounded font-bold" style={{ background: `${sess.color}18`, border: `1px solid ${sess.color}40`, color: sess.color, fontSize: "9px", letterSpacing: "0.08em" }}>
                  {sess.name}
                </span>
              );
            })()}
          </div>
        </div>

        {/* ── Tab navigation ──────────────────────────────────────────────── */}
        <DashboardTabs active={activeTab} onChange={setActiveTab} />

        {/* ── TAB CONTENT: DASHBOARD ─────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-3 tab-content-enter">
            {/* Price hero + countdown */}
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <PriceHero asset={asset} price={price} priceDir={priceDir} change24h={change24h} verdict={result?.verdict ?? null} />
              </div>
              <CountdownRing seconds={expirySeconds} label="EXPIRES" />
            </div>

            {/* Kalshi 15-min timer */}
            <KXBTC15MTimer />

            {/* Window bias + regime */}
            {windowBias !== null && (
              <div className="glass-card px-3 py-2 flex items-center gap-3">
                <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>WINDOW BIAS</span>
                <span className="font-bold tabular-nums" style={{
                  fontSize: "12px",
                  color: windowBias > 55 ? "var(--neon-green)" : windowBias < 45 ? "var(--neon-red)" : "var(--amber)",
                }}>
                  {windowBias.toFixed(0)}% UP ({closes.length} ticks)
                </span>
                <MarketRegimeBadge regime={marketRegime} size="sm" />
              </div>
            )}

            {/* Live chart */}
            <LiveChartPanel closes={closes} ema9={ema9} ema21={ema21} bb={bb} price={price} height={220} />

            {/* Sparkline fallback */}
            <div className="glass-card p-3">
              <Sparkline prices={closes} height={48} />
            </div>

            {/* Real-time forecast display */}
            <ForecastDisplay />

            {/* Bets ledger */}
            <BetsLedger />
          </div>
        )}

        {/* ── TAB CONTENT: OPTIMIZER ─────────────────────────────────────────── */}
        {activeTab === "optimizer" && (
          <div className="tab-content-enter">
            <AIOptimizerPanel
              regime={marketRegime}
              regimeConfidence={null}
              models={[
                { name: "Trajectory", accuracy: 65, weight: 25, verdict: result?.verdict ?? "PASS", confidence: result?.confidence ?? 50 },
                { name: "Order Book", accuracy: 58, weight: 20, verdict: result?.verdict ?? "PASS", confidence: result?.confidence ?? 50 },
                { name: "Technical", accuracy: 62, weight: 25, verdict: result?.verdict ?? "PASS", confidence: result?.confidence ?? 50 },
                { name: "ML LightGBM", accuracy: 70, weight: 30, verdict: mlResult?.verdict ?? "PASS", confidence: mlResult?.confidence === "HIGH" ? 85 : mlResult?.confidence === "MEDIUM" ? 65 : 45 },
              ]}
              features={[
                { feature: "RSI", importance: rsi !== null ? (rsi > 70 || rsi < 30 ? 0.85 : 0.4) : 0.5 },
                { feature: "MACD", importance: macd !== null ? Math.abs(macd.histogram) / 0.01 : 0.3 },
                { feature: "BB %B", importance: bb !== null ? Math.abs(bb.pctB - 0.5) * 2 : 0.4 },
                { feature: "Flow", importance: obImbalance !== null ? Math.abs(obImbalance) / 0.1 : 0.3 },
                { feature: "Funding", importance: fundingRate !== null ? Math.abs(fundingRate) / 0.001 : 0.2 },
              ]}
              rlEnabled={rlEnabled}
              onToggleRL={setRlEnabled}
              ensembleAccuracy={winRate}
              totalPredictions={predHistory.length}
              sharpeRatio={null}
              maxDrawdown={null}
              autoOptimizing={rlEnabled}
            />
          </div>
        )}

        {/* ── TAB CONTENT: TRADE (existing prediction UI) ─────────────────── */}
        {activeTab === "trade" && (
          <div className="flex flex-col gap-3 tab-content-enter">
            {/* Trade controls */}
            <TradeControls currentPrice={price ?? 0} />

            {/* Prediction input */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>TARGET PRICE</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={price !== null ? String(price) : "---"}
                  className="flex-1 px-3 py-2 rounded-lg font-bold tabular-nums"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                    fontSize: "14px",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={runPrediction}
                  disabled={loading || price === null}
                  className="px-4 py-2 rounded-lg font-bold transition-all"
                  style={{
                    background: loading ? "var(--surface-2)" : "rgba(0,255,231,0.1)",
                    border: `1px solid ${loading ? "var(--border)" : "var(--cyan)"}`,
                    color: loading ? "var(--muted-foreground)" : "var(--cyan)",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "ANALYZING..." : "PREDICT"}
                </button>
              </div>
              {targetError && (
                <p style={{ color: "var(--neon-red)", fontSize: "10px", marginTop: "8px" }}>{targetError}</p>
              )}
            </div>

            {/* Verdict hero */}
            {result && (
              <VerdictHero
                verdict={result.verdict}
                confidence={result.confidence}
                ev={result.ev}
                kelly={result.kelly}
                reasoning={result.reasoning}
                modelVotes={result.modelVotes}
                modelAgreement={result.modelAgreement}
              />
            )}

            {/* Bankroll */}
            <KalshiBankrollPanel
              bankroll={bankroll}
              predHistory={predHistory}
              onReset={() => {
                setBankroll(1000);
                localStorage.setItem("btc-bankroll", "1000");
              }}
            />

            {/* Prediction history */}
            <PredictionHistory history={predHistory} />
          </div>
        )}

        {/* ── TAB CONTENT: ALERTS & SETTINGS ───────────────────────────────── */}
        {activeTab === "alerts" && (
          <div className="flex flex-col gap-3 tab-content-enter">
            <PriceAlertManager
              alerts={priceAlerts}
              alertInput={alertInput}
              currentPrice={price}
              onInputChange={setAlertInput}
              onAdd={(p, d) => setPriceAlerts((prev) => [...prev, { price: p, direction: d }])}
              onRemove={(i) => setPriceAlerts((prev) => prev.filter((_, idx) => idx !== i))}
              notifPermission={notifPermission}
              onRequestPermission={() => {
                if ("Notification" in window) {
                  Notification.requestPermission().then((p) => setNotifPermission(p));
                }
              }}
            />
            <SettingsPanel
              aggressiveness={aggressiveness}
              onAggressivenessChange={setAggressiveness}
              alertThreshold={alertThreshold}
              onAlertThresholdChange={setAlertThreshold}
              showExplainability={showExplainability}
              onShowExplainabilityChange={setShowExplainability}
              compactMode={compactMode}
              onCompactModeChange={setCompactMode}
            />
          </div>
        )}

        {/* ── TAB CONTENT: ANALYSIS (keep existing panels) ─────────────────── */}
        {activeTab === "analysis" && (
          <div className="flex flex-col gap-3 tab-content-enter">
            {/* Existing market intel panels */}
            <KalshiMarketPanel
              target={target}
              price={price}
              predictionResult={result}
              bankroll={bankroll}
              onTargetChange={setTarget}
            />
            <SignalEnginePanel
              signals={signals}
              onClear={() => setSignals([])}
            />
            <AnalyticsPanel history={predHistory} />
            <CalibrationPanel history={predHistory} />

            {/* Secret diary view */}
            <DiaryView />
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <p className="text-center pb-4" style={{ color: "var(--muted-foreground)", fontSize: "10px", letterSpacing: "0.05em" }}>
          FOR EDUCATIONAL PURPOSES ONLY · NOT FINANCIAL ADVICE
        </p>

      </div>
    </main>
  );
}
