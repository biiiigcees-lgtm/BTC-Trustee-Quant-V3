// Unified types for trading-indicator dashboard

// OHLC Candle Data
export interface OHLC {
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
}

// Indicator Value Types
export interface EMAValues {
  readonly values: number[];
  readonly period: number;
}

export interface SMAValues {
  readonly values: number[];
  readonly period: number;
}

export interface RSIValues {
  readonly values: number[];
  readonly period: number;
  readonly overbought: number;
  readonly oversold: number;
}

export interface BollingerValues {
  readonly upper: number[];
  readonly middle: number[];
  readonly lower: number[];
  readonly period: number;
  readonly multiplier: number;
}

export interface MACDValues {
  readonly line: number[];
  readonly signal: number[];
  readonly histogram: number[];
  readonly fast: number;
  readonly slow: number;
  readonly signalPeriod: number;
}

// Trading Signal (General, not Kalshi-specific)
export interface TradingSignal {
  readonly id: string;
  readonly timestamp: number;
  readonly direction: "BUY" | "SELL";
  readonly strength: 1 | 2 | 3;
  readonly reason: string;
  readonly price: number;
}

// Indicator Configuration
export interface IndicatorConfig {
  ema: { readonly enabled: boolean; readonly period: number; readonly color: string };
  sma: { readonly enabled: boolean; readonly period: number; readonly color: string };
  rsi: { readonly enabled: boolean; readonly period: number; readonly overbought: number; readonly oversold: number };
  bollinger: { readonly enabled: boolean; readonly period: number; readonly multiplier: number };
  macd: { readonly enabled: boolean; readonly fast: number; readonly slow: number; readonly signal: number };
  volume: { readonly enabled: boolean };
}

// Backtest Result
export interface BacktestResult {
  readonly totalTrades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly totalProfit: number;
  readonly totalLoss: number;
  readonly netProfit: number;
  readonly profitFactor: number;
  readonly maxDrawdown: number;
  readonly averageWin: number;
  readonly averageLoss: number;
  readonly finalCapital: number;
  readonly totalReturn: number;
}
