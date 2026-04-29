import { OHLC } from "../types";

/**
 * Extract volume data from OHLC candles.
 * @param data - Array of OHLC candles
 * @returns Array of volume values
 */
export function useVolume(data: OHLC[]): number[] {
  return data.map((d) => d.volume ?? 0);
}
