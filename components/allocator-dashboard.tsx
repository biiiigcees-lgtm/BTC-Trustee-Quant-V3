"use client";

import { useState, useCallback, type ReactNode } from "react";
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  BarChart3,
  Target,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpportunityCard } from "@/components/opportunity-card";
import { PortfolioAllocationChart } from "@/components/portfolio-allocation-chart";
import { ScenarioPanel } from "@/components/scenario-panel";
import { SmartWallet } from "@/components/smart-wallet";
import type { AllocatorResponse } from "@/app/api/allocator/route";

// ─── Types ──────────────────────────────────────────────────────────────────

type RiskProfile = "conservative" | "moderate" | "aggressive";
type TabId = "overview" | "opportunities" | "portfolio" | "scenarios";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "OVERVIEW", icon: <Activity className="w-3 h-3" /> },
  { id: "opportunities", label: "OPPORTUNITIES", icon: <Target className="w-3 h-3" /> },
  { id: "portfolio", label: "PORTFOLIO", icon: <BarChart3 className="w-3 h-3" /> },
  { id: "scenarios", label: "SCENARIOS", icon: <TrendingUp className="w-3 h-3" /> },
];

const RISK_PROFILES: { id: RiskProfile; label: string; desc: string }[] = [
  { id: "conservative", label: "CONSERVATIVE", desc: "Low risk · 30% cash min" },
  { id: "moderate", label: "MODERATE", desc: "Balanced · 20% cash min" },
  { id: "aggressive", label: "AGGRESSIVE", desc: "Growth · 15% cash min" },
];

const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bullish: { label: "BULLISH", color: "text-[var(--neon-green)]", bg: "bg-[var(--neon-green)]/10 border-[var(--neon-green)]/30" },
  bearish: { label: "BEARISH", color: "text-[var(--neon-red)]", bg: "bg-[var(--neon-red)]/10 border-[var(--neon-red)]/30" },
  neutral: { label: "NEUTRAL", color: "text-[var(--cyan)]", bg: "bg-[var(--cyan)]/10 border-[var(--cyan)]/30" },
  high_volatility: { label: "HIGH VOL", color: "text-[var(--amber)]", bg: "bg-[var(--amber)]/10 border-[var(--amber)]/30" },
};

// ─── Main component ─────────────────────────────────────────────────────────

