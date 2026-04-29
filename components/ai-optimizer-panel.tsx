"use client";

import { motion } from "framer-motion";
import { Brain, TrendingUp, Target, Zap, BarChart3, Activity } from "lucide-react";

interface ModelPerformance {
  name: string;
  accuracy: number;
  weight: number;
  verdict: "ABOVE" | "BELOW" | "PASS";
  confidence: number;
}

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface AIOptimizerPanelProps {
  regime: string | null;
  regimeConfidence: number | null;
  models: ModelPerformance[];
  features: FeatureImportance[];
  rlEnabled: boolean;
  onToggleRL: (enabled: boolean) => void;
  ensembleAccuracy: number | null;
  totalPredictions: number;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  autoOptimizing: boolean;
}

export function AIOptimizerPanel({
  regime,
  regimeConfidence,
  models,
  features,
  rlEnabled,
  onToggleRL,
  ensembleAccuracy,
  totalPredictions,
  sharpeRatio,
  maxDrawdown,
  autoOptimizing,
}: AIOptimizerPanelProps) {
  const regimeColor = regime?.includes("UP") || regime === "TRENDING UP"
    ? "var(--neon-green)"
    : regime?.includes("DOWN") || regime === "TRENDING DOWN"
      ? "var(--neon-red)"
      : regime === "VOLATILE"
        ? "var(--amber)"
        : "var(--cyan)";

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} style={{ color: "var(--cyan)" }} />
          <span className="font-bold uppercase tracking-widest" style={{ color: "var(--cyan)", fontSize: "12px" }}>AI Optimizer</span>
          {autoOptimizing && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: "rgba(0,255,231,0.1)", border: "1px solid var(--cyan)", fontSize: "8px", color: "var(--cyan)", fontWeight: 700 }}>
              <Activity size={8} /> AUTO-TUNING
            </span>
          )}
        </div>

        {/* Regime + RL toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>REGIME</span>
            <span className="font-bold px-2 py-0.5 rounded" style={{
              background: `${regimeColor}15`, border: `1px solid ${regimeColor}44`, color: regimeColor, fontSize: "10px", letterSpacing: "0.06em"
            }}>
              {regime ?? "DETECTING..."}
            </span>
            {regimeConfidence != null && (
              <span className="tabular-nums" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>{regimeConfidence}%</span>
            )}
          </div>
          <button
            onClick={() => onToggleRL(!rlEnabled)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded transition-all"
            style={{
              background: rlEnabled ? "rgba(0,255,231,0.1)" : "var(--surface-2)",
              border: `1px solid ${rlEnabled ? "var(--cyan)" : "var(--border)"}`,
              color: rlEnabled ? "var(--cyan)" : "var(--muted-foreground)",
              fontSize: "9px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.06em"
            }}
          >
            <Zap size={10} /> {rlEnabled ? "RL ON" : "RL OFF"}
          </button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "ACCURACY", value: ensembleAccuracy != null ? `${ensembleAccuracy}%` : "—", icon: Target, color: ensembleAccuracy != null && ensembleAccuracy >= 60 ? "var(--neon-green)" : "var(--amber)" },
          { label: "SHARPE", value: sharpeRatio != null ? sharpeRatio.toFixed(2) : "—", icon: TrendingUp, color: sharpeRatio != null && sharpeRatio > 0 ? "var(--neon-green)" : "var(--neon-red)" },
          { label: "PREDICTIONS", value: String(totalPredictions), icon: BarChart3, color: "var(--cyan)" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-3 flex flex-col items-center gap-1">
              <Icon size={12} style={{ color: stat.color }} />
              <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "7px" }}>{stat.label}</span>
              <span className="font-bold tabular-nums" style={{ color: stat.color, fontSize: "14px" }}>{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* Model Ensemble */}
      <div className="glass-card p-4">
        <p className="uppercase tracking-widest mb-3" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>Ensemble Models</p>
        <div className="flex flex-col gap-2">
          {models.map((m) => {
            const vc = m.verdict === "ABOVE" ? "var(--neon-green)" : m.verdict === "BELOW" ? "var(--neon-red)" : "var(--amber)";
            return (
              <div key={m.name} className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: "var(--foreground)", fontSize: "10px", width: "80px", flexShrink: 0 }}>{m.name}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${m.weight}%` }}
                      transition={{ duration: 0.5 }}
                      style={{ background: `linear-gradient(90deg, var(--cyan), ${vc})` }}
                    />
                  </div>
                  <span className="tabular-nums font-bold" style={{ color: "var(--muted-foreground)", fontSize: "9px", width: "30px", textAlign: "right" }}>{m.weight}%</span>
                </div>
                <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: `${vc}15`, border: `1px solid ${vc}33`, color: vc, fontSize: "8px" }}>{m.verdict}</span>
                <span className="tabular-nums" style={{ color: m.accuracy >= 60 ? "var(--neon-green)" : "var(--amber)", fontSize: "9px", width: "28px", textAlign: "right" }}>{m.accuracy}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Importance */}
      <div className="glass-card p-4">
        <p className="uppercase tracking-widest mb-3" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>Feature Importance</p>
        <div className="flex flex-col gap-1.5">
          {features.sort((a, b) => b.importance - a.importance).map((f) => {
            const maxImp = features.length > 0 ? Math.max(...features.map((x) => x.importance)) : 1;
            const pct = maxImp > 0 ? (f.importance / maxImp) * 100 : 0;
            const color = pct > 60 ? "var(--cyan)" : pct > 30 ? "var(--amber)" : "var(--muted-foreground)";
            return (
              <div key={f.feature} className="flex items-center gap-2">
                <span style={{ color: "var(--foreground)", fontSize: "10px", width: "70px", flexShrink: 0 }}>{f.feature}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} style={{ background: color }} />
                </div>
                <span className="tabular-nums font-bold" style={{ color, fontSize: "9px", width: "32px", textAlign: "right" }}>{(f.importance * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Max Drawdown */}
      {maxDrawdown != null && (
        <div className="glass-card p-3 flex items-center justify-between">
          <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>MAX DRAWDOWN</span>
          <span className="font-bold tabular-nums" style={{ color: "var(--neon-red)", fontSize: "14px" }}>-{Math.abs(maxDrawdown).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
