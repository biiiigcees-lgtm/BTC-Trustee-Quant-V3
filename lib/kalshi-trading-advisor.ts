// Kalshi BTC Trading Advisor
// Expert AI trading advisor specializing in Kalshi BTC 15-minute prediction markets
// Implements statistically significant edge detection, risk management, and Kelly Criterion position sizing

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface KalshiMarketData {
  bidPrice: number
  askPrice: number
  marketPrice: number
  impliedProbability: number
  contractType: 'ABOVE' | 'BELOW'
  strikePrice: number
  expiryTime: number
  currentBTCPrice: number
}

export interface TradeOpportunity {
  shouldTrade: boolean
  recommendation: 'BUY' | 'SELL' | 'PASS'
  contractType: 'ABOVE' | 'BELOW'
  strikePrice: number
  predictedProbability: number
  kalshiImpliedProbability: number
  edgePercentage: number
  expectedValue: number
  expectedValueDollars: number
  positionSizePercent: number
  positionSizeDollars: number
  maxLossDollars: number
  maxLossPercent: number
  maxProfitDollars: number
  winRateRequired: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  reasoning: string[]
  riskWarnings: string[]
  kellyFraction: number
  volatilityAdjustment: number
}

export interface RiskLimits {
  maxLossPerTradePercent: number
  maxDailyLossPercent: number
  maxConsecutiveLosses: number
  maxDrawdownPercent: number
  currentDailyLoss: number
  consecutiveLosses: number
  currentDrawdown: number
  shouldPauseTrading: boolean
}

export interface PositionSizingResult {
  kellyFraction: number
  recommendedFraction: number
  volatilityAdjustedFraction: number
  volatilityAdjustment: number
  finalPositionSizePercent: number
  finalPositionSizeDollars: number
  maxPositionSizePercent: number
  maxPositionSizeDollars: number
}

export interface AccountState {
  balance: number
  initialBalance: number
  dailyPnL: number
  rolling30TradePnL: number
  consecutiveLosses: number
  consecutiveWins: number
  totalTrades: number
  winRate: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  maxDrawdown: number
  currentDrawdown: number
}

export class KalshiTradingAdvisor {
  private static readonly KALSHI_FEE_PERCENT = 0.02 // 2% round-trip fee
  private static readonly MIN_EDGE_THRESHOLD = 0.53 // 53% minimum predicted probability
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.56 // 56% for full Kelly
  private static readonly FRACTIONAL_KELLY_PERCENT = 0.375 // 37.5% of Kelly (midpoint of 25-50%)
  private static readonly MAX_POSITION_SIZE_PERCENT = 0.03 // 3% max per trade
  private static readonly MAX_DAILY_LOSS_PERCENT = 0.05 // 5% daily loss limit
  private static readonly MAX_CONSECUTIVE_LOSSES = 3
  private static readonly MAX_DRAWDOWN_PERCENT = 0.20 // 20% max drawdown

  // ─── Pillar 1: Statistically Significant Edge Detection ────────────────────

  /**
   * Calculate edge by comparing predicted probability to Kalshi implied probability
   */
  private static calculateEdge(
    predictedProbability: number,
    kalshiImpliedProbability: number
  ): { edgePercentage: number; hasEdge: boolean } {
    const edgePercentage = predictedProbability - kalshiImpliedProbability
    const hasEdge = edgePercentage > 0

    return { edgePercentage, hasEdge }
  }

  /**
   * Calculate expected value accounting for Kalshi fees
   * EV = 2 × (Your Probability - 0.5) - 0.04 (for even-money bets with 2% round-trip fees)
   */
  private static calculateExpectedValue(
    predictedProbability: number,
    investment: number
  ): { ev: number; evDollars: number; winRateRequired: number } {
    // For even-money bets on Kalshi with 2% round-trip fees
    const ev = 2 * (predictedProbability - 0.5) - this.KALSHI_FEE_PERCENT
    const evDollars = ev * investment

    // Minimum win rate required to be profitable after fees
    const winRateRequired = 0.5 + (this.KALSHI_FEE_PERCENT / 2)

    return { ev, evDollars, winRateRequired }
  }

  /**
   * Determine if trade meets minimum edge threshold
   */
  private static meetsMinimumEdge(
    predictedProbability: number,
    kalshiImpliedProbability: number
  ): boolean {
    const { edgePercentage, hasEdge } = this.calculateEdge(predictedProbability, kalshiImpliedProbability)
    
    // Must have edge and meet minimum probability threshold
    return hasEdge && predictedProbability >= this.MIN_EDGE_THRESHOLD
  }

