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
import { useEffect, useRef } from "react";

function UnifiedDashboard() {
  const { currentPrice } = useMarketStore();
  const wsFeedRef = useRef<ReturnType<typeof getWebSocketFeed> | null>(null);

  useEffect(() => {
    if (!currentPrice) {
      useMarketStore.getState().updatePrice(76500, 'binance');
      useMarketStore.getState().update24hStats(77000, 76000, 1500000000);
      useMarketStore.getState().updateLatency(45);
      useMarketStore.getState().updateTrend('bullish');
      useMarketStore.getState().updateVolatility('medium');
    }
  }, [currentPrice]);

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
    <div className="min-h-screen bg-primary pb-20 lg:pb-6">
      <PremiumNavbar />
      
      <main className="max-w-[1800px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-1 lg:col-span-8">
            <HeroSignalCard />
          </div>

          <div className="col-span-1 lg:col-span-4 space-y-4 lg:space-y-6">
            <QuickIntelPanel />
            <AIInsights />
            <ConsensusPanel />
          </div>

          <div className="col-span-1 lg:col-span-8">
            <PremiumBTCChart />
          </div>

          <div className="col-span-1 lg:col-span-4 space-y-4 lg:space-y-6">
            <HistoricalPerformance />
            <PerformanceAnalytics />
          </div>
        </div>

        <div className="mt-6 lg:mt-8 text-center text-xs text-muted">
          FOR EDUCATIONAL PURPOSES ONLY · NOT FINANCIAL ADVICE
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-card border-t border-subtle p-4 z-50">
        <div className="flex gap-3">
          <button className="flex-1 py-3 px-4 rounded-lg font-semibold bg-bullish text-white shadow-lg shadow-bullish/20">
            Buy YES
          </button>
          <button className="flex-1 py-3 px-4 rounded-lg font-semibold bg-bearish text-white shadow-lg shadow-bearish/20">
            Buy NO
          </button>
          <button className="flex-1 py-3 px-4 rounded-lg font-semibold bg-card text-muted border border-subtle">
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
