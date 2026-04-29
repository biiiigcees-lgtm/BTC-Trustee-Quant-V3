import { OHLC, TradingSignal, BacktestResult } from "./types";

/**
 * Backtest trading signals against historical data
 * @param data - Array of OHLC candles
 * @param signals - Array of trading signals
 * @param initialCapital - Starting capital for backtest
 * @param positionSize - Fixed position size per trade (in currency units)
 * @returns BacktestResult with performance metrics
 */
export function backtestSignals(
  data: OHLC[],
  signals: TradingSignal[],
  initialCapital = 10000,
  positionSize = 1000
): BacktestResult {
  if (signals.length === 0 || data.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      averageWin: 0,
      averageLoss: 0,
      finalCapital: initialCapital,
      totalReturn: 0,
    };
  }

  // Sort signals by timestamp
  const sortedSignals = [...signals].sort((a, b) => a.timestamp - b.timestamp);

  let capital = initialCapital;
  let position: { entryPrice: number; direction: "BUY" | "SELL"; entryTime: number } | null = null;
  let maxCapital = initialCapital;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  const winAmounts: number[] = [];
  const lossAmounts: number[] = [];

  // Process signals and simulate trades
  for (const signal of sortedSignals) {
    const candle = data.find((d) => d.timestamp === signal.timestamp);
    if (!candle) continue;

    // Close existing position if any
    if (position) {
      const exitPrice = candle.close;
      const priceChange = position.direction === "BUY" 
        ? exitPrice - position.entryPrice 
        : position.entryPrice - exitPrice;
      
      const pnl = (priceChange / position.entryPrice) * positionSize;
      capital += pnl;
      
      if (pnl > 0) {
        wins++;
        totalProfit += pnl;
        winAmounts.push(pnl);
      } else {
        losses++;
        totalLoss += Math.abs(pnl);
        lossAmounts.push(Math.abs(pnl));
      }

      // Track drawdown
      if (capital > maxCapital) {
        maxCapital = capital;
      } else {
        const drawdown = (maxCapital - capital) / maxCapital;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      position = null;
    }

    // Open new position based on signal
    if (signal.direction === "BUY" || signal.direction === "SELL") {
      position = {
        entryPrice: signal.price,
        direction: signal.direction,
        entryTime: signal.timestamp,
      };
    }
  }

  // Close any remaining position at last candle
  if (position && data.length > 0) {
    const lastCandle = data[data.length - 1];
    const exitPrice = lastCandle.close;
    const priceChange = position.direction === "BUY" 
      ? exitPrice - position.entryPrice 
      : position.entryPrice - exitPrice;
    
    const pnl = (priceChange / position.entryPrice) * positionSize;
    capital += pnl;
    
    if (pnl > 0) {
      wins++;
      totalProfit += pnl;
      winAmounts.push(pnl);
    } else {
      losses++;
      totalLoss += Math.abs(pnl);
      lossAmounts.push(Math.abs(pnl));
    }
  }

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const netProfit = capital - initialCapital;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  const averageWin = winAmounts.length > 0 ? totalProfit / winAmounts.length : 0;
  const averageLoss = lossAmounts.length > 0 ? totalLoss / lossAmounts.length : 0;
  const totalReturn = ((capital - initialCapital) / initialCapital) * 100;

  return {
    totalTrades,
    wins,
    losses,
    winRate,
    totalProfit,
    totalLoss,
    netProfit,
    profitFactor,
    maxDrawdown,
    averageWin,
    averageLoss,
    finalCapital: capital,
    totalReturn,
  };
}
