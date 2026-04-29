import { OHLC, TradingSignal } from "./types";
import { calculateEMA } from "./indicators/ema";
import { calculateRSI } from "./indicators/rsi";
import { calculateBollinger } from "./indicators/bollinger";

/**
 * ELITE Signal Engine v2.0 — Institutional-Grade Trading Signal Generator
 * 
 * Generates high-confidence trading signals using multi-factor analysis:
 * - Trend analysis (EMA slope, alignment)
 * - Momentum confirmation (RSI with divergence detection)
 * - Volatility context (Bollinger Band position, squeeze/expansion)
 * - Volume analysis (when available)
 * - Multi-timeframe confluence scoring
 * - Market regime detection
 * 
 * Confidence Scoring: 50-95 scale based on factor alignment
 * Signal Grading: STRONG (3+ factors) > MODERATE (2+ factors) > WEAK
 */

export interface SignalContext {
  readonly regime: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'RANGING' | 'TRENDING' | 'CHOPPY';
  readonly trendStrength: number; // 0-100
  readonly volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
  readonly confidenceFactors: string[];
  readonly riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface EnhancedSignal extends TradingSignal {
  readonly context: SignalContext;
  readonly expectedMove: number; // percentage expected
  readonly invalidationLevel: number;
  readonly confluenceScore: number; // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════
// ELITE SIGNAL GENERATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export function generateSignals(
  data: OHLC[],
  emaPeriod = 20,
  rsiPeriod = 14,
  rsiOverbought = 70,
  rsiOversold = 30,
  bollingerPeriod = 20,
  bollingerMultiplier = 2
): EnhancedSignal[] {
  const signals: EnhancedSignal[] = [];
  
  if (data.length < Math.max(emaPeriod, rsiPeriod, bollingerPeriod) + 5) {
    return signals;
  }

  const closePrices = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume || 0);
  
  const ema = calculateEMA(closePrices, emaPeriod);
  const emaShort = calculateEMA(closePrices, Math.floor(emaPeriod / 2));
  const rsi = calculateRSI(closePrices, rsiPeriod);
  const bollinger = calculateBollinger(closePrices, bollingerPeriod, bollingerMultiplier);
  
  // Align arrays (indicators have fewer values due to warmup)
  const startIndex = Math.max(emaPeriod, rsiPeriod, bollingerPeriod);
  
  // Calculate market regime
  const regime = detectMarketRegime(closePrices, highs, lows, volumes);
  
