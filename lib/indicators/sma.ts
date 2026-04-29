import { OHLC } from "../types";

/**
 * Calculate Simple Moving Average (SMA) from an array of prices.
 * @param prices - Array of price values (typically close prices)
 * @param period - SMA period (default: 50)
 * @returns Array of SMA values
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  
  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    sma.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  
  return sma;
}

/**
 * React hook to calculate SMA from OHLC data.
 * @param data - Array of OHLC candles
 * @param period - SMA period
 * @returns Array of SMA values
 */
export function useSMA(data: OHLC[], period: number): number[] {
  const closePrices = data.map((d) => d.close);
  return calculateSMA(closePrices, period);
}