export function AllocatorDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("moderate");
  const [walletBalance, setWalletBalance] = useState(10000);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AllocatorResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeMarket = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/allocator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capital: walletBalance,
          risk_profile: riskProfile,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const result: AllocatorResponse = await res.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Analysis failed. Using cached data.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [walletBalance, riskProfile]);

  const regime = data?.market_regime ? REGIME_CONFIG[data.market_regime] : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-mono">
      {/* ── Header ── */}
      <header className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between sticky top-0 z-10 bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[var(--cyan)]" />
          <div>
            <div className="text-base font-semibold tracking-widest text-[var(--cyan)]">VAULTEX</div>
            <div className="text-[9px] text-[var(--muted-foreground)] tracking-wider">AI CAPITAL ALLOCATOR</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Market regime badge */}
          {regime && (
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded border font-mono",
                regime.bg,
                regime.color
              )}
            >
              {regime.label}
            </span>
          )}

          {/* AI status */}
          <div className="flex items-center gap-1.5">
            {isLoading ? (
              <>
                <span className="spinner" />
                <span className="text-[10px] text-[var(--cyan)]">ANALYZING</span>
              </>
            ) : data?.no_trade_recommendation ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                <span className="text-[10px] text-[var(--amber)]">NO TRADE</span>
              </>
            ) : data ? (
              <>
                <span className="status-dot animate-pulse-glow" />
                <span className="text-[10px] text-[var(--neon-green)]">AI ACTIVE</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]" />
                <span className="text-[10px] text-[var(--muted-foreground)]">IDLE</span>
              </>
            )}
          </div>

          {lastUpdated && (
            <span className="text-[9px] text-[var(--muted-foreground)] hidden sm:block">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* ── No Trade Banner ── */}
        {data?.no_trade_recommendation && (
          <div className="flex items-start gap-3 p-3 rounded border border-[var(--amber)]/40 bg-[var(--amber)]/5">
            <AlertTriangle className="w-4 h-4 text-[var(--amber)] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-[var(--amber)] mb-0.5">
                CAPITAL PRESERVATION MODE
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                {data.no_trade_reason ?? "No high-quality opportunities identified. Holding cash is the optimal strategy."}
              </div>
            </div>
          </div>
        )}

        {/* ── Two-column layout: Wallet + Controls ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SmartWallet balance={walletBalance} onBalanceChange={setWalletBalance} />

          {/* Controls card */}
          <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
            <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
              Risk Profile
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {RISK_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setRiskProfile(profile.id)}
                  className={cn(
                    "py-2 px-1 rounded border text-[10px] font-mono transition-all text-center",
                    riskProfile === profile.id
                      ? "border-[var(--cyan)]/60 bg-[var(--cyan)]/10 text-[var(--cyan)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20"
                  )}
                >
                  <div className="font-semibold">{profile.label.split(" ")[0]}</div>
                  <div className="text-[8px] mt-0.5 opacity-70 leading-tight">{profile.desc}</div>
                </button>
              ))}
            </div>

            <button
              onClick={analyzeMarket}
              disabled={isLoading}
              className={cn(
                "mt-auto w-full py-2.5 rounded font-mono text-sm font-semibold transition-all flex items-center justify-center gap-2",
                "bg-[var(--cyan)] text-[var(--background)] hover:opacity-90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <span className="spinner border-[var(--background)]" />
                  ANALYZING MARKETS...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {data ? "REFRESH ANALYSIS" : "ANALYZE MARKET"}
                </>
              )}
            </button>

            {error && (
              <div className="text-[10px] text-[var(--amber)] font-mono flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-[var(--border)]">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-mono whitespace-nowrap border-b-2 transition-all",
                  activeTab === tab.id
                    ? "border-[var(--cyan)] text-[var(--cyan)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "opportunities" && data && !data.no_trade_recommendation && (
                  <span className="ml-1 px-1 py-0.5 rounded bg-[var(--cyan)]/20 text-[var(--cyan)] text-[9px]">
                    {data.opportunities.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="min-h-[400px]">
          {activeTab === "overview" && (
            <OverviewTab data={data} walletBalance={walletBalance} onAnalyze={analyzeMarket} isLoading={isLoading} setActiveTab={setActiveTab} />
          )}
          {activeTab === "opportunities" && (
            <OpportunitiesTab data={data} isLoading={isLoading} />
          )}
          {activeTab === "portfolio" && (
            <PortfolioTab data={data} />
          )}
          {activeTab === "scenarios" && (
            <ScenariosTab data={data} walletBalance={walletBalance} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  data,
  walletBalance,
  onAnalyze,
  isLoading,
  setActiveTab,
}: {
  data: AllocatorResponse | null;
  walletBalance: number;
  onAnalyze: () => void;
  isLoading: boolean;
  setActiveTab: (t: TabId) => void;
}) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Shield className="w-12 h-12 text-[var(--muted-foreground)]/30" />
        <div className="text-center">
          <div className="text-sm text-[var(--foreground)] font-semibold mb-1">
            AI Engine Ready
          </div>
          <div className="text-xs text-[var(--muted-foreground)] max-w-xs leading-relaxed">
            Click &ldquo;Analyze Market&rdquo; to scan global markets and surface
            risk-adjusted investment opportunities.
          </div>
        </div>
        <button
          onClick={onAnalyze}
          disabled={isLoading}
          className="px-6 py-2.5 rounded bg-[var(--cyan)] text-[var(--background)] text-sm font-mono font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {isLoading ? "Analyzing..." : "Analyze Market"}
        </button>
        <p className="text-[10px] text-[var(--muted-foreground)] font-mono max-w-sm text-center leading-relaxed">
          ⚠ For informational purposes only. Not financial advice.
          All investments carry risk of loss.
        </p>
      </div>
    );
  }

  const deployed = (walletBalance * data.allocation_strategy.total_deployed_pct) / 100;
  const cash = (walletBalance * data.allocation_strategy.cash_reserve_pct) / 100;

  const summaryCards = [
    {
      label: "TOTAL DEPLOYED",
      value: `$${deployed.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      sub: `${data.allocation_strategy.total_deployed_pct}% of capital`,
      icon: <DollarSign className="w-4 h-4 text-[var(--cyan)]" />,
      color: "text-[var(--cyan)]",
    },
    {
      label: "CASH RESERVE",
      value: `$${cash.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      sub: `${data.allocation_strategy.cash_reserve_pct}% held`,
      icon: <Shield className="w-4 h-4 text-[var(--neon-green)]" />,
      color: "text-[var(--neon-green)]",
    },
    {
      label: "OPPORTUNITIES",
      value: data.no_trade_recommendation ? "0" : String(data.opportunities.length),
      sub: data.no_trade_recommendation ? "Capital preservation mode" : "High-conviction setups",
      icon: <Target className="w-4 h-4 text-[var(--amber)]" />,
      color: "text-[var(--amber)]",
    },
    {
      label: "BASE CASE RETURN",
      value: `+${data.scenarios.base_case.return_pct}%`,
      sub: `${data.scenarios.base_case.probability}% probability`,
      icon: <TrendingUp className="w-4 h-4 text-[var(--neon-green)]" />,
      color: "text-[var(--neon-green)]",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-1.5 mb-2">{card.icon}</div>
            <div className={cn("text-lg font-semibold font-mono", card.color)}>{card.value}</div>
            <div className="text-[10px] text-[var(--muted-foreground)] font-mono mt-0.5">{card.label}</div>
            <div className="text-[9px] text-[var(--muted-foreground)] font-mono mt-0.5 opacity-70">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Top opportunities preview */}
      {!data.no_trade_recommendation && data.opportunities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-[var(--muted-foreground)] font-mono uppercase tracking-widest">
              Top Opportunities
            </div>
            <button
              onClick={() => setActiveTab("opportunities")}
              className="text-[10px] text-[var(--cyan)] font-mono flex items-center gap-1 hover:underline"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.opportunities.slice(0, 3).map((opp, i) => (
              <OpportunityCard key={`${opp.asset}-${opp.confidence}`} opportunity={opp} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-[var(--muted-foreground)] font-mono leading-relaxed border-t border-[var(--border)] pt-3">
        ⚠ Vaultex provides AI-generated analysis for informational purposes only. This is not financial advice.
        All investments involve risk of loss. Past performance does not guarantee future results.
        Capital preservation is the primary objective — returns are never guaranteed.
      </p>
    </div>
  );
}

// ─── Opportunities Tab ───────────────────────────────────────────────────────

function OpportunitiesTab({
  data,
  isLoading,
}: {
  data: AllocatorResponse | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <span className="spinner" />
        <span className="text-xs text-[var(--cyan)] font-mono">Scanning global markets...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-xs text-[var(--muted-foreground)] font-mono">
          Run market analysis to surface opportunities.
        </span>
      </div>
    );
  }

  if (data.no_trade_recommendation) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertTriangle className="w-10 h-10 text-[var(--amber)]" />
        <div className="text-sm font-semibold text-[var(--amber)] font-mono">
          No High-Quality Trades
        </div>
        <p className="text-xs text-[var(--muted-foreground)] font-mono text-center max-w-sm leading-relaxed">
          {data.no_trade_reason ?? "Market conditions do not meet the minimum quality threshold. Capital preservation is recommended."}
        </p>
        <div className="text-[10px] text-[var(--muted-foreground)] font-mono border border-[var(--border)] rounded px-3 py-1.5">
          CONFIDENCE THRESHOLD: 70/100
        </div>
      </div>
    );
  }

  if (data.opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-xs text-[var(--muted-foreground)] font-mono">
          No opportunities met the confidence threshold (≥70).
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-[var(--muted-foreground)] font-mono">
          {data.opportunities.length} OPPORTUNITIES · CONFIDENCE ≥ 70
        </div>
        <div className="text-[10px] text-[var(--cyan)] font-mono">
          SORTED BY CONFIDENCE ↓
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...data.opportunities]
          .sort((a, b) => b.confidence - a.confidence)
          .map((opp, i) => (
            <OpportunityCard key={`${opp.asset}-${opp.confidence}`} opportunity={opp} index={i} />
          ))}
      </div>
    </div>
  );
}

// ─── Portfolio Tab ────────────────────────────────────────────────────────────

function PortfolioTab({ data }: { data: AllocatorResponse | null }) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-xs text-[var(--muted-foreground)] font-mono">
          Run analysis to view portfolio allocation.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-[10px] text-[var(--muted-foreground)] font-mono uppercase tracking-widest mb-4">
        Proposed Allocation
      </div>
      <PortfolioAllocationChart allocationStrategy={data.allocation_strategy} />
    </div>
  );
}

// ─── Scenarios Tab ────────────────────────────────────────────────────────────

function ScenariosTab({
  data,
  walletBalance,
}: {
  data: AllocatorResponse | null;
  walletBalance: number;
}) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-xs text-[var(--muted-foreground)] font-mono">
          Run analysis to view scenario projections.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-[10px] text-[var(--muted-foreground)] font-mono uppercase tracking-widest mb-4">
        Scenario Analysis
      </div>
      <ScenarioPanel scenarios={data.scenarios} capital={walletBalance} />
    </div>
  );
}
