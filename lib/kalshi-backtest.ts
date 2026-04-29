// Kalshi KXBTC15M Backtest Engine
// Implements historical backtesting with 60-second BRTI settlement calculations

import { BRTISettlementCalculator, BRTIPricePoint } from './brti-settlement';
import { getKalshiJWT } from './kalshi-jwt';

export interface KalshiMarket {
  ticker: string;
  strikePrice: number;
  expiryTime: number;
  yesPrice: number; // cents (0-99)
  noPrice: number; // cents (0-99)
  impliedProbability: number;
  contractType: 'ABOVE' | 'BELOW';
}

export interface BacktestTrade {
  market: KalshiMarket;
  decision: 'YES' | 'NO' | 'HOLD';
  confidence: number;
  predictedProbability: number;
  amount: number;
  entryPrice: number;
  settlementPrice: number;
  outcome: 'WIN' | 'LOSS' | 'PENDING';
  payout: number;
  profitLoss: number;
  reason: string;
}

export interface BacktestConfig {
  startTime: number;
  endTime: number;
  initialCapital: number;
  positionSizePercent: number;
  confidenceThreshold: number; // Minimum confidence to trade
  safeBetThreshold: number; // Confidence for "safe bet" classification
  maxConsecutiveLosses: number;
  strategy: 'aggressive' | 'conservative' | 'ultra-conservative';
}

export interface BacktestSummary {
  totalMarkets: number;
  totalTrades: number;
  wins: number;
  losses: number;
  holds: number;
  winRate: number;
  totalInvested: number;
  totalPayout: number;
  netProfitLoss: number;
  finalCapital: number;
  totalReturn: number;
  maxDrawdown: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  consecutiveLosses: number;
  safeBets: number;
  safeBetWinRate: number;
}

/**
 * Kalshi KXBTC15M Backtest Engine
 * 
 * Backtests trading strategies against historical KXBTC15M markets.
 * Uses 60-second BRTI average for settlement calculation.
 */
export class KalshiBacktestEngine {
  private priceHistory: BRTIPricePoint[] = [];
  private markets: KalshiMarket[] = [];