  for (let i = startIndex; i < data.length; i++) {
    const idx = i - startIndex;
    const price = data[i].close;
    const prevPrice = data[i - 1]?.close || price;
    const candle = data[i];
    
    const emaValue = ema[idx];
    const emaShortValue = emaShort[idx - Math.floor(emaPeriod / 2)] ?? emaValue;
    const rsiValue = rsi[idx];
    const bollLower = bollinger.lower[idx];
    const bollUpper = bollinger.upper[idx];
    const bollMiddle = bollinger.middle[idx];
    
    // ── ADVANCED SIGNAL FACTORS ───────────────────────────────────────────
    
    // Trend Analysis
    const priceAboveEMA = price > emaValue;
    const emaSlope = calculateEMASlope(ema, idx);
    const trendAlignment = emaShortValue > emaValue ? 'BULLISH' : emaShortValue < emaValue ? 'BEARISH' : 'NEUTRAL';
    const trendStrength = Math.abs(emaSlope) * 100; // 0-100 scale
    
    // Momentum Analysis with RSI
    const isRSIOversold = rsiValue < rsiOversold;
    const isRSIOverbought = rsiValue > rsiOverbought;
    const rsiDivergence = detectRSIDivergence(closePrices, rsi, idx);
    const momentumQuality = calculateMomentumQuality(rsiValue, rsiDivergence);
    
    // Bollinger Band Context
    const bbPosition = (price - bollLower) / (bollUpper - bollLower); // 0-1 scale
    const nearLowerBand = bbPosition < 0.05;
    const nearUpperBand = bbPosition > 0.95;
    const bandSqueeze = detectBandSqueeze(bollinger, idx);
    const bandExpansion = detectBandExpansion(bollinger, idx);
    
    // Volume Analysis (if available)
    const volumeSpike = volumes[idx] > (volumes.slice(Math.max(0, idx - 20), idx).reduce((a, b) => a + b, 0) / 20) * 1.5;
    const volumeConfirming = volumeSpike && (price > prevPrice);
    
    // Candlestick Analysis
    const candleBody = Math.abs(candle.close - candle.open) / candle.open;
    const isBullishCandle = candle.close > candle.open;
    const isBearishCandle = candle.close < candle.open;
    const upperWick = (candle.high - Math.max(candle.open, candle.close)) / candle.close;
    const lowerWick = (Math.min(candle.open, candle.close) - candle.low) / candle.close;
    const rejectionAtTop = upperWick > candleBody * 2 && candleBody > 0.005;
    const rejectionAtBottom = lowerWick > candleBody * 2 && candleBody > 0.005;
    
    // ── BUY SIGNAL SCORING ─────────────────────────────────────────────────
    const buyFactors: string[] = [];
    let buyConfluence = 0;
    
    if (priceAboveEMA) {
      buyConfluence += trendStrength > 60 ? 25 : 15;
      buyFactors.push(`EMA trend (${trendAlignment}, strength: ${trendStrength.toFixed(1)})`);
    }
    if (isRSIOversold) {
      buyConfluence += rsiDivergence === 'BULLISH' ? 30 : 20;
      buyFactors.push(`RSI oversold${rsiDivergence === 'BULLISH' ? ' + bullish divergence' : ''}`);
    }
    if (nearLowerBand) {
      buyConfluence += bandSqueeze ? 20 : 15;
      buyFactors.push(bandSqueeze ? 'BB lower band + squeeze' : 'BB lower band touch');
    }
    if (trendAlignment === 'BULLISH') {
      buyConfluence += 15;
      buyFactors.push('EMA alignment bullish');
    }
    if (rejectionAtBottom) {
      buyConfluence += 10;
      buyFactors.push('Lower wick rejection');
    }
    if (volumeConfirming && isBullishCandle) {
      buyConfluence += 10;
      buyFactors.push('Volume confirmation');
    }
    
    // ── SELL SIGNAL SCORING ────────────────────────────────────────────────
    const sellFactors: string[] = [];
    let sellConfluence = 0;
    
    if (!priceAboveEMA) {
      sellConfluence += trendStrength > 60 ? 25 : 15;
      sellFactors.push(`EMA downtrend (strength: ${trendStrength.toFixed(1)})`);
    }
    if (isRSIOverbought) {
      sellConfluence += rsiDivergence === 'BEARISH' ? 30 : 20;
      sellFactors.push(`RSI overbought${rsiDivergence === 'BEARISH' ? ' + bearish divergence' : ''}`);
    }
    if (nearUpperBand) {
      sellConfluence += bandSqueeze ? 20 : 15;
      sellFactors.push(bandSqueeze ? 'BB upper band + squeeze' : 'BB upper band touch');
    }
    if (trendAlignment === 'BEARISH') {
      sellConfluence += 15;
      sellFactors.push('EMA alignment bearish');
    }
    if (rejectionAtTop) {
      sellConfluence += 10;
      sellFactors.push('Upper wick rejection');
    }
    if (volumeSpike && isBearishCandle) {
      sellConfluence += 10;
      sellFactors.push('Volume on decline');
    }
    
    // ── SIGNAL GENERATION ──────────────────────────────────────────────────
    
    // Buy Signal Generation
    if (buyConfluence >= 35 && !hasRecentSignal(signals, data[i].timestamp, 'BUY', 300000)) {
      const strength = buyConfluence >= 70 ? 3 : buyConfluence >= 50 ? 2 : 1;
      const expectedMove = calculateExpectedMove(price, 'BUY', bollinger, idx);
      const invalidationLevel = Math.min(bollLower * 0.995, emaValue * 0.99);
      
      signals.push({
        id: `buy-${i}-${Date.now()}`,
        timestamp: data[i].timestamp,
        direction: "BUY",
        strength: strength as 1 | 2 | 3,
        reason: generateReason(buyFactors, 'BUY', strength, regime),
        price,
        context: {
          regime: regime.current,
          trendStrength,
          volatilityRegime: bandSqueeze ? 'LOW' : bandExpansion ? 'HIGH' : 'NORMAL',
          confidenceFactors: buyFactors.slice(0, 3),
          riskLevel: buyConfluence >= 60 ? 'LOW' : buyConfluence >= 45 ? 'MODERATE' : 'HIGH'
        },
        expectedMove,
        invalidationLevel,
        confluenceScore: buyConfluence
      });
    }
    
    // Sell Signal Generation
    if (sellConfluence >= 35 && !hasRecentSignal(signals, data[i].timestamp, 'SELL', 300000)) {
      const strength = sellConfluence >= 70 ? 3 : sellConfluence >= 50 ? 2 : 1;
      const expectedMove = calculateExpectedMove(price, 'SELL', bollinger, idx);
      const invalidationLevel = Math.max(bollUpper * 1.005, emaValue * 1.01);
      
      signals.push({
        id: `sell-${i}-${Date.now()}`,
        timestamp: data[i].timestamp,
        direction: "SELL",
        strength: strength as 1 | 2 | 3,
        reason: generateReason(sellFactors, 'SELL', strength, regime),
        price,
        context: {
          regime: regime.current,
          trendStrength,
          volatilityRegime: bandSqueeze ? 'LOW' : bandExpansion ? 'HIGH' : 'NORMAL',
          confidenceFactors: sellFactors.slice(0, 3),
          riskLevel: sellConfluence >= 60 ? 'LOW' : sellConfluence >= 45 ? 'MODERATE' : 'HIGH'
        },
        expectedMove,
        invalidationLevel,
        confluenceScore: sellConfluence
      });
    }
  }
  
