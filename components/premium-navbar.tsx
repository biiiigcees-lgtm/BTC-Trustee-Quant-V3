"use client";

import { useMarketStore } from '@/lib/market-store';
import { getFeedArbitrator } from '@/lib/feed-arbitration';
import { Settings, User } from 'lucide-react';
import { useUser, UserButton, SignInButton } from '@clerk/nextjs';

export function PremiumNavbar() {
  const { currentPrice, high24h, low24h, source, updatedAt } = useMarketStore();
  const arbitrator = getFeedArbitrator();
  const healthStatus = arbitrator.getHealthStatus();
  const { isSignedIn, user } = useUser();

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
    <nav className="sticky top-0 z-50 bg-base border-b border-mid">
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-elevated border border-mid flex items-center justify-center">
              <span className="text-primary font-bold text-lg">BQ</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-primary">BTC Quant</div>
              <div className="text-xs text-muted">Trustee V3</div>
            </div>
          </div>

          {/* Center: Live Price + 24h + Trend */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-primary tabular-nums">
                  {formatPrice(currentPrice)}
                </div>
                <div className="text-xs text-muted">
                  24h: {high24h ? formatPrice(high24h) : '—'} / {low24h ? formatPrice(low24h) : '—'}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${
                healthStatus.status === 'live' ? 'bg-bullish-bright' : 'bg-bearish-bright'
              }`} />
            </div>

            {/* Feed Health */}
            <div className="hidden md:flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                healthStatus.status === 'live' ? 'bg-bullish-bright' : 'bg-bearish-bright'
              }`} />
              <span className="text-xs font-medium text-primary">
                {healthStatus.status.toUpperCase()}
              </span>
              <span className="text-xs text-muted">({source})</span>
            </div>
          </div>

          {/* Right: User Account + Settings */}
          <div className="flex items-center gap-2">
            {/* User Account */}
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-elevated transition-colors border border-mid">
                  <User className="w-4 h-4 text-muted" />
                  <span className="text-sm text-primary">Sign In</span>
                </button>
              </SignInButton>
            )}

            {/* Settings */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-elevated transition-colors border border-mid">
              <Settings className="w-4 h-4 text-muted" />
              <span className="text-sm text-primary">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="h-6 bg-elevated border-t border-mid flex items-center justify-between px-4 lg:px-6 text-xs">
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
