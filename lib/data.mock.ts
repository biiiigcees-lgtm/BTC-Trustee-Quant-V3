import { OHLC } from "./types";

/**
 * Generate mock OHLC candle data for testing and development.
 * @param count - Number of candles to generate
 * @param startPrice - Starting price (default: 50000)
 * @returns Array of OHLC objects
 */
export function generateMockData(count: number, startPrice = 50000): OHLC[] {
  const data: OHLC[] = [];
  let price = startPrice;
  const now = Date.now();
  const interval = 60000; // 1 minute

  for (let i = 0; i < count; i++) {
    const volatility = price * 0.002; // 0.2% volatility
    const change = (Math.random() - 0.5) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.random() * 1000 + 100;

    data.push({
      timestamp: now - (count - i) * interval,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return data;
}