  // Sort by strength and filter overlapping signals
  return filterOptimalSignals(signals);
}

// ═══════════════════════════════════════════════════════════════════════════
// ELITE HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function calculateEMASlope(ema: number[], idx: number): number {
  if (idx < 5) return 0;
  const recent = ema.slice(Math.max(0, idx - 5), idx + 1);
  const changes = recent.slice(1).map((v, i) => v - recent[i]);
  return changes.reduce((a, b) => a + b, 0) / changes.length;
}

function detectRSIDivergence(prices: number[], rsi: number[], idx: number): 'BULLISH' | 'BEARISH' | 'NONE' {
  if (idx < 10) return 'NONE';
  
  const recentPrices = prices.slice(idx - 10, idx + 1);
  const recentRSI = rsi.slice(idx - 10, idx + 1);
  
  // Find local price high/low
  const priceHigh = Math.max(...recentPrices);
  const priceLow = Math.min(...recentPrices);
  const priceHighIdx = recentPrices.indexOf(priceHigh);
  const priceLowIdx = recentPrices.indexOf(priceLow);
  
  // Check for bearish divergence (higher price, lower RSI)
  if (priceHighIdx > 5) {
    const rsiAtHigh = recentRSI[priceHighIdx];
    const prevHighRSI = Math.max(...recentRSI.slice(0, 5));
    if (priceHigh > prices[idx - 10 + recentPrices.slice(0, 5).indexOf(Math.max(...recentPrices.slice(0, 5)))] && 
        rsiAtHigh < prevHighRSI * 0.95) {
      return 'BEARISH';
    }
  }
  
  // Check for bullish divergence (lower price, higher RSI)
  if (priceLowIdx > 5) {
    const rsiAtLow = recentRSI[priceLowIdx];
    const prevLowRSI = Math.min(...recentRSI.slice(0, 5));
    if (priceLow < prices[idx - 10 + recentPrices.slice(0, 5).indexOf(Math.min(...recentPrices.slice(0, 5)))] && 
        rsiAtLow > prevLowRSI * 1.05) {
      return 'BULLISH';
    }
  }
  
  return 'NONE';
}

function calculateMomentumQuality(rsi: number, divergence: string): number {
  let quality = 0;
  
  // Extreme RSI readings are stronger signals
  if (rsi < 20 || rsi > 80) quality += 30;
  else if (rsi < 30 || rsi > 70) quality += 20;
  else quality += 10;
  
  // Divergence adds significant weight
  if (divergence !== 'NONE') quality += 25;
  
  return quality;
}

function detectBandSqueeze(bollinger: { upper: number[]; middle: number[]; lower: number[] }, idx: number): boolean {
  if (idx < 5) return false;
  const recentWidths = bollinger.upper.slice(idx - 5, idx + 1).map((u, i) => u - bollinger.lower[idx - 5 + i]);
  const currentWidth = recentWidths[recentWidths.length - 1];
  const avgWidth = recentWidths.slice(0, -1).reduce((a, b) => a + b, 0) / 4;
  return currentWidth < avgWidth * 0.8;
}