  // ─── Pillar 2: Risk Management and Loss Prevention ─────────────────────────

  /**
   * Check if trade should be rejected due to risk limits
   */
  private static checkRiskLimits(
    accountState: AccountState,
    proposedLossDollars: number,
    proposedLossPercent: number
  ): { shouldReject: boolean; reasons: string[] } {
    const reasons: string[] = []
    let shouldReject = false

    // Check single trade loss limit (2-3% of account)
    if (proposedLossPercent > 0.03) {
      shouldReject = true
      reasons.push(`Single trade loss ${proposedLossPercent.toFixed(1)}% exceeds 3% limit`)
    }

    // Check daily loss limit (5%)
    if (accountState.dailyPnL < -accountState.balance * this.MAX_DAILY_LOSS_PERCENT) {
      shouldReject = true
      reasons.push(`Daily loss ${(accountState.dailyPnL / accountState.balance * 100).toFixed(1)}% exceeds 5% limit - stop trading for today`)
    }

    // Check consecutive loss streak
    if (accountState.consecutiveLosses >= this.MAX_CONSECUTIVE_LOSSES) {
      shouldReject = true
      reasons.push(`${accountState.consecutiveLosses} consecutive losses - reduce position size by 25-50% for next 3 trades`)
    }

    // Check rolling 30-trade drawdown
    if (accountState.currentDrawdown > this.MAX_DRAWDOWN_PERCENT) {
      shouldReject = true
      reasons.push(`Current drawdown ${(accountState.currentDrawdown * 100).toFixed(1)}% exceeds 20% limit - reduce position size by 30-50%`)
    }

    // Psychological risk warning
    if (accountState.consecutiveLosses >= 2) {
      reasons.push(`WARNING: ${accountState.consecutiveLosses} consecutive losses - decision-making may be compromised. Recommend pause and analysis.`)
    }

    return { shouldReject, reasons }
  }

  /**
   * Calculate maximum loss for a trade
   */
  private static calculateMaxLoss(
    investment: number,
    accountBalance: number
  ): { maxLossDollars: number; maxLossPercent: number } {
    const maxLossDollars = investment
    const maxLossPercent = maxLossDollars / accountBalance
    return { maxLossDollars, maxLossPercent }
  }

  // ─── Pillar 3: Position Sizing and Kelly Criterion ─────────────────────────

  /**
   * Calculate Kelly Criterion fraction: f = 2p - 1
   */
  private static calculateKellyFraction(predictedProbability: number): number {
    const kelly = 2 * predictedProbability - 1
    return Math.max(0, kelly) // Kelly can't be negative
  }

  /**
   * Calculate volatility adjustment factor
   */
  private static calculateVolatilityAdjustment(
    currentVolatility: number,
    historicalVolatility: number
  ): number {
    const volatilityRatio = currentVolatility / historicalVolatility
    
    if (volatilityRatio > 1.5) {
      return 0.5 // Reduce by 50% if volatility exceeds historical by 50%+
    } else if (volatilityRatio > 1.25) {
      return 0.75 // Reduce by 25% if volatility exceeds historical by 25%+
    }
    
    return 1.0 // No adjustment
  }

  /**
   * Calculate position size using fractional Kelly with volatility adjustments
   */
  private static calculatePositionSize(
    predictedProbability: number,
    accountBalance: number,
    currentVolatility: number,
    historicalVolatility: number,
    accountState: AccountState
  ): PositionSizingResult {
    // Calculate base Kelly fraction
    const kellyFraction = this.calculateKellyFraction(predictedProbability)
    
    // Apply fractional Kelly (25-50% of full Kelly)
    const recommendedFraction = kellyFraction * this.FRACTIONAL_KELLY_PERCENT
    
    // Apply volatility adjustment
    const volatilityAdjustment = this.calculateVolatilityAdjustment(currentVolatility, historicalVolatility)
    const volatilityAdjustedFraction = recommendedFraction * volatilityAdjustment
    
    // Apply drawdown adjustment
    let drawdownAdjustment = 1.0
    if (accountState.currentDrawdown > 0.15) {
      drawdownAdjustment = 0.5 // Reduce by 50% if drawdown > 15%
    } else if (accountState.currentDrawdown > 0.10) {
      drawdownAdjustment = 0.75 // Reduce by 25% if drawdown > 10%
    }
    
    const finalPositionSizePercent = volatilityAdjustedFraction * drawdownAdjustment
    
    // Cap at maximum position size (3%)
    const finalCappedPercent = Math.min(finalPositionSizePercent, this.MAX_POSITION_SIZE_PERCENT)
    
    // Calculate dollar amounts
    const finalPositionSizeDollars = accountBalance * finalCappedPercent
    const maxPositionSizeDollars = accountBalance * this.MAX_POSITION_SIZE_PERCENT

    return {
      kellyFraction,
      recommendedFraction,
      volatilityAdjustedFraction,
      volatilityAdjustment,
      finalPositionSizePercent: finalCappedPercent,
      finalPositionSizeDollars,
      maxPositionSizePercent: this.MAX_POSITION_SIZE_PERCENT,
      maxPositionSizeDollars
    }
  }

