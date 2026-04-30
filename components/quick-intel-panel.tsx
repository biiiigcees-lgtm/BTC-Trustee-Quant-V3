"use client";

import { useMarketStore } from '@/lib/market-store';
import { TrendingUp, TrendingDown, Minus, Activity, BarChart3, Zap, ArrowUpRight, ArrowDownRight, Minus as MinusIcon } from 'lucide-react';

type IntelCard = {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'bullish' | 'bearish' | 'neutral';
};

export function QuickIntelPanel() {
  const { currentPrice, trend, volatility } = useMarketStore();

  // Mock intel data - in production, this would come from real analysis
  const intelCards: IntelCard[] = [
    {
      label: 'Momentum',
      value: 'Bullish',
      icon: <Activity className="w-4 h-4" />,
      color: 'bullish',
    },
    {
      label: 'Volatility',
      value: volatility === 'high' ? 'High' : volatility === 'medium' ? 'Medium' : 'Low',
      icon: <BarChart3 className="w-4 h-4" />,
      color: volatility === 'high' ? 'bearish' : volatility === 'medium' ? 'neutral' : 'bullish',
    },
    {
      label: 'Trend Strength',
      value: 'Strong',
      icon: <Zap className="w-4 h-4" />,
      color: 'bullish',
    },
    {
      label: 'EMA Bias',
      value: trend === 'bullish' ? 'Uptrend' : trend === 'bearish' ? 'Downtrend' : 'Sideways',
      icon: trend === 'bullish' ? <ArrowUpRight className="w-4 h-4" /> : trend === 'bearish' ? <ArrowDownRight className="w-4 h-4" /> : <MinusIcon className="w-4 h-4" />,
      color: trend === 'bullish' ? 'bullish' : trend === 'bearish' ? 'bearish' : 'neutral',
    },
    {
      label: 'Volume Surge',
      value: '+18%',
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'bullish',
    },
    {
      label: 'Regime',
      value: 'Breakout',
      icon: <Activity className="w-4 h-4" />,
      color: 'bullish',
    },
  ];

  const getColorClass = (color: 'bullish' | 'bearish' | 'neutral') => {
    switch (color) {
      case 'bullish':
        return 'text-bullish';
      case 'bearish':
        return 'text-bearish';
      case 'neutral':
        return 'text-neutral';
    }
  };

  const getBgClass = (color: 'bullish' | 'bearish' | 'neutral') => {
    switch (color) {
      case 'bullish':
        return 'bg-bullish-dim';
      case 'bearish':
        return 'bg-bearish-dim';
      case 'neutral':
        return 'bg-neutral-dim';
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 border border-subtle">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
        Quick Intel
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {intelCards.map((card, index) => (
          <div
            key={index}
            className="bg-card rounded-lg p-3 border border-subtle hover:border-subtle/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded ${getBgClass(card.color)}`}>
                <div className={getColorClass(card.color)}>
                  {card.icon}
                </div>
              </div>
              <span className="text-xs text-muted">{card.label}</span>
            </div>
            <div className={`text-sm font-semibold ${getColorClass(card.color)}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
