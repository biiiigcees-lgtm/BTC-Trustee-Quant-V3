"use client";

import { useState, useEffect } from 'react';
import { useMarketStore } from '@/lib/market-store';
import { TrendingUp, TrendingDown, Minus, Clock, Target, AlertTriangle, Gauge } from 'lucide-react';

type SignalType = 'BUY_YES' | 'BUY_NO' | 'PASS';

interface SignalData {
  contract: string;
  strikePrice: number;
  timeLeft: number;
  signal: SignalType;
  confidence: number;
  riskGrade: string;
  expectedEdge: number;
}

export function HeroSignalCard() {
  const { currentPrice } = useMarketStore();
  const [signalData, setSignalData] = useState<SignalData>({
    contract: 'BTC 15-Min Contract',
    strikePrice: 76500,
    timeLeft: 445,
    signal: 'BUY_YES',
    confidence: 74,
    riskGrade: 'B+',
    expectedEdge: 6.2,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSignalData((prev) => ({
        ...prev,
        timeLeft: Math.max(0, prev.timeLeft - 1),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentPrice) {
      const roundedStrike = Math.round(currentPrice / 500) * 500;
      setSignalData((prev) => ({
        ...prev,
        strikePrice: roundedStrike,
      }));
    }
  }, [currentPrice]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getSignalColor = (signal: SignalType) => {
    switch (signal) {
      case 'BUY_YES':
        return 'text-bullish';
      case 'BUY_NO':
        return 'text-bearish';
      case 'PASS':
        return 'text-neutral';
    }
  };

  const getSignalIcon = (signal: SignalType) => {
    switch (signal) {
      case 'BUY_YES':
        return <TrendingUp className="w-6 h-6" />;
      case 'BUY_NO':
        return <TrendingDown className="w-6 h-6" />;
      case 'PASS':
        return <Minus className="w-6 h-6" />;
    }
  };

  const getConfidenceGrade = (confidence: number) => {
    if (confidence >= 75) return 'A';
    if (confidence >= 65) return 'B';
    if (confidence >= 55) return 'C';
    return 'D';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return 'bg-bullish';
    if (confidence >= 65) return 'bg-accent-cyan';
    if (confidence >= 55) return 'bg-neutral';
    return 'bg-bearish';
  };

  const getRiskGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-bullish';
    if (grade.startsWith('B')) return 'text-neutral';
    return 'text-bearish';
  };

  const isUrgent = signalData.timeLeft < 60;

  return (
    <div className="bg-surface rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-l-4 ${
            signalData.signal === 'BUY_YES' 
              ? 'bg-elevated border-bullish-bright' 
              : signalData.signal === 'BUY_NO' 
              ? 'bg-elevated border-bearish-bright' 
              : 'bg-elevated border-neutral-bright'
          }`}>
            {signalData.signal === 'BUY_YES' && <TrendingUp className="w-6 h-6 text-bullish-bright" />}
            {signalData.signal === 'BUY_NO' && <TrendingDown className="w-6 h-6 text-bearish-bright" />}
            {signalData.signal === 'PASS' && <Minus className="w-6 h-6 text-neutral-bright" />}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">
              {signalData.contract}
            </div>
            <div className="text-sm text-muted">
              Strike: ${signalData.strikePrice.toLocaleString()}
            </div>
          </div>
        </div>
        <div className={`px-4 py-2 rounded font-bold text-lg ${
          signalData.signal === 'BUY_YES' 
            ? 'bg-bullish text-primary' 
            : signalData.signal === 'BUY_NO' 
            ? 'bg-bearish text-primary' 
            : 'bg-neutral text-primary'
        }`}>
          {signalData.signal.replace('_', ' ')}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted">Confidence</span>
          <span className={`text-2xl font-bold ${
            signalData.confidence >= 70 ? 'text-bullish-bright' : 
            signalData.confidence >= 50 ? 'text-neutral-bright' : 'text-bearish-bright'
          }`}>
            {signalData.confidence}%
          </span>
        </div>
        <div className="h-3 bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              signalData.confidence >= 70 ? 'bg-bullish-bright' : 
              signalData.confidence >= 50 ? 'bg-neutral-bright' : 'bg-bearish-bright'
            }`}
            style={{ width: `${signalData.confidence}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 border border-subtle">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">
            Risk Grade
          </div>
          <div className={`text-2xl font-bold ${getRiskGradeColor(signalData.riskGrade)}`}>
            {signalData.riskGrade}
          </div>
        </div>

        <div className="bg-card rounded-lg p-4 border border-subtle">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">
            Expected Edge
          </div>
          <div className={`text-2xl font-bold ${signalData.expectedEdge > 0 ? 'text-bullish' : 'text-bearish'}`}>
            {signalData.expectedEdge > 0 ? '+' : ''}
            {signalData.expectedEdge}%
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className={`flex-1 py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
            signalData.signal === 'BUY_YES'
              ? 'bg-bullish text-white hover:bg-bullish/90 shadow-lg shadow-bullish/20'
              : 'bg-card text-muted hover:bg-card/80 border border-subtle'
          }`}
        >
          Buy YES
        </button>
        <button
          className={`flex-1 py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
            signalData.signal === 'BUY_NO'
              ? 'bg-bearish text-white hover:bg-bearish/90 shadow-lg shadow-bearish/20'
              : 'bg-card text-muted hover:bg-card/80 border border-subtle'
          }`}
        >
          Buy NO
        </button>
        <button className="flex-1 py-4 px-6 rounded-lg font-semibold text-lg bg-card text-muted hover:bg-card/80 border border-subtle transition-all">
          Watch Only
        </button>
      </div>

      {isUrgent && (
        <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-bearish-dim rounded-lg border border-bearish/30">
          <AlertTriangle className="w-4 h-4 text-bearish" />
          <span className="text-sm text-bearish font-medium">
            Contract expiring soon - act quickly
          </span>
        </div>
      )}
    </div>
  );
}