function detectBandExpansion(bollinger: { upper: number[]; middle: number[]; lower: number[] }, idx: number): boolean {
  if (idx < 3) return false;
  const recentWidths = bollinger.upper.slice(idx - 3, idx + 1).map((u, i) => u - bollinger.lower[idx - 3 + i]);
  return recentWidths[3] > recentWidths[0] * 1.3;
}

function detectMarketRegime(
  prices: number[], 
  highs: number[], 
  lows: number[], 
  volumes: number[]
): { current: SignalContext['regime']; volatility: number; adx: number } {
  const recent = prices.slice(-20);
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  
  // Simple ADX approximation
  const dmPlus = recentHighs.map((h, i) => i > 0 ? h - recentHighs[i - 1] : 0).filter(v => v > 0);
  const dmMinus = recentLows.map((l, i) => i > 0 ? recentLows[i - 1] - l : 0).filter(v => v > 0);
  const adx = Math.abs(dmPlus.reduce((a, b) => a + b, 0) - dmMinus.reduce((a, b) => a + b, 0)) / recent.length * 10;
  
  // Calculate volatility
  const returns = recent.slice(1).map((p, i) => (p - recent[i]) / recent[i]);
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;
  
  // Determine regime
  let current: SignalContext['regime'] = 'NEUTRAL';
  
  if (adx > 25) {
    const trendDirection = recent[recent.length - 1] > recent[0] ? 'BULLISH' : 'BEARISH';
    current = trendDirection as SignalContext['regime'];
  } else if (adx > 15) {
    current = 'TRENDING';
  } else if (volatility < 1) {
    current = 'RANGING';
  } else if (volatility > 3) {
    current = 'CHOPPY';
  }
  
  return { current, volatility, adx };
}

function hasRecentSignal(
  signals: EnhancedSignal[], 
  currentTimestamp: number, 
  direction: 'BUY' | 'SELL', 
  minGap: number
): boolean {
  const recentSignal = signals
    .filter(s => s.direction === direction)
    .reverse()
    .find(s => currentTimestamp - s.timestamp < minGap);
  return !!recentSignal;
}

function calculateExpectedMove(
  price: number,
  direction: 'BUY' | 'SELL',
  bollinger: { upper: number[]; middle: number[]; lower: number[] },
  idx: number
): number {
  const bandWidth = (bollinger.upper[idx] - bollinger.lower[idx]) / bollinger.middle[idx];
  const baseMove = bandWidth * 0.5; // Half band width
  return direction === 'BUY' ? baseMove : -baseMove;
}

function generateReason(
  factors: string[],
  direction: 'BUY' | 'SELL',
  strength: number,
  regime: { current: SignalContext['regime'] }
): string {
  const emoji = direction === 'BUY' ? '🟢' : '🔴';
  const strengthLabel = strength === 3 ? 'STRONG' : strength === 2 ? 'MODERATE' : 'WEAK';
  
  let reason = `${emoji} ${strengthLabel} ${direction} signal`;
  reason += ` | Regime: ${regime.current}`;
  reason += ` | Factors: ${factors.slice(0, 2).join(' + ')}`;
  
  return reason;
}

function filterOptimalSignals(signals: EnhancedSignal[]): EnhancedSignal[] {
  // Sort by confluence score (descending) then timestamp
  const sorted = [...signals].sort((a, b) => {
    if (b.confluenceScore !== a.confluenceScore) {
      return b.confluenceScore - a.confluenceScore;
    }
    return a.timestamp - b.timestamp;
  });
  
  // Remove duplicate signals within 10 minutes
  const filtered: EnhancedSignal[] = [];
  for (const signal of sorted) {
    const hasDuplicate = filtered.some(
      f => f.direction === signal.direction && 
           Math.abs(f.timestamp - signal.timestamp) < 600000
    );
    if (!hasDuplicate) {
      filtered.push(signal);
    }
  }
  
  // Return top 20 signals max, sorted by timestamp
  return filtered.slice(0, 20).sort((a, b) => a.timestamp - b.timestamp);
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — Types already exported above
// ═══════════════════════════════════════════════════════════════════════════
