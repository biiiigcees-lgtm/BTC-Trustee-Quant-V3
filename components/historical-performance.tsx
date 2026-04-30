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
    winRate: 68,
    avgEdge: 4.1,
    bestStreak: 7,
    todayPnL: 2450,
  });

  const [recentSignals, setRecentSignals] = useState<SignalRecord[]>([
    { time: '14:35', signal: 'BUY_YES', strike: 76500, result: 'WIN', edge: 6.2 },
    { time: '14:20', signal: 'BUY_NO', strike: 77000, result: 'WIN', edge: 4.8 },
    { time: '14:05', signal: 'BUY_YES', strike: 76250, result: 'LOSS', edge: 3.1 },
    { time: '13:50', signal: 'BUY_YES', strike: 76000, result: 'WIN', edge: 5.5 },
    { time: '13:35', signal: 'PASS', strike: 75750, result: 'PENDING', edge: 0 },
    { time: '13:20', signal: 'BUY_NO', strike: 75500, result: 'WIN', edge: 4.2 },
    { time: '13:05', signal: 'BUY_YES', strike: 75250, result: 'WIN', edge: 7.1 },
    { time: '12:50', signal: 'BUY_YES', strike: 75000, result: 'LOSS', edge: 2.8 },
  ]);

  const [animatedStats, setAnimatedStats] = useState({
    winRate: 0,
    avgEdge: 0,
    bestStreak: 0,
    todayPnL: 0,
  });

  useEffect(() => {
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
  }, [stats]);

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
    <div className="glass-card rounded-xl p-4 border border-subtle">
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
      </div>
    </div>
  );
}
