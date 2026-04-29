import { OHLC } from "../types";

/**
 * Calculate Bollinger Bands from an array of prices.
 * @param prices - Array of price values (typically close prices)
 * @param period - Bollinger period (default: 20)
 * @param multiplier - Standard deviation multiplier (default: 2)
 * @returns Object containing upper, middle, and lower band arrays
 */
export function calculateBollinger(
  prices: number[],
  period = 20,
  multiplier = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  if (prices.length < period) return { upper: [], middle: [], lower: [] };
  
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    middle.push(mean);
    upper.push(mean + multiplier * std);
    lower.push(mean - multiplier * std);
  }
  
  return { upper, middle, lower };
}

/**
 * React hook to calculate Bollinger Bands from OHLC data.
 * @param data - Array of OHLC candles
 * @param period - Bollinger period
 * @param multiplier - Standard deviation multiplier
 * @returns Object containing upper, middle, and lower band arrays
 */
export function useBollinger(
  data: OHLC[],
  period: number,
  multiplier: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const closePrices = data.map((d) => d.close);
  return calculateBollinger(closePrices, period, multiplier);
}
