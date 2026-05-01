"use client";

import { Trophy, TrendingUp, Zap, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SignalRecord {
  time: string;
  signal: 'BUY_YES' | 'BUY_NO' | 'PASS';
  strike: number;
  result: 'WIN' | 'LOSS' | 'PENDING';
  edge: number;
}

export function HistoricalPerformance() {
  const [stats, setStats] = useState({
    winRate: 0,
    avgEdge: 0,
    bestStreak: 0,
    todayPnL: 0,
  });

  const [recentSignals, setRecentSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real data from /api/bets
  useEffect(() => {
    const fetchBets = async () => {
      try {
        const res = await fetch('/api/bets');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Transform API data to SignalRecord format
            const signals: SignalRecord[] = data.map((bet: any) => ({
              time: new Date(bet.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              signal: bet.signal || 'PASS',
              strike: bet.strike_price || 0,
              result: bet.result || 'PENDING',
              edge: bet.edge || 0,
            }));

            setRecentSignals(signals);

            // Calculate stats from real data
            const wins = signals.filter(s => s.result === 'WIN').length;
            const total = signals.length;
            const winRate = total > 0 ? (wins / total) * 100 : 0;
            const avgEdge = total > 0 ? signals.reduce((sum, s) => sum + s.edge, 0) / total : 0;
            const todayPnL = signals.reduce((sum, s) => sum + (s.result === 'WIN' ? 100 : s.result === 'LOSS' ? -100 : 0), 0);

            setStats({
              winRate,
              avgEdge,
              bestStreak: 0, // Would need streak calculation
              todayPnL,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch bets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();
  }, []);

  const [animatedStats, setAnimatedStats] = useState({
    winRate: 0,
    avgEdge: 0,
    bestStreak: 0,
    todayPnL: 0,
  });

  useEffect(() => {
    if (loading) return;
    
    const duration = 1000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const animate = () => {
      step++;
      const progress = step / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setAnimatedStats({
        winRate: stats.winRate * easeOut,
        avgEdge: stats.avgEdge * easeOut,
        bestStreak: stats.bestStreak * easeOut,
        todayPnL: stats.todayPnL * easeOut,
      });

      if (step < steps) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [stats, loading]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatPnL = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'WIN':
        return 'text-bullish';
      case 'LOSS':
        return 'text-bearish';
      case 'PENDING':
        return 'text-neutral';
    }
  };

  const getResultBg = (result: string) => {
    switch (result) {
      case 'WIN':
        return 'bg-bullish-dim';
      case 'LOSS':
        return 'bg-bearish-dim';
      case 'PENDING':
        return 'bg-neutral-dim';
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY_YES':
        return 'text-bullish';
      case 'BUY_NO':
        return 'text-bearish';
      case 'PASS':
        return 'text-neutral';
    }
  };

  return (
    <div className="bg-surface rounded-lg p-4 border border-mid">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
        Historical Performance
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-lg p-3 border border-subtle hover:border-subtle/50 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-accent-cyan" />
            <span className="text-xs text-muted">Win Rate</span>
          </div>
          <div className="text-xl font-bold text-primary">{animatedStats.winRate.toFixed(0)}%</div>
          <div className="w-full h-1 bg-elevated rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-bullish rounded-full transition-all duration-1000"
              style={{ width: `${animatedStats.winRate}%` }}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg p-3 border border-subtle hover:border-subtle/50 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-accent-cyan" />
            <span className="text-xs text-muted">Avg Edge</span>
          </div>
          <div className="text-xl font-bold text-bullish flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            {animatedStats.avgEdge.toFixed(1)}%
          </div>
        </div>

        <div className="bg-card rounded-lg p-3 border border-subtle hover:border-subtle/50 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-accent-cyan" />
            <span className="text-xs text-muted">Best Streak</span>
          </div>
          <div className="text-xl font-bold text-primary">{animatedStats.bestStreak.toFixed(0)}</div>
        </div>

        <div className="bg-card rounded-lg p-3 border border-subtle hover:border-subtle/50 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-accent-cyan" />
            <span className="text-xs text-muted">Today PnL</span>
          </div>
          <div className="text-xl font-bold text-bullish flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            {formatPnL(animatedStats.todayPnL)}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-subtle overflow-hidden">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-elevated border-b border-subtle text-xs font-semibold text-muted uppercase tracking-wider">
          <span>Time</span>
          <span>Signal</span>
          <span>Strike</span>
          <span>Result</span>
          <span className="text-right">Edge</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : recentSignals.length === 0 ? (
          <div className="p-8 text-center text-muted">
            No trades logged yet
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {recentSignals.map((record, index) => (
              <div
                key={index}
                className="grid grid-cols-5 gap-2 px-3 py-2 text-sm hover:bg-card/50 transition-colors animate-in fade-in slide-in-from-left-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-muted">{record.time}</span>
                <span className={`font-medium ${getSignalColor(record.signal)}`}>
                  {record.signal.replace('_', ' ')}
                </span>
                <span className="text-primary">{formatPrice(record.strike)}</span>
                <span className={`font-medium px-2 py-0.5 rounded text-xs ${getResultColor(record.result)} ${getResultBg(record.result)}`}>
                  {record.result}
                </span>
                <span className={`text-right font-medium ${record.edge > 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {record.edge > 0 ? '+' : ''}
                  {record.edge}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
