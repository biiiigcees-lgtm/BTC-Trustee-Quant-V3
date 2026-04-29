// Advanced Risk Management Module
// Position sizing, stop-loss, take-profit, and risk metrics

export interface RiskMetrics {
  currentPrice: number
  volatility: number
  atr: number
  maxDrawdown: number
  currentDrawdown: number
  riskRewardRatio: number
  positionSize: number
  stopLoss: number
  takeProfit: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  marketCondition: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'ILLIQUID'
}

export interface PositionSizingConfig {
  accountBalance: number
  maxRiskPerTrade: number // percentage
  maxDrawdownLimit: number // percentage
  atrMultiplier: number // for stop loss
  riskRewardRatio: number // minimum acceptable
}

export class RiskManager {
  // Calculate Average True Range (ATR)
  static calculateATR(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 0

    const trueRanges: number[] = []
    for (let i = 1; i < prices.length; i++) {
      const high = prices[i]
      const low = prices[i]
      const prevClose = prices[i - 1]
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      )
      trueRanges.push(tr)
    }

    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period
    return atr
  }

  // Calculate volatility using standard deviation
  static calculateVolatility(prices: number[], period: number = 20): number {
    if (prices.length < period) return 0

    const recentPrices = prices.slice(-period)
    const mean = recentPrices.reduce((a, b) => a + b, 0) / period
    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / period
    const stdDev = Math.sqrt(variance)
    
    return (stdDev / mean) * 100 // percentage
  }

  // Calculate maximum drawdown from price history
  static calculateDrawdown(prices: number[]): { maxDrawdown: number; currentDrawdown: number } {
    if (prices.length < 2) return { maxDrawdown: 0, currentDrawdown: 0 }

    let maxPrice = prices[0]
    let maxDrawdown = 0
    let currentDrawdown = 0
    const currentPrice = prices[prices.length - 1]

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > maxPrice) {
        maxPrice = prices[i]
      }
      const drawdown = ((maxPrice - prices[i]) / maxPrice) * 100
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    currentDrawdown = ((maxPrice - currentPrice) / maxPrice) * 100

    return { maxDrawdown, currentDrawdown }
  }

  // Calculate optimal position size using Kelly Criterion
  static calculateKellyPositionSize(
    winRate: number,
    avgWin: number,
    avgLoss: number,
    accountBalance: number,
    maxRiskPerTrade: number = 0.02
  ): number {
    if (avgLoss === 0) return 0

    const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgLoss
    
    // Kelly can be aggressive, so we use half-Kelly and cap at maxRiskPerTrade
    const halfKelly = Math.max(0, kellyFraction) * 0.5
    const riskPercentage = Math.min(halfKelly, maxRiskPerTrade)
    
    return accountBalance * riskPercentage
  }

  // Calculate position size using Fixed Fractional method
  static calculateFixedFractionalPosition(
    accountBalance: number,
    riskPerTrade: number,
    stopLossDistance: number,
    currentPrice: number
  ): number {
    const riskAmount = accountBalance * riskPerTrade
    const shares = riskAmount / stopLossDistance
    const positionValue = shares * currentPrice
    
    return Math.min(positionValue, accountBalance * riskPerTrade * 10) // Cap at 10x risk
  }

  // Calculate position size based on volatility
  static calculateVolatilityAdjustedPosition(
    accountBalance: number,
    volatility: number,
    baseRisk: number = 0.02
  ): number {
    // Adjust position size inversely to volatility
    const volatilityAdjustment = Math.max(0.5, Math.min(2, 1 / (volatility / 100)))
    const adjustedRisk = baseRisk * volatilityAdjustment
    
    return accountBalance * Math.min(adjustedRisk, 0.05) // Max 5% of account
  }

  // Calculate stop loss based on ATR
  static calculateATRStopLoss(currentPrice: number, atr: number, multiplier: number = 2): number {
    return currentPrice - (atr * multiplier)
  }

  // Calculate take profit based on risk/reward ratio
  static calculateTakeProfit(
    currentPrice: number,
    stopLoss: number,
    riskRewardRatio: number = 2
  ): number {
    const risk = currentPrice - stopLoss
    return currentPrice + (risk * riskRewardRatio)
  }

  // Assess overall risk level
  static assessRiskLevel(
    volatility: number,
    drawdown: number,
    liquidityRisk: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    let riskScore = 0

    if (volatility > 5) riskScore += 3
    else if (volatility > 3) riskScore += 2
    else if (volatility > 1) riskScore += 1

    if (drawdown > 20) riskScore += 3
    else if (drawdown > 10) riskScore += 2
    else if (drawdown > 5) riskScore += 1

    if (liquidityRisk > 0.7) riskScore += 3
    else if (liquidityRisk > 0.5) riskScore += 2
    else if (liquidityRisk > 0.3) riskScore += 1

    if (riskScore >= 7) return 'EXTREME'
    if (riskScore >= 5) return 'HIGH'
    if (riskScore >= 3) return 'MEDIUM'
    return 'LOW'
  }

  // Comprehensive risk assessment
  static calculateRiskMetrics(
    prices: number[],
    config: PositionSizingConfig,
    currentPrice: number,
    volume: number,
    marketCap: number
  ): RiskMetrics {
    const atr = this.calculateATR(prices)
    const volatility = this.calculateVolatility(prices)
    const { maxDrawdown, currentDrawdown } = this.calculateDrawdown(prices)
    
    // Calculate liquidity risk (volume/market cap ratio)
    const liquidityRisk = volume / marketCap
    
    // Calculate stop loss and take profit
    const stopLoss = this.calculateATRStopLoss(currentPrice, atr, config.atrMultiplier)
    const takeProfit = this.calculateTakeProfit(currentPrice, stopLoss, config.riskRewardRatio)
    
    // Calculate position size using volatility-adjusted method
    const positionSize = this.calculateVolatilityAdjustedPosition(
      config.accountBalance,
      volatility,
      config.maxRiskPerTrade
    )
    
    // Calculate risk/reward ratio
    const risk = currentPrice - stopLoss
    const reward = takeProfit - currentPrice
    const riskRewardRatio = risk > 0 ? reward / risk : 0
    
    // Assess market condition
    let marketCondition: RiskMetrics['marketCondition']
    if (volatility > 4 || liquidityRisk < 0.01) {
      marketCondition = volatility > 4 ? 'VOLATILE' : 'ILLIQUID'
    } else if (atr > currentPrice * 0.02) {
      marketCondition = 'TRENDING'
    } else {
      marketCondition = 'RANGING'
    }
    
    // Assess risk level
    const riskLevel = this.assessRiskLevel(volatility, currentDrawdown, liquidityRisk)
    
    // Assess liquidity risk
    const liquidityRiskLevel: RiskMetrics['liquidityRisk'] = 
      liquidityRisk < 0.01 ? 'HIGH' : liquidityRisk < 0.02 ? 'MEDIUM' : 'LOW'
    
    // Check if current drawdown exceeds limit
    if (currentDrawdown > config.maxDrawdownLimit) {
      // Emergency: reduce position size significantly
      return {
        currentPrice,
        volatility,
        atr,
        maxDrawdown,
        currentDrawdown,
        riskRewardRatio,
        positionSize: positionSize * 0.25, // Reduce to 25%
        stopLoss,
        takeProfit,
        riskLevel: 'EXTREME',
        liquidityRisk: liquidityRiskLevel,
        marketCondition
      }
    }
    
    return {
      currentPrice,
      volatility,
      atr,
      maxDrawdown,
      currentDrawdown,
      riskRewardRatio,
      positionSize,
      stopLoss,
      takeProfit,
      riskLevel,
      liquidityRisk: liquidityRiskLevel,
      marketCondition
    }
  }

  // Generate risk alerts
  static generateRiskAlerts(metrics: RiskMetrics): string[] {
    const alerts: string[] = []
    
    if (metrics.riskLevel === 'EXTREME') {
      alerts.push('🚨 EXTREME RISK: Consider reducing position sizes or exiting trades')
    }
    
    if (metrics.currentDrawdown > 15) {
      alerts.push(`⚠️ HIGH DRAWDOWN: Current drawdown at ${metrics.currentDrawdown.toFixed(1)}%`)
    }
    
    if (metrics.volatility > 5) {
      alerts.push(`📈 EXTREME VOLATILITY: Volatility at ${metrics.volatility.toFixed(1)}% - widen stops`)
    }
    
    if (metrics.liquidityRisk === 'HIGH') {
      alerts.push('💧 LOW LIQUIDITY: Market conditions may cause slippage')
    }
    
    if (metrics.riskRewardRatio < 1.5) {
      alerts.push(`⚖️ POOR R/R: Risk/reward ratio at ${metrics.riskRewardRatio.toFixed(2)} - below 1.5`)
    }
    
    if (metrics.marketCondition === 'VOLATILE') {
      alerts.push('🌊 VOLATILE MARKET: Consider reducing position sizes')
    }
    
    if (metrics.marketCondition === 'ILLIQUID') {
      alerts.push('🚧 ILLIQUID MARKET: Trading conditions unfavorable')
    }
    
    return alerts
  }

  // Calculate portfolio heat (total exposure as percentage of account)
  static calculatePortfolioHeat(
    positions: { value: number; stopLoss: number }[],
    accountBalance: number
  ): { heat: number; riskAmount: number } {
    let totalValue = 0
    let totalRisk = 0
    
    for (const position of positions) {
      totalValue += position.value
      totalRisk += Math.abs(position.value - position.stopLoss)
    }
    
    const heat = (totalValue / accountBalance) * 100
    const riskAmount = totalRisk
    
    return { heat, riskAmount }
  }
}