  // ─── Main Trade Analysis ───────────────────────────────────────────────────

  /**
   * Analyze a trading opportunity and provide recommendation
   */
  public static analyzeTrade(
    predictedProbability: number,
    kalshiMarket: KalshiMarketData,
    accountState: AccountState,
    currentVolatility: number,
    historicalVolatility: number
  ): TradeOpportunity {
    const reasoning: string[] = []
    const riskWarnings: string[] = []

    // Step 1: Check edge
    const { edgePercentage, hasEdge } = this.calculateEdge(
      predictedProbability,
      kalshiMarket.impliedProbability
    )

    if (!hasEdge) {
      reasoning.push(`No edge: Your probability ${(predictedProbability * 100).toFixed(1)}% ≤ Kalshi implied ${(kalshiMarket.impliedProbability * 100).toFixed(1)}%`)
      return this.createPassTrade(reasoning, riskWarnings)
    }

    reasoning.push(`Edge detected: Your probability ${(predictedProbability * 100).toFixed(1)}% vs Kalshi ${(kalshiMarket.impliedProbability * 100).toFixed(1)}% = +${(edgePercentage * 100).toFixed(1)}% edge`)

    // Step 2: Check minimum edge threshold
    if (!this.meetsMinimumEdge(predictedProbability, kalshiMarket.impliedProbability)) {
      reasoning.push(`Predicted probability ${(predictedProbability * 100).toFixed(1)}% below 53% minimum threshold - expected value negative`)
      return this.createPassTrade(reasoning, riskWarnings)
    }

    reasoning.push(`Predicted probability ${(predictedProbability * 100).toFixed(1)}% meets 53% minimum threshold`)

    // Step 3: Calculate expected value
    const investment = accountState.balance * 0.03 // Assume max investment for EV calculation
    const { ev, evDollars, winRateRequired } = this.calculateExpectedValue(predictedProbability, investment)

    if (ev <= 0) {
      reasoning.push(`Expected value ${ev.toFixed(3)} ($${evDollars.toFixed(2)}) is negative or zero - reject trade`)
      return this.createPassTrade(reasoning, riskWarnings)
    }

    reasoning.push(`Expected value: ${ev.toFixed(3)} ($${evDollars.toFixed(2)}) per $1 invested`)
    reasoning.push(`Minimum win rate required: ${(winRateRequired * 100).toFixed(1)}% after fees`)

    // Step 4: Calculate position size
    const positionSizing = this.calculatePositionSize(
      predictedProbability,
      accountState.balance,
      currentVolatility,
      historicalVolatility,
      accountState
    )

    reasoning.push(`Kelly fraction: ${(positionSizing.kellyFraction * 100).toFixed(1)}%`)
    reasoning.push(`Recommended (fractional Kelly): ${(positionSizing.recommendedFraction * 100).toFixed(1)}%`)
    reasoning.push(`Volatility adjusted: ${(positionSizing.volatilityAdjustedFraction * 100).toFixed(1)}%`)
    reasoning.push(`Final position size: ${(positionSizing.finalPositionSizePercent * 100).toFixed(1)}% ($${positionSizing.finalPositionSizeDollars.toFixed(2)})`)

    // Step 5: Check risk limits
    const maxLoss = this.calculateMaxLoss(positionSizing.finalPositionSizeDollars, accountState.balance)
    const riskCheck = this.checkRiskLimits(accountState, maxLoss.maxLossDollars, maxLoss.maxLossPercent)

    if (riskCheck.shouldReject) {
      riskWarnings.push(...riskCheck.reasons)
      reasoning.push(`Risk limits exceeded - reject trade`)
      return this.createPassTrade(reasoning, riskWarnings)
    }

    if (riskCheck.reasons.length > 0) {
      riskWarnings.push(...riskCheck.reasons)
    }

    // Step 6: Determine confidence level
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
    if (predictedProbability >= this.HIGH_CONFIDENCE_THRESHOLD) {
      confidence = 'HIGH'
      reasoning.push(`High confidence: Predicted probability ≥ 56%`)
    } else if (predictedProbability >= 0.54) {
      confidence = 'MEDIUM'
      reasoning.push(`Medium confidence: Predicted probability ≥ 54%`)
    } else {
      confidence = 'LOW'
      reasoning.push(`Low confidence: Predicted probability between 53-54% - recommend smaller position`)
    }

    // Step 7: Calculate max profit/loss
    const maxProfitDollars = positionSizing.finalPositionSizeDollars // Even-money bet

    // Step 8: Final recommendation
    const recommendation: 'BUY' | 'SELL' = 'BUY' // Simplified - in reality would depend on direction
    const contractType: 'ABOVE' | 'BELOW' = kalshiMarket.contractType

    return {
      shouldTrade: true,
      recommendation,
      contractType,
      strikePrice: kalshiMarket.strikePrice,
      predictedProbability,
      kalshiImpliedProbability: kalshiMarket.impliedProbability,
      edgePercentage,
      expectedValue: ev,
      expectedValueDollars: evDollars * positionSizing.finalPositionSizeDollars,
      positionSizePercent: positionSizing.finalPositionSizePercent,
      positionSizeDollars: positionSizing.finalPositionSizeDollars,
      maxLossDollars: maxLoss.maxLossDollars,
      maxLossPercent: maxLoss.maxLossPercent,
      maxProfitDollars,
      winRateRequired,
      confidence,
      reasoning,
      riskWarnings,
      kellyFraction: positionSizing.kellyFraction,
      volatilityAdjustment: positionSizing.volatilityAdjustment
    }
  }

