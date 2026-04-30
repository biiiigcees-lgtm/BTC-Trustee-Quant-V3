import { create } from 'zustand';

export type FeedSource = 'binance' | 'kraken' | 'coinbase';
export type Trend = 'bullish' | 'bearish' | 'neutral';
export type Volatility = 'low' | 'medium' | 'high';

export interface MarketState {
  // Price data
  currentPrice: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  
  // Feed metadata
  latency: number;
  source: FeedSource;
  updatedAt: number | null;
  
  // Market state
  trend: Trend;
  volatility: Volatility;
  
  // Actions
  updatePrice: (price: number, source: FeedSource) => void;
  switchSource: (source: FeedSource) => void;
  update24hStats: (high: number, low: number, volume: number) => void;
  updateLatency: (latency: number) => void;
  updateTrend: (trend: Trend) => void;
  updateVolatility: (volatility: Volatility) => void;
  reset: () => void;
}

const initialState = {
  currentPrice: null,
  high24h: null,
  low24h: null,
  volume24h: null,
  latency: 0,
  source: 'binance' as FeedSource,
  updatedAt: null,
  trend: 'neutral' as Trend,
  volatility: 'medium' as Volatility,
};

export const useMarketStore = create<MarketState>((set) => ({
  ...initialState,

  updatePrice: (price, source) =>
    set((state) => ({
      currentPrice: price,
      source,
      updatedAt: Date.now(),
    })),

  switchSource: (source) =>
    set((state) => ({
      source,
    })),

  update24hStats: (high, low, volume) =>
    set((state) => ({
      high24h: high,
      low24h: low,
      volume24h: volume,
    })),

  updateLatency: (latency) =>
    set((state) => ({
      latency,
    })),

  updateTrend: (trend) =>
    set((state) => ({
      trend,
    })),

  updateVolatility: (volatility) =>
    set((state) => ({
      volatility,
    })),

  reset: () => set(initialState),
}));