  /**
   * Load historical price data
   */
  loadPriceHistory(history: BRTIPricePoint[]): void {
    this.priceHistory = history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Load historical Kalshi markets
   */
  loadMarkets(markets: KalshiMarket[]): void {
    this.markets = markets.sort((a, b) => a.expiryTime - b.expiryTime);
  }

  /**
   * Run backtest with given configuration
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestSummary> {
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let maxCapital = config.initialCapital;
    let maxDrawdown = 0;
    let consecutiveLosses = 0;
    let safeBets = 0;
    let safeBetWins = 0;

    // Filter markets within time range
    const relevantMarkets = this.markets.filter(
      (m) => m.expiryTime >= config.startTime && m.expiryTime <= config.endTime
    );

    console.log(`Backtesting ${relevantMarkets.length} markets from ${new Date(config.startTime).toISOString()} to ${new Date(config.endTime).toISOString()}`);

    for (const market of relevantMarkets) {
      // Check consecutive loss limit
      if (consecutiveLosses >= config.maxConsecutiveLosses) {
        console.log(`Skipping trade due to consecutive loss limit (${consecutiveLosses})`);
        trades.push({
          market,
          decision: 'HOLD',
          confidence: 0,
          predictedProbability: 0,
          amount: 0,
          entryPrice: 0,
          settlementPrice: 0,
          outcome: 'PENDING',
          payout: 0,
          profitLoss: 0,
          reason: 'Consecutive loss limit reached',
        });
        continue;
      }

      // Get decision from strategy
      const decision = this.getStrategyDecision(market, config);

      if (decision.decision === 'HOLD') {
        trades.push({
          market,
          decision: 'HOLD',
          confidence: decision.confidence,
          predictedProbability: decision.predictedProbability,
          amount: 0,
          entryPrice: 0,
          settlementPrice: 0,
          outcome: 'PENDING',
          payout: 0,
          profitLoss: 0,
          reason: decision.reason,
        });
        continue;
      }

      // Calculate position size
      const positionSize = capital * (config.positionSizePercent / 100);

      // Calculate settlement price using BRTI
      let settlementPrice: number;
      try {
        const settlement = BRTISettlementCalculator.calculateSettlement(
          market.expiryTime,
          this.priceHistory
        );
        settlementPrice = settlement.settlementPrice;
      } catch (error) {
        console.error(`Failed to calculate settlement for market ${market.ticker}:`, error);
        continue;
      }

      // Determine outcome
      const outcome = this.determineOutcome(market, settlementPrice);

      // Calculate payout
      const payout = this.calculatePayout(
        decision.decision,
        market,
        positionSize,
        outcome
      );

      const profitLoss = payout - positionSize;

      // Update capital
      capital += profitLoss;

      // Track drawdown
      if (capital > maxCapital) {
        maxCapital = capital;
      } else {
        const drawdown = (maxCapital - capital) / maxCapital;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      // Track consecutive losses
      if (outcome === 'LOSS') {
        consecutiveLosses++;
      } else {
        consecutiveLosses = 0;
      }

      // Track safe bets
      if (decision.confidence >= config.safeBetThreshold) {
        safeBets++;
        if (outcome === 'WIN') {
          safeBetWins++;
        }
      }

      trades.push({
        market,
        decision: decision.decision,
        confidence: decision.confidence,
        predictedProbability: decision.predictedProbability,
        amount: positionSize,
        entryPrice: decision.decision === 'YES' ? market.yesPrice : market.noPrice,
        settlementPrice,
        outcome,
        payout,
        profitLoss,
        reason: decision.reason,
      });
    }

    // Calculate summary statistics
    const executedTrades = trades.filter((t) => t.decision !== 'HOLD');
    const wins = executedTrades.filter((t) => t.outcome === 'WIN').length;
    const losses = executedTrades.filter((t) => t.outcome === 'LOSS').length;
    const holds = trades.filter((t) => t.decision === 'HOLD').length;
    const winRate = executedTrades.length > 0 ? (wins / executedTrades.length) * 100 : 0;
    const totalInvested = executedTrades.reduce((sum, t) => sum + t.amount, 0);
    const totalPayout = executedTrades.reduce((sum, t) => sum + t.payout, 0);
    const netProfitLoss = totalPayout - totalInvested;
    const totalReturn = ((capital - config.initialCapital) / config.initialCapital) * 100;

    const winAmounts = executedTrades.filter((t) => t.outcome === 'WIN').map((t) => t.profitLoss);
    const lossAmounts = executedTrades.filter((t) => t.outcome === 'LOSS').map((t) => Math.abs(t.profitLoss));
    const averageWin = winAmounts.length > 0 ? winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length : 0;
    const averageLoss = lossAmounts.length > 0 ? lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length : 0;
    const totalWins = winAmounts.reduce((a, b) => a + b, 0);
    const totalLosses = lossAmounts.reduce((a, b) => a + b, 0);
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const safeBetWinRate = safeBets > 0 ? (safeBetWins / safeBets) * 100 : 0;

    return {
      totalMarkets: relevantMarkets.length,
      totalTrades: executedTrades.length,
      wins,
      losses,
      holds,
      winRate,
      totalInvested,
      totalPayout,
      netProfitLoss,
      finalCapital: capital,
      totalReturn,
      maxDrawdown,
      averageWin,
      averageLoss,
      profitFactor,
      consecutiveLosses,
      safeBets,
      safeBetWinRate,
    };
  }

  /**
   * Get trading decision from strategy
   * This is a placeholder - in production, this would call the AI/quant model
   */
  private getStrategyDecision(
    market: KalshiMarket,
    config: BacktestConfig
  ): { decision: 'YES' | 'NO' | 'HOLD'; confidence: number; predictedProbability: number; reason: string } {
    // Placeholder: Simulate AI prediction
    // In production, this would call the actual prediction model
    
    const random = Math.random();
    const predictedProbability = 0.5 + (random - 0.5) * 0.2; // Random between 0.4-0.6
    const confidence = Math.round(predictedProbability * 100);

    // Apply strategy rules
    switch (config.strategy) {
      case 'aggressive':
        if (confidence >= config.confidenceThreshold) {
          if (predictedProbability > 0.5) {
            return {
              decision: 'YES',
              confidence,
              predictedProbability,
              reason: 'Aggressive strategy: probability > 50%',
            };
          } else {
            return {
              decision: 'NO',
              confidence,
              predictedProbability,
              reason: 'Aggressive strategy: probability < 50%',
            };
          }
        }
        break;

      case 'conservative':
        if (confidence >= config.confidenceThreshold + 5) {
          if (predictedProbability > 0.55) {
            return {
              decision: 'YES',
              confidence,
              predictedProbability,
              reason: 'Conservative strategy: probability > 55%',
            };
          } else if (predictedProbability < 0.45) {
            return {
              decision: 'NO',
              confidence,
              predictedProbability,
              reason: 'Conservative strategy: probability < 45%',
            };
          }
        }
        break;

      case 'ultra-conservative':
        if (confidence >= config.safeBetThreshold) {
          if (predictedProbability > 0.6) {
            return {
              decision: 'YES',
              confidence,
              predictedProbability,
              reason: 'Ultra-conservative: probability > 60%',
            };
          } else if (predictedProbability < 0.4) {
            return {
              decision: 'NO',
              confidence,
              predictedProbability,
              reason: 'Ultra-conservative: probability < 40%',
            };
          }
        }
        break;
    }

    return {
      decision: 'HOLD',
      confidence,
      predictedProbability,
      reason: 'Confidence below threshold',
    };
  }

  /**
   * Determine outcome based on settlement price
   */
  private determineOutcome(market: KalshiMarket, settlementPrice: number): 'WIN' | 'LOSS' {
    if (market.contractType === 'ABOVE') {
      return settlementPrice > market.strikePrice ? 'WIN' : 'LOSS';
    } else {
      return settlementPrice < market.strikePrice ? 'WIN' : 'LOSS';
    }
  }

  /**
   * Calculate payout for a trade
   */
  private calculatePayout(
    decision: 'YES' | 'NO',
    market: KalshiMarket,
    amount: number,
    outcome: 'WIN' | 'LOSS'
  ): number {
    if (outcome === 'LOSS') {
      return 0;
    }

    // Kalshi pays $1 per share for winning contracts
    // Entry price is in cents (0-99), so convert to dollars
    const entryPriceCents = decision === 'YES' ? market.yesPrice : market.noPrice;
    const entryPriceDollars = entryPriceCents / 100;
    const shares = amount / entryPriceDollars;

    return shares * 1; // $1 per winning share
  }

  /**
   * Validate backtest results meet performance targets
   */
  validatePerformance(summary: BacktestSummary, targetWinRate: number = 85): {
    passed: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let passed = true;

    if (summary.safeBetWinRate < targetWinRate) {
      passed = false;
      reasons.push(
        `Safe bet win rate ${summary.safeBetWinRate.toFixed(1)}% below target ${targetWinRate}%`
      );
    }

    if (summary.totalTrades < 100) {
      passed = false;
      reasons.push(`Insufficient sample size: ${summary.totalTrades} trades (minimum 100)`);
    }

    if (summary.maxDrawdown > 0.2) {
      passed = false;
      reasons.push(`Max drawdown ${(summary.maxDrawdown * 100).toFixed(1)}% exceeds 20% limit`);
    }

    if (summary.profitFactor < 1.5) {
      passed = false;
      reasons.push(`Profit factor ${summary.profitFactor.toFixed(2)} below 1.5 target`);
    }

    return { passed, reasons };
  }

  /**
   * Fetch historical KXBTC15M markets from Kalshi API
   * Uses Kalshi key ID and private key for authentication
   */
  static async fetchHistoricalMarkets(
    startTime: number,
    endTime: number
  ): Promise<KalshiMarket[]> {
    const jwt = getKalshiJWT();

    if (!jwt) {
      console.warn('Kalshi JWT not configured, using synthetic data');
      return this.generateSyntheticMarkets(startTime, endTime);
    }

    try {
      // Kalshi API endpoint for historical markets
      const apiUrl = 'https://api.kalshi.co/v1/markets';
      const authHeader = jwt.getAuthHeader();

      const response = await fetch(
        `${apiUrl}?ticker=KXBTC15M&min_expiry=${new Date(startTime).toISOString()}&max_expiry=${new Date(endTime).toISOString()}`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`Kalshi API error: ${response.status} ${response.statusText}`);
        return this.generateSyntheticMarkets(startTime, endTime);
      }

      const data = await response.json();

      // Transform Kalshi API response to KalshiMarket format
      return data.markets?.map((m: any) => ({
        ticker: m.ticker,
        strikePrice: m.strike_price,
        expiryTime: new Date(m.expiry_time).getTime(),
        yesPrice: m.yes_price,
        noPrice: m.no_price,
        impliedProbability: m.implied_probability,
        contractType: m.contract_type,
      })) || this.generateSyntheticMarkets(startTime, endTime);
    } catch (error) {
      console.error('Failed to fetch Kalshi historical data:', error);
      return this.generateSyntheticMarkets(startTime, endTime);
    }
  }

