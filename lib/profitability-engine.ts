import { MarketRegime, Timeframe } from './god-tier-prediction';
import { RISK_PROFILES } from './advanced-risk';

// ═══════════════════════════════════════════════════════════════════════════
// PROFITABILITY ENGINE — Trade Optimization for Maximum Win Rate & Profit
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// A+ SETUP CRITERIA — Only Trade High-Quality Signals
// ═══════════════════════════════════════════════════════════════════════════

interface SetupQuality {
  score: number;        // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  shouldTrade: boolean;
  confidenceMultiplier: number;
  sizingMultiplier: number;
  reasoning: string[];
}

export interface SetupParams {
  confidence: number;
  ev: number;
  kelly: number;
  confluenceScore: number;
  regime: MarketRegime;
  timeframeAlignment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  momentumFlow: 'accelerating' | 'decelerating' | 'stable';
  divergence: 'bullish' | 'bearish' | 'none';
  whalePressure: 'buying' | 'selling' | 'neutral';
  sentimentScore: number;
  timeToExpiry: number;
  volatility: number;
  distanceFromStrike: number;
  recentWinRate: number;    // System's recent performance
  timeOfDay: number;        // Hour (0-23)
  dayOfWeek: number;        // 0-6
}

export function evaluateSetupQuality(params: SetupParams): SetupQuality {
  const reasoning: string[] = [];
  let score = 0;
  
  // Base: Confidence must be high enough
  if (params.confidence >= 85) {
    score += 25;
    reasoning.push('✓ High confidence (85%+)');
  } else if (params.confidence >= 75) {
    score += 20;
    reasoning.push('✓ Good confidence (75%+)');
  } else if (params.confidence >= 65) {
    score += 10;
    reasoning.push('⚠ Moderate confidence (65%+)');
  } else {
    score -= 20;
    reasoning.push('✗ Low confidence (<65%)');
  }
  
  // EV must be positive
  if (params.ev >= 30) {
    score += 20;
    reasoning.push('✓ Strong EV (30%+)');
  } else if (params.ev >= 15) {
    score += 15;
    reasoning.push('✓ Good EV (15%+)');
  } else if (params.ev > 0) {
    score += 5;
    reasoning.push('⚠ Marginal EV (<15%)');
  } else {
    score -= 30;
    reasoning.push('✗ Negative EV');
  }
  
  // Confluence score
  if (params.confluenceScore >= 80) {
    score += 20;
    reasoning.push('✓ Excellent confluence (80%+)');
  } else if (params.confluenceScore >= 65) {
    score += 15;
    reasoning.push('✓ Good confluence (65%+)');
  } else if (params.confluenceScore >= 50) {
    score += 5;
    reasoning.push('⚠ Weak confluence (<65%)');
  } else {
    score -= 10;
    reasoning.push('✗ Poor confluence (<50%)');
  }
  
  // Timeframe alignment - must be clear
  if (params.timeframeAlignment === 'bullish' || params.timeframeAlignment === 'bearish') {
    score += 10;
    reasoning.push('✓ Clear directional alignment');
  } else {
    score -= 10;
    reasoning.push('✗ Mixed/neutral timeframe signals');
  }
  
  // Momentum flow
  if (params.momentumFlow === 'accelerating') {
    score += 10;
    reasoning.push('✓ Momentum accelerating');
  } else if (params.momentumFlow === 'decelerating') {
    score -= 5;
    reasoning.push('⚠ Momentum decelerating');
  }
  
  // Divergence bonus
  if (params.divergence !== 'none') {
    score += 5;
    reasoning.push(`✓ ${params.divergence} divergence detected`);
  }
  
  // Whale alignment
  const predictedDirection = params.confidence > 50 ? 
    (params.sentimentScore > 0 ? 'ABOVE' : 'BELOW') : 'PASS';
  
  if ((params.whalePressure === 'buying' && predictedDirection === 'ABOVE') ||
      (params.whalePressure === 'selling' && predictedDirection === 'BELOW')) {
    score += 10;
    reasoning.push('✓ Whale activity aligned with prediction');
  } else if (params.whalePressure !== 'neutral') {
    score -= 5;
    reasoning.push('⚠ Whale activity contradicts prediction');
  }
  
  // Sentiment alignment
  if (Math.abs(params.sentimentScore) > 30) {
    const sentimentDirection = params.sentimentScore > 0 ? 'ABOVE' : 'BELOW';
    if (sentimentDirection === predictedDirection) {
      score += 5;
      reasoning.push('✓ Sentiment aligned');
    }
  }
  
  // Time to expiry - sweet spot
  if (params.timeToExpiry >= 300 && params.timeToExpiry <= 900) {
    score += 5;
    reasoning.push('✓ Optimal time to expiry (5-15 min)');
  } else if (params.timeToExpiry < 180) {
    score -= 10;
    reasoning.push('✗ Too short expiry (<3 min)');
  } else if (params.timeToExpiry > 3600) {
    score -= 5;
    reasoning.push('⚠ Very long expiry (>1 hour)');
  }
  
  // Distance from strike
  if (params.distanceFromStrike >= 0.005 && params.distanceFromStrike <= 0.03) {
    score += 5;
    reasoning.push('✓ Good distance from strike (0.5-3%)');
  } else if (params.distanceFromStrike < 0.002) {
    score -= 10;
    reasoning.push('✗ Too close to strike (<0.2%)');
  } else if (params.distanceFromStrike > 0.05) {
    score -= 5;
    reasoning.push('⚠ Far from strike (>5%)');
  }
  
  // Volatility check
  if (params.volatility >= 0.001 && params.volatility <= 0.003) {
    score += 5;
    reasoning.push('✓ Healthy volatility (0.1-0.3%)');
  } else if (params.volatility > 0.005) {
    score -= 10;
    reasoning.push('✗ High volatility (>0.5%)');
  } else if (params.volatility < 0.0005) {
    score -= 5;
    reasoning.push('⚠ Low volatility (<0.05%)');
  }
  
  // Time of day filtering
  const isGoodTradingHour = params.timeOfDay >= 9 && params.timeOfDay <= 16; // NYC hours
  const isLondonOverlap = params.timeOfDay >= 8 && params.timeOfDay <= 12;
  
  if (isLondonOverlap) {
    score += 5;
    reasoning.push('✓ London-NYC overlap (high liquidity)');
  } else if (isGoodTradingHour) {
    score += 3;
    reasoning.push('✓ NYC trading hours');
  } else if (params.timeOfDay >= 0 && params.timeOfDay <= 5) {
    score -= 15;
    reasoning.push('✗ Low liquidity hours (midnight-5am EST)');
  }
  
  // Weekend check
  if (params.dayOfWeek === 0 || params.dayOfWeek === 6) {
    score -= 10;
    reasoning.push('⚠ Weekend trading (reduced volume)');
  }
  
  // Recent system performance - avoid trading during drawdowns
  if (params.recentWinRate >= 0.65) {
    score += 5;
    reasoning.push('✓ System performing well (65%+ win rate)');
  } else if (params.recentWinRate < 0.45) {
    score -= 15;
    reasoning.push('✗ System in drawdown (<45% win rate) - reduced sizing');
  }
  
  // Regime-specific scoring
  const goodRegimes: MarketRegime[] = [MarketRegime.STRONG_UPTREND, MarketRegime.WEAK_UPTREND, MarketRegime.STRONG_DOWNTREND, MarketRegime.WEAK_DOWNTREND];
  const badRegimes: MarketRegime[] = [MarketRegime.HIGH_VOLATILITY, MarketRegime.REVERSAL, MarketRegime.RANGING];
  
  if (goodRegimes.includes(params.regime)) {
    score += 5;
    reasoning.push(`✓ Favorable regime: ${params.regime}`);
  } else if (badRegimes.includes(params.regime)) {
    score -= 10;
    reasoning.push(`✗ Challenging regime: ${params.regime}`);
  }
  
  // Determine grade
  let grade: SetupQuality['grade'];
  let shouldTrade = false;
  let confidenceMultiplier = 1;
  let sizingMultiplier = 1;
  
  if (score >= 90) {
    grade = 'A+';
    shouldTrade = true;
    confidenceMultiplier = 1.15;
    sizingMultiplier = 1.3;
    reasoning.push('🎯 A+ SETUP — Full position size');
  } else if (score >= 75) {
    grade = 'A';
    shouldTrade = true;
    confidenceMultiplier = 1.08;
    sizingMultiplier = 1.1;
    reasoning.push('🎯 A SETUP — Standard position');
  } else if (score >= 60) {
    grade = 'B';
    shouldTrade = true;
    confidenceMultiplier = 0.95;
    sizingMultiplier = 0.75;
    reasoning.push('⚠ B SETUP — Reduced position (75%)');
  } else if (score >= 45) {
    grade = 'C';
    shouldTrade = false;
    confidenceMultiplier = 0.85;
    sizingMultiplier = 0.5;
    reasoning.push('❌ C SETUP — Do not trade');
  } else if (score >= 25) {
    grade = 'D';
    shouldTrade = false;
    confidenceMultiplier = 0.7;
    sizingMultiplier = 0.25;
    reasoning.push('❌ D SETUP — Avoid');
  } else {
    grade = 'F';
    shouldTrade = false;
    confidenceMultiplier = 0.5;
    sizingMultiplier = 0;
    reasoning.push('❌ F SETUP — Hard pass');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    grade,
    shouldTrade,
    confidenceMultiplier,
    sizingMultiplier,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFIT-TAKING OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════

interface ProfitTakingStrategy {
  strategy: 'full_at_target' | 'scale_out' | 'trailing_stop' | 'time_based';
  takeProfitLevels: Array<{ price: number; pct: number }>;
  trailingActivation: number;  // % profit to activate trailing
  trailingDistance: number;    // % distance for trailing stop
  timeExitMinutes: number;     // Exit after X minutes regardless
  expectedProfit: number;
  reasoning: string[];
}

export function optimizeProfitTaking(
  entryPrice: number,
  targetPrice: number,
  stopLoss: number,
  regime: MarketRegime,
  volatility: number,
  timeToExpiry: number,
  confidence: number
): ProfitTakingStrategy {
  const reasoning: string[] = [];
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(targetPrice - entryPrice);
  const rMultiple = reward / risk;
  
  // Default: Scale out for high confidence
  let strategy: ProfitTakingStrategy['strategy'] = 'scale_out';
  let levels: Array<{ price: number; pct: number }> = [];
  
  if (confidence >= 85 && rMultiple >= 2) {
    // High confidence + good R:R = Let winners run with trailing stop
    strategy = 'trailing_stop';
    reasoning.push('High confidence + good R:R → Trailing stop to capture trend');
    
    levels = [
      { price: entryPrice + reward * 0.5, pct: 0.25 },  // Take 25% at 50%
      { price: entryPrice + reward * 1.0, pct: 0.25 },  // Take 25% at target
      { price: entryPrice + reward * 1.5, pct: 0.5 },   // Let 50% run
    ];
  } else if (confidence >= 70) {
    // Good confidence = Scale out
    strategy = 'scale_out';
    reasoning.push('Good confidence → Scale out at multiple levels');
    
    levels = [
      { price: entryPrice + reward * 0.5, pct: 0.33 },
      { price: entryPrice + reward * 0.75, pct: 0.33 },
      { price: targetPrice, pct: 0.34 },
    ];
  } else {
    // Lower confidence = Take profit quickly
    strategy = 'full_at_target';
    reasoning.push('Moderate confidence → Full exit at target');
    
    levels = [{ price: targetPrice, pct: 1.0 }];
  }
  
  // Adjust for regime
  let trailingActivation = 0.5;  // Activate at 50% of target
  let trailingDistance = 0.15;   // 15% trailing
  
  if (regime === 'strong_uptrend' || regime === 'strong_downtrend') {
    trailingActivation = 0.3;  // Trail earlier in strong trends
    trailingDistance = 0.20;   // Wider trail for volatility
    reasoning.push('Strong trend → Earlier trailing activation');
  } else if (regime === 'ranging' || regime === 'high_volatility') {
    trailingActivation = 0.7;  // Trail later in choppy markets
    trailingDistance = 0.10;   // Tighter trail
    reasoning.push('Choppy market → Later trailing, tighter stops');
  }
  
  // Time-based exit for short expiries
  let timeExit = Math.floor(timeToExpiry / 60 * 0.9); // Exit at 90% of expiry
  if (timeToExpiry < 600) {
    timeExit = Math.floor(timeToExpiry / 60 * 0.8); // Exit earlier for short exp
    reasoning.push('Short expiry → Earlier time-based exit');
  }
  
  // Calculate expected profit
  const expectedProfit = levels.reduce((sum, level) => {
    const profitAtLevel = (level.price - entryPrice) * level.pct;
    return sum + profitAtLevel;
  }, 0);
  
  return {
    strategy,
    takeProfitLevels: levels,
    trailingActivation,
    trailingDistance,
    timeExitMinutes: timeExit,
    expectedProfit,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COST-AWARE EV CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

interface CostAdjustedEV {
  grossEv: number;
  netEv: number;
  fees: number;
  slippage: number;
  winProbability: number;
  lossProbability: number;
  breakEvenWinRate: number;
  isProfitable: boolean;
  reasoning: string[];
}

export function calculateCostAdjustedEV(
  confidence: number,
  positionSize: number,
  currentPrice: number,
  exchange: string = 'kalshi'
): CostAdjustedEV {
  const reasoning: string[] = [];
  
  // Win probability from confidence
  const winProb = confidence / 100;
  const lossProb = 1 - winProb;
  
  // Typical payouts and costs
  const payout = 0.85; // 85% payout on win
  const fees: Record<string, number> = {
    'kalshi': 0.025,      // 2.5% per trade
    'predictit': 0.10,    // 10%
    'polymarket': 0.02,   // 2%
    'crypto_exchange': 0.001, // 0.1% (maker)
  };
  
  const feeRate = fees[exchange] || 0.025;
  const feeCost = positionSize * feeRate * 2; // Entry + exit
  
  // Slippage estimate (wider for larger positions)
  const slippageBase = 0.001; // 0.1%
  const sizeFactor = Math.min(1, positionSize / 10000); // Larger = more slippage
  const slippageRate = slippageBase * (1 + sizeFactor);
  const slippageCost = positionSize * slippageRate;
  
  // Gross EV
  const grossWin = positionSize * payout;
  const grossLoss = positionSize;
  const grossEv = (winProb * grossWin) - (lossProb * grossLoss);
  const grossEvPct = (grossEv / positionSize) * 100;
  
  // Net EV after costs
  const totalCosts = feeCost + slippageCost;
  const netEv = grossEv - totalCosts;
  const netEvPct = (netEv / positionSize) * 100;
  
  // Break-even win rate
  const breakEvenWinRate = (100 + (feeRate * 200)) / (100 + payout * 100);
  
  reasoning.push(`Gross EV: ${grossEvPct.toFixed(2)}%`);
  reasoning.push(`Fees: ${(feeRate * 100).toFixed(2)}% = $${feeCost.toFixed(2)}`);
  reasoning.push(`Slippage: ${(slippageRate * 100).toFixed(3)}% = $${slippageCost.toFixed(2)}`);
  reasoning.push(`Net EV: ${netEvPct.toFixed(2)}%`);
  reasoning.push(`Break-even win rate: ${(breakEvenWinRate * 100).toFixed(1)}%`);
  
  const isProfitable = netEv > 0 && winProb > breakEvenWinRate;
  
  if (!isProfitable) {
    reasoning.push('❌ Not profitable after costs');
  } else {
    reasoning.push('✓ Profitable after costs');
  }
  
  return {
    grossEv: grossEvPct,
    netEv: netEvPct,
    fees: feeCost,
    slippage: slippageCost,
    winProbability: winProb,
    lossProbability: lossProb,
    breakEvenWinRate: breakEvenWinRate * 100,
    isProfitable,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRELATION FILTERING
// ═══════════════════════════════════════════════════════════════════════════

interface CorrelationFilter {
  canTrade: boolean;
  correlationRisk: 'low' | 'medium' | 'high';
  adjustment: number;
  reasoning: string[];
}

// Track recent trades for correlation analysis
const recentTrades: Array<{
  symbol: string;
  direction: 'ABOVE' | 'BELOW';
  timestamp: number;
  size: number;
}> = [];

export function checkCorrelationRisk(
  symbol: string,
  direction: 'ABOVE' | 'BELOW',
  positionSize: number,
  maxCorrelationExposure: number = 0.3
): CorrelationFilter {
  const reasoning: string[] = [];
  
  // Clean old trades (>24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  while (recentTrades.length > 0 && recentTrades[0].timestamp < cutoff) {
    recentTrades.shift();
  }
  
  // Check for similar recent trades
  const similarTrades = recentTrades.filter(t => 
    t.symbol === symbol && 
    t.direction === direction &&
    Date.now() - t.timestamp < 2 * 60 * 60 * 1000 // Within 2 hours
  );
  
  const correlatedExposure = similarTrades.reduce((sum, t) => sum + t.size, 0);
  const totalPortfolio = positionSize + correlatedExposure; // Simplified
  const correlationPct = correlatedExposure / totalPortfolio;
  
  let canTrade = true;
  let correlationRisk: CorrelationFilter['correlationRisk'] = 'low';
  let adjustment = 1;
  
  if (correlationPct > maxCorrelationExposure * 2) {
    canTrade = false;
    correlationRisk = 'high';
    adjustment = 0;
    reasoning.push(`❌ High correlation risk: ${(correlationPct * 100).toFixed(1)}% in same-direction trades`);
  } else if (correlationPct > maxCorrelationExposure) {
    correlationRisk = 'medium';
    adjustment = 0.5;
    reasoning.push(`⚠ Medium correlation: ${(correlationPct * 100).toFixed(1)}% - reducing size 50%`);
  } else {
    reasoning.push(`✓ Low correlation risk: ${(correlationPct * 100).toFixed(1)}%`);
  }
  
  // Record this trade
  if (canTrade) {
    recentTrades.push({ symbol, direction, timestamp: Date.now(), size: positionSize });
  }
  
  return { canTrade, correlationRisk, adjustment, reasoning };
}

// ═══════════════════════════════════════════════════════════════════════════
// WIN STREAK / LOSS STREAK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

interface StreakStatus {
  currentStreak: number;
  streakType: 'win' | 'loss' | 'neutral';
  sizingAdjustment: number;
  maxDrawdownPct: number;
  shouldReduceSize: boolean;
  reasoning: string[];
}

const tradeHistory: Array<{ result: 'win' | 'loss'; pnl: number; timestamp: number }> = [];

export function calculateStreakStatus(maxHistory: number = 20): StreakStatus {
  const reasoning: string[] = [];
  
  // Keep only recent history
  while (tradeHistory.length > maxHistory) {
    tradeHistory.shift();
  }
  
  if (tradeHistory.length === 0) {
    return {
      currentStreak: 0,
      streakType: 'neutral',
      sizingAdjustment: 1,
      maxDrawdownPct: 0,
      shouldReduceSize: false,
      reasoning: ['No trade history yet'],
    };
  }
  
  // Calculate current streak
  let streak = 0;
  let streakType: StreakStatus['streakType'] = 'neutral';
  
  for (let i = tradeHistory.length - 1; i >= 0; i--) {
    if (streak === 0) {
      streakType = tradeHistory[i].result === 'win' ? 'win' : 'loss';
      streak = 1;
    } else if (tradeHistory[i].result === streakType) {
      streak++;
    } else {
      break;
    }
  }
  
  // Calculate drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;
  
  for (const trade of tradeHistory) {
    runningPnl += trade.pnl;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  
  // Sizing adjustment based on streak and drawdown
  let sizingAdjustment = 1;
  let shouldReduceSize = false;
  
  // Reduce size during loss streaks
  if (streakType === 'loss' && streak >= 3) {
    sizingAdjustment = Math.max(0.5, 1 - streak * 0.15);
    shouldReduceSize = true;
    reasoning.push(`Loss streak (${streak}) → Size reduced to ${(sizingAdjustment * 100).toFixed(0)}%`);
  }
  
  // Increase size slightly during win streaks (momentum)
  if (streakType === 'win' && streak >= 3) {
    sizingAdjustment = Math.min(1.2, 1 + streak * 0.05);
    reasoning.push(`Win streak (${streak}) → Size increased to ${(sizingAdjustment * 100).toFixed(0)}%`);
  }
  
  // Cap size during drawdowns
  if (maxDrawdownPct > 10) {
    sizingAdjustment *= 0.7;
    shouldReduceSize = true;
    reasoning.push(`Drawdown (${maxDrawdownPct.toFixed(1)}%) → Additional 30% size reduction`);
  }
  
  return {
    currentStreak: streak,
    streakType,
    sizingAdjustment,
    maxDrawdownPct,
    shouldReduceSize,
    reasoning,
  };
}

export function recordTradeResult(result: 'win' | 'loss', pnl: number): void {
  tradeHistory.push({ result, pnl, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMAL BET SIZE — KELLY WITH HALF-KELLY SAFETY
// ═══════════════════════════════════════════════════════════════════════════

interface OptimalBetSize {
  fullKelly: number;
  halfKelly: number;
  quarterKelly: number;
  recommendedSize: number;
  recommendedPct: number;
  maxBet: number;
  reasoning: string[];
}

export function calculateOptimalBetSize(
  winProbability: number,
  payout: number,
  portfolioValue: number,
  confidence: number,
  setupGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F',
  riskProfile: 'conservative' | 'moderate' | 'aggressive' | 'extreme'
): OptimalBetSize {
  const reasoning: string[] = [];
  
  // Calculate Kelly
  const lossProbability = 1 - winProbability;
  const b = payout; // Decimal odds (0.85 = win 0.85x your stake)
  const p = winProbability;
  const q = lossProbability;
  
  // Kelly fraction: f* = (bp - q) / b
  const edge = b * p - q;
  const fullKelly = edge / b;
  
  reasoning.push(`Edge: ${(edge * 100).toFixed(2)}%`);
  reasoning.push(`Full Kelly: ${(fullKelly * 100).toFixed(2)}%`);
  
  // Fractional Kelly based on setup quality
  let kellyFraction: number;
  switch (setupGrade) {
    case 'A+': kellyFraction = 0.5; break;  // Half Kelly for best setups
    case 'A': kellyFraction = 0.4; break;   // 40% Kelly
    case 'B': kellyFraction = 0.25; break;  // Quarter Kelly
    default: kellyFraction = 0.15; break;  // Minimal for marginal setups
  }
  
  // Risk profile adjustment
  const profileMultipliers: Record<string, number> = {
    'conservative': 0.5,
    'moderate': 1,
    'aggressive': 1.5,
    'extreme': 2,
  };
  
  kellyFraction *= profileMultipliers[riskProfile];
  
  const halfKelly = fullKelly * 0.5;
  const quarterKelly = fullKelly * 0.25;
  const recommendedKelly = fullKelly * kellyFraction;
  
  reasoning.push(`${(kellyFraction * 100).toFixed(0)}% Kelly: ${(recommendedKelly * 100).toFixed(2)}%`);
  
  // Calculate dollar amounts
  const recommendedPct = Math.max(0, recommendedKelly);
  const recommendedSize = portfolioValue * recommendedPct;
  
  // Maximum bet limit (risk management)
  const maxRiskPct = RISK_PROFILES[riskProfile].maxPositionSize;
  const maxBet = portfolioValue * maxRiskPct;
  
  if (recommendedSize > maxBet) {
    reasoning.push(`Capped at max bet: $${maxBet.toFixed(0)} (${(maxRiskPct * 100).toFixed(1)}%)`);
  }
  
  // Confidence adjustment
  if (confidence >= 85) {
    reasoning.push('High confidence (85%+) — using full recommended size');
  } else if (confidence < 60) {
    reasoning.push('Low confidence (<60%) — reducing size 50%');
  }
  
  return {
    fullKelly: fullKelly * 100,
    halfKelly: halfKelly * 100,
    quarterKelly: quarterKelly * 100,
    recommendedSize: Math.min(recommendedSize, maxBet),
    recommendedPct: Math.min(recommendedPct, maxRiskPct),
    maxBet,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PROFITABILITY OPTIMIZATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export interface ProfitabilityOptimization {
  originalConfidence: number;
  optimizedConfidence: number;
  shouldTrade: boolean;
  setupGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  setupScore: number;
  
  positionSize: {
    original: number;
    optimized: number;
    sizingMultiplier: number;
    streakAdjustment: number;
    correlationAdjustment: number;
    finalSize: number;
  };
  
  ev: {
    gross: number;
    afterCosts: number;
    isProfitable: boolean;
  };
  
  profitTaking: ProfitTakingStrategy;
  
  streakStatus: StreakStatus;
  correlationFilter: CorrelationFilter;
  
  reasoning: string[];
  warnings: string[];
}

export function optimizeForProfitability(
  params: SetupParams & {
    portfolioValue: number;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    exchange?: string;
  }
): ProfitabilityOptimization {
  const warnings: string[] = [];
  const allReasoning: string[] = [];
  
  // 1. Evaluate setup quality
  const setupQuality = evaluateSetupQuality(params);
  allReasoning.push(...setupQuality.reasoning);
  
  if (!setupQuality.shouldTrade && setupQuality.grade <= 'C') {
    warnings.push(`Setup graded ${setupQuality.grade} — trading not recommended`);
  }
  
  // 2. Optimize confidence
  const optimizedConfidence = Math.min(99, Math.round(
    params.confidence * setupQuality.confidenceMultiplier
  ));
  
  // 3. Check correlation risk
  const predictedDirection = optimizedConfidence > 55 ? 
    (params.sentimentScore > 0 ? 'ABOVE' : 'BELOW') : 'BELOW';
  
  const correlationFilter = checkCorrelationRisk(
    params.regime.includes('uptrend') ? 'BTC_LONG' : 'BTC_SHORT',
    predictedDirection,
    params.portfolioValue * 0.1,
    0.3
  );
  allReasoning.push(...correlationFilter.reasoning);
  
  // 4. Check streak status
  const streakStatus = calculateStreakStatus();
  allReasoning.push(...streakStatus.reasoning);
  
  // 5. Calculate optimal position size
  const winProb = optimizedConfidence / 100;
  const payout = 0.85;
  
  const optimalSize = calculateOptimalBetSize(
    winProb,
    payout,
    params.portfolioValue,
    optimizedConfidence,
    setupQuality.grade,
    'moderate'
  );
  
  const originalSize = params.portfolioValue * (params.kelly / 100);
  const afterSetupSizing = originalSize * setupQuality.sizingMultiplier;
  const afterStreak = afterSetupSizing * streakStatus.sizingAdjustment;
  const afterCorrelation = afterStreak * correlationFilter.adjustment;
  const finalSize = Math.min(afterCorrelation, optimalSize.maxBet);
  
  allReasoning.push(...optimalSize.reasoning);
  
  // 6. Calculate cost-adjusted EV
  const costEv = calculateCostAdjustedEV(
    optimizedConfidence,
    finalSize,
    params.entryPrice,
    params.exchange || 'kalshi'
  );
  allReasoning.push(...costEv.reasoning);
  
  // 7. Optimize profit-taking
  const profitTaking = optimizeProfitTaking(
    params.entryPrice,
    params.targetPrice,
    params.stopLoss,
    params.regime,
    params.volatility,
    params.timeToExpiry,
    optimizedConfidence
  );
  allReasoning.push(...profitTaking.reasoning);
  
  // Final warnings
  if (!costEv.isProfitable) {
    warnings.push('Trade not profitable after costs — DO NOT TRADE');
  }
  
  if (streakStatus.shouldReduceSize && streakStatus.currentStreak >= 4) {
    warnings.push(`In ${streakStatus.currentStreak}-trade loss streak — consider break`);
  }
  
  return {
    originalConfidence: params.confidence,
    optimizedConfidence,
    shouldTrade: setupQuality.shouldTrade && costEv.isProfitable && correlationFilter.canTrade,
    setupGrade: setupQuality.grade,
    setupScore: setupQuality.score,
    
    positionSize: {
      original: originalSize,
      optimized: afterSetupSizing,
      sizingMultiplier: setupQuality.sizingMultiplier,
      streakAdjustment: streakStatus.sizingAdjustment,
      correlationAdjustment: correlationFilter.adjustment,
      finalSize,
    },
    
    ev: {
      gross: costEv.grossEv,
      afterCosts: costEv.netEv,
      isProfitable: costEv.isProfitable,
    },
    
    profitTaking,
    streakStatus,
    correlationFilter,
    
    reasoning: allReasoning,
    warnings,
  };
}

// recordTradeResult already exported above
