"use client";

import { useMarketStore } from '@/lib/market-store';
import { getFeedArbitrator } from '@/lib/feed-arbitration';
import { Settings, User } from 'lucide-react';

export function PremiumNavbar() {
  const { currentPrice, high24h, low24h, source, updatedAt } = useMarketStore();
  const arbitrator = getFeedArbitrator();
  const healthStatus = arbitrator.getHealthStatus();

  const formatPrice = (price: number | null) => {
    if (!price) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const calculateChange24h = () => {
    if (!currentPrice || !high24h || !low24h) return null;
    // Simplified 24h change calculation
    const midPrice = (high24h + low24h) / 2;
    const change = ((currentPrice - midPrice) / midPrice) * 100;
    return change;
  };

  const change24h = calculateChange24h();
  const isBullish = change24h !== null && change24h > 0;
  const isBearish = change24h !== null && change24h < 0;

  const formatLastUpdate = (timestamp: number | null) => {
    if (!timestamp) return '--:--:--';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-subtle">
      <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">BT</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-primary tracking-tight">
              BTC Trustee Quant
            </span>
            <span className="text-xs text-muted">Premium Terminal</span>
          </div>
        </div>

        {/* Center: Live Price + 24h + Trend */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-muted uppercase tracking-wider mb-0.5">
                BTC/USD
              </div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {formatPrice(currentPrice)}
              </div>
            </div>
            <div className="h-10 w-px bg-border-subtle" />
            <div className="flex flex-col">
              <div className="text-xs text-muted uppercase tracking-wider mb-0.5">
                24h Change
              </div>
              <div
                className={`text-lg font-semibold tabular-nums ${
                  isBullish ? 'text-bullish' : isBearish ? 'text-bearish' : 'text-neutral'
                }`}
              >
                {change24h !== null ? (
                  <span>
                    {isBullish ? '+' : ''}
                    {change24h.toFixed(2)}%
                  </span>
                ) : (
                  '--%'
                )}
              </div>
            </div>
            <div className="h-10 w-px bg-border-subtle" />
            <div className="flex flex-col">
              <div className="text-xs text-muted uppercase tracking-wider mb-0.5">
                Trend
              </div>
              <div
                className={`text-lg font-semibold ${
                  isBullish ? 'text-bullish' : isBearish ? 'text-bearish' : 'text-neutral'
                }`}
              >
                {isBullish ? 'Bullish' : isBearish ? 'Bearish' : 'Neutral'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Feed Health + User + Settings */}
        <div className="flex items-center gap-4">
          {/* Feed Health Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-subtle">
            <div
              className={`w-2 h-2 rounded-full ${
                healthStatus.status === 'live' ? 'bg-bullish animate-pulse' : 'text-bearish'
              }`}
            />
            <span className="text-xs font-medium text-primary">
              {healthStatus.status.toUpperCase()}
            </span>
            <span className="text-xs text-muted">({source})</span>
          </div>

          {/* User Account */}
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-card transition-colors border border-transparent hover:border-subtle">
            <User className="w-4 h-4 text-muted" />
            <span className="text-sm text-primary">Account</span>
          </button>

          {/* Settings */}
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-card transition-colors border border-transparent hover:border-subtle">
            <Settings className="w-4 h-4 text-muted" />
            <span className="text-sm text-primary">Settings</span>
          </button>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="h-6 bg-card border-t border-subtle flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-4 text-muted">
          <span>Last Updated: {formatLastUpdate(updatedAt)}</span>
          <span>Latency: {healthStatus.latency}ms</span>
        </div>
        <div className="text-muted">
          High: {formatPrice(high24h)} | Low: {formatPrice(low24h)}
        </div>
      </div>
    </nav>
  );
}