  /**
   * Generate synthetic market data for testing
   */
  static generateSyntheticMarkets(
    startTime: number,
    endTime: number,
    basePrice: number = 85000
  ): KalshiMarket[] {
    const markets: KalshiMarket[] = [];
    const expiries = BRTISettlementCalculator.getKXBTC15MExpiryRange(startTime, endTime);

    for (const expiry of expiries) {
      const priceVariation = (Math.random() - 0.5) * 1000;
      const strikePrice = basePrice + priceVariation;
      const impliedProb = 0.5 + (Math.random() - 0.5) * 0.2;
      
      markets.push({
        ticker: 'KXBTC15M',
        strikePrice,
        expiryTime: expiry,
        yesPrice: Math.round(impliedProb * 100),
        noPrice: Math.round((1 - impliedProb) * 100),
        impliedProbability: impliedProb,
        contractType: 'ABOVE',
      });
    }

    return markets;
  }

  /**
   * Generate synthetic price history for testing
   */
  static generateSyntheticPriceHistory(
    startTime: number,
    endTime: number,
    basePrice: number = 85000
  ): BRTIPricePoint[] {
    const history: BRTIPricePoint[] = [];
    let currentPrice = basePrice;

    for (let t = startTime; t <= endTime; t += 1000) {
      // Random walk
      const change = (Math.random() - 0.5) * 50;
      currentPrice += change;

      history.push({
        timestamp: t,
        price: currentPrice,
      });
    }

    return history;
  }
}
