"use client";

import { BarChart3, TrendingUp, TrendingDown, Calendar, Target } from 'lucide-react';

export function PerformanceAnalytics() {
  const dailyData = [
    { day: 'Mon', pnl: 1250, signals: 8, winRate: 75 },
    { day: 'Tue', pnl: -420, signals: 6, winRate: 50 },
    { day: 'Wed', pnl: 2100, signals: 10, winRate: 80 },
    { day: 'Thu', pnl: 890, signals: 7, winRate: 71 },
    { day: 'Fri', pnl: 2450, signals: 9, winRate: 78 },
  ];

  const formatPnL = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxPnL = Math.max(...dailyData.map(d => Math.abs(d.pnl)));

  return (
    <div className="bg-surface rounded-lg p-4 border border-mid">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent-cyan" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Weekly Performance
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Calendar className="w-3 h-3" />
          <span>Last 5 Days</span>
        </div>
      </div>

      <div className="space-y-3">
        {dailyData.map((data, index) => (
          <div key={index} className="bg-card rounded-lg p-3 border border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">{data.day}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{data.signals} signals</span>
                <span className={`text-xs font-semibold ${data.winRate >= 70 ? 'text-bullish' : data.winRate >= 50 ? 'text-neutral' : 'text-bearish'}`}>
                  {data.winRate}% win
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    data.pnl >= 0 ? 'bg-bullish' : 'bg-bearish'
                  }`}
                  style={{ width: `${(Math.abs(data.pnl) / maxPnL) * 100}%` }}
                />
              </div>
              <span className={`text-sm font-semibold tabular-nums ${
                data.pnl >= 0 ? 'text-bullish' : 'text-bearish'
              }`}>
                {data.pnl >= 0 ? '+' : ''}{formatPnL(data.pnl)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent-cyan" />
            <span className="text-xs text-muted">Weekly Total</span>
          </div>
          <span className="text-lg font-bold text-bullish">
            {formatPnL(dailyData.reduce((sum, d) => sum + d.pnl, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