  /**
   * Create a PASS trade result
   */
  private static createPassTrade(
    reasoning: string[],
    riskWarnings: string[]
  ): TradeOpportunity {
    return {
      shouldTrade: false,
      recommendation: 'PASS',
      contractType: 'ABOVE',
      strikePrice: 0,
      predictedProbability: 0,
      kalshiImpliedProbability: 0,
      edgePercentage: 0,
      expectedValue: 0,
      expectedValueDollars: 0,
      positionSizePercent: 0,
      positionSizeDollars: 0,
      maxLossDollars: 0,
      maxLossPercent: 0,
      maxProfitDollars: 0,
      winRateRequired: 0.52,
      confidence: 'LOW',
      reasoning,
      riskWarnings,
      kellyFraction: 0,
      volatilityAdjustment: 1
    }
  }

  /**
   * Update account state after a trade
   */
  public static updateAccountState(
    accountState: AccountState,
    tradeResult: 'WIN' | 'LOSS',
    profitLossDollars: number
  ): AccountState {
    const updatedState = { ...accountState }

    updatedState.balance += profitLossDollars
    updatedState.dailyPnL += profitLossDollars
    updatedState.rolling30TradePnL += profitLossDollars
    updatedState.totalTrades += 1

    if (tradeResult === 'WIN') {
      updatedState.consecutiveWins += 1
      updatedState.consecutiveLosses = 0
      updatedState.averageWin = (updatedState.averageWin * (updatedState.totalTrades - 1) + profitLossDollars) / updatedState.totalTrades
    } else {
      updatedState.consecutiveLosses += 1
      updatedState.consecutiveWins = 0
      updatedState.averageLoss = (updatedState.averageLoss * (updatedState.totalTrades - 1) + Math.abs(profitLossDollars)) / updatedState.totalTrades
    }

    // Update win rate
    const wins = updatedState.totalTrades - updatedState.consecutiveLosses - Math.floor(updatedState.consecutiveLosses / 2)
    updatedState.winRate = wins / updatedState.totalTrades

    // Update drawdown
    const peakBalance = Math.max(updatedState.initialBalance, updatedState.balance)
    updatedState.currentDrawdown = (peakBalance - updatedState.balance) / peakBalance
    updatedState.maxDrawdown = Math.max(updatedState.maxDrawdown, updatedState.currentDrawdown)

    // Update profit factor
    const totalWins = wins * updatedState.averageWin
    const totalLosses = (updatedState.totalTrades - wins) * updatedState.averageLoss
    updatedState.profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0

    return updatedState
  }
}
