import { OHLC } from "../types";

/**
 * Calculate MACD (Moving Average Convergence Divergence) from an array of prices.
 * @param prices - Array of price values (typically close prices)
 * @param fast - Fast EMA period (default: 12)
 * @param slow - Slow EMA period (default: 26)
 * @param signal - Signal line EMA period (default: 9)
 * @returns Object containing MACD line, signal line, and histogram
 */
export function calculateMACD(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { line: number[]; signal: number[]; histogram: number[] } {
  if (prices.length < slow + signal) {
    return { line: [], signal: [], histogram: [] };
  }
  
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSignal = 2 / (signal + 1);
  
  // Calculate EMAs
  let emaFast = prices.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
  let emaSlow = prices.slice(0, slow).reduce((a, b) => a + b, 0) / slow;
  
  const macdLine: number[] = [];
  
  // Sync EMAs to the slow period
  for (let i = fast; i < slow; i++) {
    emaFast = prices[i] * kFast + emaFast * (1 - kFast);
  }
  
  // Calculate MACD line
  for (let i = slow; i < prices.length; i++) {
    emaFast = prices[i] * kFast + emaFast * (1 - kFast);
    emaSlow = prices[i] * kSlow + emaSlow * (1 - kSlow);
    macdLine.push(emaFast - emaSlow);
  }
  
  // Calculate signal line
  let emaSignal = macdLine.slice(0, signal).reduce((a, b) => a + b, 0) / signal;
  const signalLine: number[] = [];
  
  for (let i = signal; i < macdLine.length; i++) {
    emaSignal = macdLine[i] * kSignal + emaSignal * (1 - kSignal);
    signalLine.push(emaSignal);
  }
  
  // Calculate histogram
  const histogram = signalLine.map((s, i) => macdLine[i + signal] - s);
  
  return { line: macdLine, signal: signalLine, histogram };
}

/**
 * React hook to calculate MACD from OHLC data.
 * @param data - Array of OHLC candles
 * @param fast - Fast EMA period
 * @param slow - Slow EMA period
 * @param signal - Signal line EMA period
 * @returns Object containing MACD line, signal line, and histogram
 */
export function useMACD(
  data: OHLC[],
  fast: number,
  slow: number,
  signal: number
): { line: number[]; signal: number[]; histogram: number[] } {
  const closePrices = data.map((d) => d.close);
  return calculateMACD(closePrices, fast, slow, signal);
}
