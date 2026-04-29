"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/app/api/allocator/route";

interface OpportunityCardProps {
  opportunity: Opportunity;
  index: number;
}

const STRATEGY_LABELS: Record<string, string> = {
  momentum: "MOMENTUM",
  value: "VALUE",
  trend: "TREND",
  defensive: "DEFENSIVE",
  contrarian: "CONTRARIAN",
  arbitrage: "ARBITRAGE",
  growth: "GROWTH",
  income: "INCOME",
};

type RiskLevel = "Low" | "Moderate" | "High";

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; dot: string }> = {
  Low: { color: "text-[var(--neon-green)]", bg: "bg-[var(--neon-green)]/10", border: "border-[var(--neon-green)]/30", dot: "bg-[var(--neon-green)]" },
  Moderate: { color: "text-[var(--amber)]", bg: "bg-[var(--amber)]/10", border: "border-[var(--amber)]/30", dot: "bg-[var(--amber)]" },
  High: { color: "text-[var(--neon-red)]", bg: "bg-[var(--neon-red)]/10", border: "border-[var(--neon-red)]/30", dot: "bg-[var(--neon-red)]" },
};

export function OpportunityCard({ opportunity, index }: OpportunityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const riskCfg = RISK_CONFIG[opportunity.risk_level as RiskLevel] ?? RISK_CONFIG.Moderate;
  const strategyLabel = STRATEGY_LABELS[opportunity.strategy] ?? opportunity.strategy.toUpperCase();

  // Confidence color
  const confColor =
    opportunity.confidence >= 85
      ? "text-[var(--neon-green)]"
      : opportunity.confidence >= 75
      ? "text-[var(--cyan)]"
      : "text-[var(--amber)]";

  const confBarColor =
    opportunity.confidence >= 85
      ? "bg-[var(--neon-green)]"
      : opportunity.confidence >= 75
      ? "bg-[var(--cyan)]"
      : "bg-[var(--amber)]";

  return (
    <div
      className={cn(
        "rounded border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-200",
        "hover:border-[var(--cyan)]/40"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1 min-w-0">
          {/* Index + asset */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              #{String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)] truncate font-mono tracking-wide">
              {opportunity.asset}
            </span>
          </div>
          {/* Strategy + risk badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--cyan)]/40 text-[var(--cyan)] bg-[var(--cyan)]/5 font-mono">
              {strategyLabel}
            </span>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded border font-mono flex items-center gap-1",
                riskCfg.bg,
                riskCfg.border,
                riskCfg.color
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full inline-block", riskCfg.dot)} />
              {opportunity.risk_level.toUpperCase()} RISK
            </span>
          </div>
        </div>

        {/* Expected return */}
        <div className="text-right shrink-0">
          <div className="text-[10px] text-[var(--muted-foreground)] font-mono mb-0.5">EXPECTED RETURN</div>
          <div className="text-sm font-mono font-semibold text-[var(--neon-green)]">
            +{opportunity.expected_return.low}% → +{opportunity.expected_return.high}%
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)] font-mono mt-0.5">
            {opportunity.time_horizon}
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--muted-foreground)] font-mono">AI CONFIDENCE</span>
          <span className={cn("text-xs font-mono font-semibold", confColor)}>
            {opportunity.confidence}/100
          </span>
        </div>
        <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", confBarColor)}
            style={{ width: `${opportunity.confidence}%` }}
          />
        </div>
      </div>

      {/* Entry reasoning */}
      <p className="text-[11px] text-[var(--muted-foreground)] font-mono leading-relaxed mb-3 line-clamp-2">
        {opportunity.entry_reasoning}
      </p>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-[var(--cyan)] font-mono hover:text-[var(--foreground)] transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" /> HIDE RISKS
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" /> SHOW RISKS ({opportunity.key_risks.length})
          </>
        )}
      </button>

      {/* Expanded risks */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="text-[10px] text-[var(--muted-foreground)] font-mono mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-[var(--amber)]" />
            KEY RISKS
          </div>
          <ul className="space-y-1">
            {opportunity.key_risks.map((risk, i) => (
              <li key={i} className="text-[11px] font-mono text-[var(--muted-foreground)] flex items-start gap-2">
                <span className="text-[var(--neon-red)] mt-0.5">▸</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
