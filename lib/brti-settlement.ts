// BRTI Settlement Calculator for Kalshi KXBTC15M Contracts
// Implements 60-second BRTI average calculation for contract settlement

export interface BRTIPricePoint {
  timestamp: number;
  price: number;
}

export interface BRTISettlementResult {
  settlementPrice: number;
  pricePoints: BRTIPricePoint[];
  averageWindow: number; // seconds
  windowStart: number;
  windowEnd: number;
  dataSource: string;
}

export interface BRTIFetchOptions {
  dataSource?: 'cf-benchmarks' | 'coinbase' | 'binance' | 'kraken';
  fallbackSources?: string[];
  cacheEnabled?: boolean;
  cacheTTL?: number; // seconds
}

/**
 * BRTI Settlement Calculator
 * 
 * Kalshi KXBTC15M contracts settle based on the CME CF Bitcoin Real-Time Index (BRTI).
 * The official settlement value is the average of the 60 seconds of BRTI data
 * immediately before contract expiration.
 */
export class BRTISettlementCalculator {
  private static readonly SETTLEMENT_WINDOW_SECONDS = 60;
  private static readonly BRTI_UPDATE_INTERVAL_MS = 1000; // BRTI updates once per second

  /**
   * Calculate the 60-second BRTI average for settlement
   * @param expiryTime - Contract expiration timestamp (Unix ms)
   * @param priceHistory - Array of price points with timestamps
   * @returns Settlement result with average price
   */
  public static calculateSettlement(
    expiryTime: number,
    priceHistory: BRTIPricePoint[]
  ): BRTISettlementResult {
    const windowEnd = expiryTime;
    const windowStart = expiryTime - (this.SETTLEMENT_WINDOW_SECONDS * 1000);

    // Filter price points within the 60-second window before expiry
    const windowPrices = priceHistory.filter(
      (point) => point.timestamp >= windowStart && point.timestamp <= windowEnd
    );

    if (windowPrices.length === 0) {
      throw new Error(
        `No price data found in settlement window [${new Date(windowStart).toISOString()} - ${new Date(windowEnd).toISOString()}]`
      );
    }

    // Calculate arithmetic mean
    const sum = windowPrices.reduce((acc, point) => acc + point.price, 0);
    const settlementPrice = sum / windowPrices.length;

    return {
      settlementPrice,
      pricePoints: windowPrices,
      averageWindow: this.SETTLEMENT_WINDOW_SECONDS,
      windowStart,
      windowEnd,
      dataSource: 'historical',
    };
  }

