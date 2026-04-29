import { OHLC } from "../types";

/**
 * Calculate Exponential Moving Average (EMA) from an array of prices.
 * @param prices - Array of price values (typically close prices)
 * @param period - EMA period (default: 20)
 * @returns Array of EMA values
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  
  const k = 2 / (period + 1);
  const ema: number[] = [];
  
  // Seed with SMA for the first period
  let currentEMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(currentEMA);
  
  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    currentEMA = prices[i] * k + currentEMA * (1 - k);
    ema.push(currentEMA);
  }
  
  return ema;
}

/**
 * React hook to calculate EMA from OHLC data.
 * @param data - Array of OHLC candles
 * @param period - EMA period
 * @returns Array of EMA values
 */
export function useEMA(data: OHLC[], period: number): number[] {
  const closePrices = data.map((d) => d.close);
  return calculateEMA(closePrices, period);
}
