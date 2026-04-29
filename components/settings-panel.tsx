"use client";

import { useEffect } from "react";

type Aggressiveness = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";

interface SettingsPanelProps {
  readonly aggressiveness: Aggressiveness;
  readonly alertThreshold: number;
  readonly showExplainability: boolean;
  readonly compactMode: boolean;
  readonly onAggressivenessChange: (value: Aggressiveness) => void;
  readonly onAlertThresholdChange: (value: number) => void;
  readonly onShowExplainabilityChange: (value: boolean) => void;
  readonly onCompactModeChange: (value: boolean) => void;
}

const STORAGE_KEY = "btc-oracle-settings";

const aggressivenessConfig: Record<Aggressiveness, { readonly color: string; readonly bg: string; readonly border: string; readonly desc: string }> = {
  CONSERVATIVE: {
    color: "#3a3a50",
    bg: "#08080f",
    border: "#141420",
    desc: "Lower risk, wider stops, fewer signals",
  },
  MODERATE: {
    color: "#ffaa00",
    bg: "#ffaa0012",
    border: "#ffaa0066",
    desc: "Balanced approach, standard thresholds",
  },
  AGGRESSIVE: {
    color: "#ff4466",
    bg: "#ff446612",
    border: "#ff446666",
    desc: "Higher risk, tighter stops, more signals",
  },
};

export function SettingsPanel({
  aggressiveness,
  alertThreshold,
  showExplainability,
  compactMode,
  onAggressivenessChange,
  onAlertThresholdChange,
  onShowExplainabilityChange,
  onCompactModeChange,
}: SettingsPanelProps) {
  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try {
      const settings = JSON.stringify({ aggressiveness, alertThreshold, showExplainability, compactMode });
      localStorage.setItem(STORAGE_KEY, settings);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [aggressiveness, alertThreshold, showExplainability, compactMode]);

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
              SETTINGS
            </span>
          </div>
        </div>

        {/* Aggressiveness Selector */}
        <div>
          <div className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider mb-2">
            Aggressiveness
          </div>
          <div className="flex gap-1">
            {(Object.keys(aggressivenessConfig) as Aggressiveness[]).map((level) => {
              const config = aggressivenessConfig[level];
              const isActive = aggressiveness === level;
              return (
                <button
                  key={level}
                  onClick={() => onAggressivenessChange(level)}
                  className="flex-1 px-2 py-1.5 rounded text-[8px] font-mono font-bold border transition-all"
                  style={{
                    color: isActive ? config.color : "#3a3a50",
                    borderColor: isActive ? config.border : "#141420",
                    background: isActive ? config.bg : "#08080f",
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>
          <div className="text-[8px] font-mono text-[#3a3a50] mt-1">
            {aggressivenessConfig[aggressiveness].desc}
          </div>
        </div>

        {/* Alert Threshold Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="alert-threshold" className="text-[7px] font-mono text-[#2a2a3a] uppercase tracking-wider">
              Alert Threshold
            </label>
            <span className="text-[9px] font-mono text-[#8888aa]">{alertThreshold}%</span>
          </div>
          <input
            id="alert-threshold"
            type="range"
            min={40}
            max={95}
            value={alertThreshold}
            onChange={(e) => onAlertThresholdChange(Number.parseInt(e.target.value, 10))}
            aria-label="Alert threshold percentage"
            title="Alert threshold"
            className="w-full h-1 appearance-none rounded-full accent-[#ffaa00]"
            style={{ background: "#1a1a2a" }}
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showExplainability}
              onChange={(e) => onShowExplainabilityChange(e.target.checked)}
              className="accent-[#4488ff]"
            />
            <span className="text-[9px] font-mono text-[#8888aa]">Show Explainability</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => onCompactModeChange(e.target.checked)}
              className="accent-[#4488ff]"
            />
            <span className="text-[9px] font-mono text-[#8888aa]">Compact Mode</span>
          </label>
        </div>
      </div>
    </div>
  );
}
