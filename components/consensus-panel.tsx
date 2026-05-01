"use client";

import { useState, useEffect, useCallback } from "react";
import { useMarketStore } from "@/lib/market-store";
import { RefreshCw, Users, Activity, AlertCircle } from "lucide-react";

interface ProviderResult {
  name: string;
  direction: "ABOVE" | "BELOW" | "unavailable";
  confidence: number;
  reasoning: string;
  status: "ok" | "error" | "unavailable";
}

interface ConsensusData {
  consensus: "ABOVE" | "BELOW" | "SPLIT";
  agreementScore: number;
  voteCount: {
    ABOVE: number;
    BELOW: number;
    unavailable: number;
  };
  providers: ProviderResult[];
  weightedScore: number;
  cached?: boolean;
  timestamp: string;
}

export function ConsensusPanel() {
  const { currentPrice } = useMarketStore();
  const [data, setData] = useState<ConsensusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const COOLDOWN_SECONDS = 60;

  const fetchConsensus = useCallback(async () => {
    if (!currentPrice) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: currentPrice,
          target: `$${Math.round(currentPrice / 500) * 500}`,
          expiryLabel: "15 min",
          secondsToExpiry: 900,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch consensus");
      }

      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      setCooldownRemaining(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [currentPrice]);

  // Initial fetch
  useEffect(() => {
    if (currentPrice && !data && !loading) {
      fetchConsensus();
    }
  }, [currentPrice, data, loading, fetchConsensus]);

  // Auto-refresh every 3 minutes (180 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConsensus();
    }, 180000);

    return () => clearInterval(interval);
  }, [fetchConsensus]);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  const getConsensusColor = (consensus: string) => {
    switch (consensus) {
      case "ABOVE":
        return "text-bullish";
      case "BELOW":
        return "text-bearish";
      default:
        return "text-neutral";
    }
  };

  const getConsensusBg = (consensus: string) => {
    switch (consensus) {
      case "ABOVE":
        return "bg-bullish";
      case "BELOW":
        return "bg-bearish";
      default:
        return "bg-neutral";
    }
  };

  const getProviderRowColor = (direction: string, status: string) => {
    if (status !== "ok") return "text-muted bg-card/50";
    switch (direction) {
      case "ABOVE":
        return "text-bullish bg-bullish-dim/30";
      case "BELOW":
        return "text-bearish bg-bearish-dim/30";
      default:
        return "text-muted bg-card/50";
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "—";
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const availableProviders = data?.providers.filter((p) => p.status === "ok") || [];
  const totalProviders = data?.providers.length || 0;
  const winningVotes = data?.consensus === "ABOVE" ? data.voteCount.ABOVE : data?.voteCount.BELOW || 0;

  return (
    <div className="bg-surface rounded-lg p-4 border border-mid">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent-cyan" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            AI Consensus
          </span>
          {loading && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data?.cached && (
            <span className="text-xs text-muted bg-card px-2 py-1 rounded">cached</span>
          )}
          <button
            onClick={fetchConsensus}
            disabled={loading}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              loading
                ? "bg-card text-muted cursor-not-allowed"
                : "bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30"
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-bearish-dim rounded-lg border border-bearish/30">
          <div className="flex items-center gap-2 text-bearish text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="h-16 bg-card rounded-lg animate-pulse" />
          <div className="h-4 bg-card rounded animate-pulse w-3/4" />
          <div className="h-4 bg-card rounded animate-pulse w-1/2" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-card rounded animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !data && !error && (
        <div className="text-center py-8">
          <div className="text-muted mb-2">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          </div>
          <p className="text-sm text-muted">
            Press Refresh to run consensus
          </p>
        </div>
      )}

      {/* Consensus Verdict */}
      {data && (
        <>
          <div className="text-center mb-6">
            <div className={`text-5xl font-bold tracking-tight mb-2 ${getConsensusColor(data.consensus)}`}>
              {data.consensus}
            </div>
            <div className="text-sm text-muted">
              {winningVotes}/{availableProviders.length} providers agree · {data.agreementScore}% agreement
            </div>
            <div className="text-xs text-muted mt-1">
              Weighted confidence: {data.weightedScore}%
            </div>
          </div>

          {/* Vote Split Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>ABOVE</span>
              <span>BELOW</span>
            </div>
            <div className="h-3 bg-card rounded-full overflow-hidden flex">
              {availableProviders.length > 0 && (
                <>
                  <div
                    className="h-full bg-bullish transition-all duration-500"
                    style={{ width: `${(data.voteCount.ABOVE / availableProviders.length) * 100}%` }}
                  />
                  <div
                    className="h-full bg-bearish transition-all duration-500"
                    style={{ width: `${(data.voteCount.BELOW / availableProviders.length) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-bullish font-medium">{data.voteCount.ABOVE}</span>
              <span className="text-muted">{data.voteCount.unavailable} unavailable</span>
              <span className="text-bearish font-medium">{data.voteCount.BELOW}</span>
            </div>
          </div>

          {/* Provider Breakdown Table */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Provider Breakdown
            </div>
            <div className="space-y-1">
              {data.providers.map((provider) => (
                <div
                  key={provider.name}
                  className={`flex items-center justify-between p-2 rounded-lg text-sm ${getProviderRowColor(
                    provider.direction,
                    provider.status
                  )}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{provider.name}</span>
                    {provider.status === "ok" && (
                      <Activity className="w-3 h-3 opacity-70" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {provider.status === "ok" ? (
                      <>
                        <span className="text-xs opacity-70 truncate max-w-[120px] hidden sm:block">
                          {provider.reasoning}
                        </span>
                        <span className="font-mono font-medium">{provider.confidence}%</span>
                        <span className="font-semibold uppercase">{provider.direction}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted capitalize">{provider.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-subtle">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted">
                <span>Last updated: {formatTime(lastUpdated)}</span>
                {cooldownRemaining > 0 && (
                  <span className="ml-2 text-neutral">
                    · {cooldownRemaining}s cooldown
                  </span>
                )}
                <span className="ml-2">
                  {availableProviders.length}/{totalProviders} active
                </span>
              </div>
              <button
                onClick={fetchConsensus}
                disabled={loading || cooldownRemaining > 0}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-subtle hover:border-subtle/50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