  /**
   * Fetch BRTI data from CF Benchmarks API
   * Note: This requires API access to CF Benchmarks
   * @param startTime - Start timestamp (Unix ms)
   * @param endTime - End timestamp (Unix ms)
   * @returns Array of BRTI price points
   */
  public static async fetchBRTIFromCFBenchmarks(
    startTime: number,
    endTime: number
  ): Promise<BRTIPricePoint[]> {
    // CF Benchmarks API endpoint (requires authentication)
    const apiUrl = 'https://www.cfbenchmarks.com/api/index/btri/v1/price/history';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add CF Benchmarks API key if available
          // 'Authorization': `Bearer ${process.env.CF_BENCHMARKS_API_KEY}`,
        },
        body: JSON.stringify({
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          frequency: '1s', // 1-second intervals
        }),
      });

      if (!response.ok) {
        throw new Error(`CF Benchmarks API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform CF Benchmarks response to BRTIPricePoint format
      return data.prices.map((p: any) => ({
        timestamp: new Date(p.timestamp).getTime(),
        price: p.price,
      }));
    } catch (error) {
      console.error('Failed to fetch BRTI from CF Benchmarks:', error);
      throw error;
    }
  }

  /**
   * Fetch BTC price data from Coinbase as BRTI fallback
   * Coinbase trades can be used as a proxy for BRTI when CF Benchmarks is unavailable
   * @param startTime - Start timestamp (Unix ms)
   * @param endTime - End timestamp (Unix ms)
   * @returns Array of price points
   */
  public static async fetchBTCFromCoinbase(
    startTime: number,
    endTime: number
  ): Promise<BRTIPricePoint[]> {
    const apiUrl = 'https://api.exchange.coinbase.com/products/BTC-USD/trades';

    try {
      const response = await fetch(
        `${apiUrl}?after=${Math.floor(startTime / 1000)}&before=${Math.floor(endTime / 1000)}&limit=1000`
      );

      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.statusText}`);
      }

      const trades = await response.json();

      // Aggregate trades to 1-second intervals
      const secondMap = new Map<number, number[]>();

      for (const trade of trades) {
        const second = Math.floor(trade.trade_id / 1000000) * 1000; // Approximate second
        if (!secondMap.has(second)) {
          secondMap.set(second, []);
        }
        secondMap.get(second)!.push(parseFloat(trade.price));
      }

      // Calculate average price for each second
      const pricePoints: BRTIPricePoint[] = [];
      for (const [second, prices] of secondMap.entries()) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        pricePoints.push({
          timestamp: second,
          price: avgPrice,
        });
      }

      return pricePoints.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to fetch BTC from Coinbase:', error);
      throw error;
    }
  }

  /**
   * Calculate settlement with automatic data source fallback
   * @param expiryTime - Contract expiration timestamp (Unix ms)
   * @param options - Fetch options
   * @returns Settlement result
   */
  public static async calculateSettlementWithFallback(
    expiryTime: number,
    options: BRTIFetchOptions = {}
  ): Promise<BRTISettlementResult> {
    const windowEnd = expiryTime;
    const windowStart = expiryTime - (this.SETTLEMENT_WINDOW_SECONDS * 1000);

    const sources = options.fallbackSources || ['cf-benchmarks', 'coinbase'];

    for (const source of sources) {
      try {
        let priceHistory: BRTIPricePoint[];

        switch (source) {
          case 'cf-benchmarks':
            priceHistory = await this.fetchBRTIFromCFBenchmarks(windowStart, windowEnd);
            break;
          case 'coinbase':
            priceHistory = await this.fetchBTCFromCoinbase(windowStart, windowEnd);
            break;
          default:
            throw new Error(`Unknown data source: ${source}`);
        }

        const result = this.calculateSettlement(expiryTime, priceHistory);
        return { ...result, dataSource: source };
      } catch (error) {
        console.warn(`Failed to fetch from ${source}, trying next source...`);
        continue;
      }
    }

    throw new Error('All data sources failed to fetch price data');
  }

  /**
   * Validate that we have sufficient data for settlement
   * @param priceHistory - Price history array
   * @param expiryTime - Contract expiration timestamp
   * @returns Validation result
   */
  public static validateSettlementData(
    priceHistory: BRTIPricePoint[],
    expiryTime: number
  ): { valid: boolean; reason?: string; coverage: number } {
    const windowStart = expiryTime - (this.SETTLEMENT_WINDOW_SECONDS * 1000);
    const windowEnd = expiryTime;

    const windowPrices = priceHistory.filter(
      (point) => point.timestamp >= windowStart && point.timestamp <= windowEnd
    );

    const coverage = windowPrices.length / this.SETTLEMENT_WINDOW_SECONDS;

    if (windowPrices.length === 0) {
      return { valid: false, reason: 'No data in settlement window', coverage: 0 };
    }

    if (coverage < 0.5) {
      return {
        valid: false,
        reason: `Insufficient data coverage: ${(coverage * 100).toFixed(1)}%`,
        coverage,
      };
    }

    if (coverage < 0.9) {
      return {
        valid: true,
        reason: `Partial data coverage: ${(coverage * 100).toFixed(1)}% - may be less accurate`,
        coverage,
      };
    }

    return { valid: true, coverage };
  }

  /**
   * Get the next KXBTC15M contract expiry time
   * Kalshi 15-minute contracts expire at :00, :15, :30, :45 minute marks
   * @param fromTime - Reference timestamp (default: now)
   * @returns Next expiry timestamp
   */
  public static getNextKXBTC15MExpiry(fromTime: number = Date.now()): number {
    const date = new Date(fromTime);
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();

    // Calculate minutes to next 15-minute boundary
    const minutesToNext = 15 - (minutes % 15);
    const nextExpiry = new Date(fromTime);
    
    if (minutesToNext === 15 && seconds === 0 && milliseconds === 0) {
      // Exactly on a boundary, use this time
      return fromTime;
    }

    nextExpiry.setMinutes(minutes + minutesToNext);
    nextExpiry.setSeconds(0);
    nextExpiry.setMilliseconds(0);

    return nextExpiry.getTime();
  }

  /**
   * Get all KXBTC15M expiry times in a range
   * @param startTime - Start timestamp
   * @param endTime - End timestamp
   * @returns Array of expiry timestamps
   */
  public static getKXBTC15MExpiryRange(
    startTime: number,
    endTime: number
  ): number[] {
    const expiries: number[] = [];
    let current = this.getNextKXBTC15MExpiry(startTime);

    while (current <= endTime) {
      expiries.push(current);
      current += 15 * 60 * 1000; // Add 15 minutes
    }

    return expiries;
  }
}
