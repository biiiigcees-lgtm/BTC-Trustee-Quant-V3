"use client";

import { useState } from "react";
import { useIndicatorStore } from "@/lib/store";

export function IndicatorConfigPanel() {
  const { config, updateConfig, resetConfig } = useIndicatorStore();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#ffaa00" }} />
            <span className="text-[8px] font-mono uppercase tracking-[0.25em]" style={{ color: "#2a2a3a" }}>
              INDICATOR CONFIG
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[7px] font-mono text-[#3a3a50] hover:text-[#ffaa00] transition-colors"
          >
            {isExpanded ? "COLLAPSE" : "EXPAND"}
          </button>
        </div>

        {/* Config Options */}
        {isExpanded && (
          <div className="flex flex-col gap-3">
            {/* EMA */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ema-enabled"
                  checked={config.ema.enabled}
                  onChange={(e) => updateConfig({ ema: { ...config.ema, enabled: e.target.checked } })}
                  className="w-3 h-3 accent-[#00ff88]"
                />
                <label htmlFor="ema-enabled" className="text-[8px] font-mono text-[#e8e8f0]">
                  EMA
                </label>
              </div>
              {config.ema.enabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={config.ema.period}
                    onChange={(e) => updateConfig({ ema: { ...config.ema, period: Number.parseInt(e.target.value, 10) } })}
                    className="w-12 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a", color: "#00ff88" }}
                    aria-label="EMA period"
                  />
                  <input
                    type="color"
                    value={config.ema.color}
                    onChange={(e) => updateConfig({ ema: { ...config.ema, color: e.target.value } })}
                    className="w-4 h-4 rounded cursor-pointer"
                    aria-label="EMA color"
                  />
                </div>
              )}
            </div>

            {/* SMA */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sma-enabled"
                  checked={config.sma.enabled}
                  onChange={(e) => updateConfig({ sma: { ...config.sma, enabled: e.target.checked } })}
                  className="w-3 h-3 accent-[#4488ff]"
                />
                <label htmlFor="sma-enabled" className="text-[8px] font-mono text-[#e8e8f0]">
                  SMA
                </label>
              </div>
              {config.sma.enabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={config.sma.period}
                    onChange={(e) => updateConfig({ sma: { ...config.sma, period: Number.parseInt(e.target.value, 10) } })}
                    className="w-12 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a", color: "#4488ff" }}
                    aria-label="SMA period"
                  />
                  <input
                    type="color"
                    value={config.sma.color}
                    onChange={(e) => updateConfig({ sma: { ...config.sma, color: e.target.value } })}
                    className="w-4 h-4 rounded cursor-pointer"
                    aria-label="SMA color"
                  />
                </div>
              )}
            </div>

            {/* RSI */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rsi-enabled"
                  checked={config.rsi.enabled}
                  onChange={(e) => updateConfig({ rsi: { ...config.rsi, enabled: e.target.checked } })}
                  className="w-3 h-3 accent-[#ffaa00]"
                />
                <label htmlFor="rsi-enabled" className="text-[8px] font-mono text-[#e8e8f0]">
                  RSI
                </label>
              </div>
              {config.rsi.enabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={config.rsi.period}
                    onChange={(e) => updateConfig({ rsi: { ...config.rsi, period: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="RSI period"
                  />
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={config.rsi.overbought}
                    onChange={(e) => updateConfig({ rsi: { ...config.rsi, overbought: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="RSI overbought threshold"
                  />
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={config.rsi.oversold}
                    onChange={(e) => updateConfig({ rsi: { ...config.rsi, oversold: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="RSI oversold threshold"
                  />
                </div>
              )}
            </div>

            {/* Bollinger */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bollinger-enabled"
                  checked={config.bollinger.enabled}
                  onChange={(e) => updateConfig({ bollinger: { ...config.bollinger, enabled: e.target.checked } })}
                  className="w-3 h-3 accent-[#ffaa00]"
                />
                <label htmlFor="bollinger-enabled" className="text-[8px] font-mono text-[#e8e8f0]">
                  Bollinger
                </label>
              </div>
              {config.bollinger.enabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={config.bollinger.period}
                    onChange={(e) => updateConfig({ bollinger: { ...config.bollinger, period: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="Bollinger period"
                  />
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={0.1}
                    value={config.bollinger.multiplier}
                    onChange={(e) => updateConfig({ bollinger: { ...config.bollinger, multiplier: Number.parseFloat(e.target.value) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="Bollinger multiplier"
                  />
                </div>
              )}
            </div>

            {/* MACD */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="macd-enabled"
                  checked={config.macd.enabled}
                  onChange={(e) => updateConfig({ macd: { ...config.macd, enabled: e.target.checked } })}
                  className="w-3 h-3 accent-[#ff66cc]"
                />
                <label htmlFor="macd-enabled" className="text-[8px] font-mono text-[#e8e8f0]">
                  MACD
                </label>
              </div>
              {config.macd.enabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={config.macd.fast}
                    onChange={(e) => updateConfig({ macd: { ...config.macd, fast: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="MACD fast period"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.macd.slow}
                    onChange={(e) => updateConfig({ macd: { ...config.macd, slow: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="MACD slow period"
                  />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.macd.signal}
                    onChange={(e) => updateConfig({ macd: { ...config.macd, signal: Number.parseInt(e.target.value, 10) } })}
                    className="w-8 px-1 py-0.5 text-[8px] font-mono bg-transparent border rounded"
                    style={{ borderColor: "#2a2a3a" }}
                    aria-label="MACD signal period"
                  />
                </div>
              )}
            </div>

            {/* Volume */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="volume-enabled"
                  checked={config.volume.enabled}
                  onChange={(e) => updateConfig({ volume: { ...config.volume, enabled: e.target.checked } })}
                  className="w-3 h-3 accent-[#3b82f6]"
                />
                <label htmlFor="volume-enabled" className="text-[8px] font-mono text-[#e8e8f0]">
                  Volume
                </label>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetConfig}
              className="text-[7px] font-mono text-[#ff4466] hover:text-[#ff6688] transition-colors mt-2"
            >
              RESET DEFAULTS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
