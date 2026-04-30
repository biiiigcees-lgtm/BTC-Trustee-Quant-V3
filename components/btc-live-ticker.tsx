"use client";

import { useMarketStore } from '@/lib/market-store';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

export function BTCLiveTicker() {
  const { currentPrice, high24h, low24h, source, updatedAt, latency } = useMarketStore();

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

  const getTrendIcon = () => {
    if (isBullish) return <TrendingUp className="w-4 h-4" />;
    if (isBearish) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <div className="glass-card rounded-lg p-4 border border-subtle">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            BTC/USD Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{source.toUpperCase()}</span>
          <span className="text-xs text-muted">{latency}ms</span>
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-3xl font-bold text-primary tabular-nums">
          {formatPrice(currentPrice)}
        </span>
        <div
          className={`flex items-center gap-1 ${
            isBullish ? 'text-bullish' : isBearish ? 'text-bearish' : 'text-neutral'
          }`}
        >
          {getTrendIcon()}
          <span className="text-lg font-semibold tabular-nums">
            {change24h !== null ? (
              <span>
                {isBullish ? '+' : ''}
                {change24h.toFixed(2)}%
              </span>
            ) : (
              '--%'
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>Last Updated: {formatLastUpdate(updatedAt)}</span>
        <div className="flex items-center gap-3">
          <span>High: {formatPrice(high24h)}</span>
          <span>Low: {formatPrice(low24h)}</span>
        </div>
      </div>
    </div>
  );
}
