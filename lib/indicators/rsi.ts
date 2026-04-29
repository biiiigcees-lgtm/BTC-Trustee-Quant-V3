import { OHLC } from "../types";

/**
 * Calculate Relative Strength Index (RSI) from an array of prices.
 * @param prices - Array of price values (typically close prices)
 * @param period - RSI period (default: 14)
 * @returns Array of RSI values (0-100)
 */
export function calculateRSI(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return [];
  
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate gains and losses
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Seed with average gains/losses
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // Calculate RSI using Wilder's smoothing method
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  
  return rsi;
}

/**
 * React hook to calculate RSI from OHLC data.
 * @param data - Array of OHLC candles
 * @param period - RSI period
 * @returns Array of RSI values
 */
export function useRSI(data: OHLC[], period: number): number[] {
  const closePrices = data.map((d) => d.close);
  return calculateRSI(closePrices, period);
}
