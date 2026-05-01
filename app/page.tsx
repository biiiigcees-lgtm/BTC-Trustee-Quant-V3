"use client";

import { PremiumNavbar } from "@/components/premium-navbar";
import { HeroSignalCard } from "@/components/hero-signal-card";
import { QuickIntelPanel } from "@/components/quick-intel-panel";
import { PremiumBTCChart } from "@/components/premium-btc-chart";
import { HistoricalPerformance } from "@/components/historical-performance";
import { PerformanceAnalytics } from "@/components/performance-analytics";
import { AIInsights } from "@/components/ai-insights";
import { ConsensusPanel } from "@/components/consensus-panel";
import { useMarketStore } from "@/lib/market-store";
import { getWebSocketFeed } from "@/lib/websocket-feed";
import { Clock } from 'lucide-react';
import { useEffect, useRef } from "react";

function UnifiedDashboard() {
  const { currentPrice, updatePrice, update24hStats, updateLatency, updateTrend, updateVolatility } = useMarketStore();
  const wsFeedRef = useRef<ReturnType<typeof getWebSocketFeed> | null>(null);

  // Initial REST fetch for price
  useEffect(() => {
    const fetchInitialPrice = async () => {
      try {
        const res = await fetch('/api/btc');
        if (res.ok) {
          const data = await res.json();
          if (data.price) {
            updatePrice(data.price, 'binance');
            update24hStats(data.high24h || 77000, data.low24h || 76000, data.volume24h || 1500000000);
            updateLatency(45);
            updateTrend('bullish');
            updateVolatility('medium');
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial price:', error);
        // Fallback to default values
        updatePrice(76500, 'binance');
        update24hStats(77000, 76000, 1500000000);
        updateLatency(45);
        updateTrend('bullish');
        updateVolatility('medium');
      }
    };

    fetchInitialPrice();
  }, [updatePrice, update24hStats, updateLatency, updateTrend, updateVolatility]);

  useEffect(() => {
    wsFeedRef.current = getWebSocketFeed('binance');
    wsFeedRef.current.connect();

    return () => {
      if (wsFeedRef.current) {
        wsFeedRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-base pb-20 lg:pb-6">
      <PremiumNavbar />
      
      {/* Kalshi 15m Countdown Timer Strip */}
      <div className="sticky top-[72px] z-40 bg-elevated border-b border-mid px-4 lg:px-6 py-2">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-cyan-bright" />
            <span className="text-muted">Kalshi 15m Window:</span>
            <span className="font-mono font-bold text-primary">12:45</span>
          </div>
          <div className="text-muted">Next expiry in 8m 32s</div>
        </div>
      </div>
      
      <main className="max-w-[1800px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Row 1: Contract Signal (5) | Chart (7) */}
          <div className="col-span-1 lg:col-span-5">
            <HeroSignalCard />
          </div>

          <div className="col-span-1 lg:col-span-7">
            <PremiumBTCChart />
          </div>

          {/* Row 2: AI Consensus (4) | Quick Intel (4) | Performance (4) */}
          <div className="col-span-1 lg:col-span-4">
            <ConsensusPanel />
          </div>

          <div className="col-span-1 lg:col-span-4">
            <QuickIntelPanel />
          </div>

          <div className="col-span-1 lg:col-span-4">
            <PerformanceAnalytics />
          </div>

          {/* Row 3: Trade History (8) | Weekly Stats (4) */}
          <div className="col-span-1 lg:col-span-8">
            <HistoricalPerformance />
          </div>

          <div className="col-span-1 lg:col-span-4">
            <AIInsights />
          </div>
        </div>

        <div className="mt-6 lg:mt-8 text-center text-xs text-muted">
          FOR EDUCATIONAL PURPOSES ONLY · NOT FINANCIAL ADVICE
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-elevated border-t border-mid p-4 z-50">
        <div className="flex gap-3">
          <button className="flex-1 py-3 px-4 rounded font-semibold bg-bullish text-primary">
            Buy YES
          </button>
          <button className="flex-1 py-3 px-4 rounded font-semibold bg-bearish text-primary">
            Buy NO
          </button>
          <button className="flex-1 py-3 px-4 rounded font-semibold bg-surface text-muted border border-mid">
            Watch
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return <UnifiedDashboard />;
}
