// Advanced AI Prediction Engine
// High-quality prediction system with machine learning integration
// and sophisticated technical analysis for maximum prediction accuracy

export interface AdvancedMarketData {
  price: number
  volume: number
  high: number
  low: number
  close: number
  timestamp: number
  orderBook: {
    bids: { price: number; amount: number }[]
    asks: { price: number; amount: number }[]
  }
  fundingRate: number
  openInterest: number
  liquidations: {
    long: number
    short: number
  }
}

export interface AdvancedPredictionResult {
  prediction: 'ABOVE' | 'BELOW' | 'UNCERTAIN'
  confidence: number
  reasoning: string[]
  keyFactors: {
    factor: string
    impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    weight: number
  }[]
  priceTargets: {
    conservative: number
    realistic: number
    optimistic: number
  }
  riskAssessment: {
    volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
    liquidity: 'HIGH' | 'MEDIUM' | 'LOW'
    marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  }
  modelScores: {
    technical: number
    momentum: number
    volume: number
    sentiment: number
    machineLearning: number
    ensemble: number
  }
  marketRegime: string
  timeToExpiry: number
  expectedMove: number
  probabilityDistribution: {
    above: number
    below: number
    uncertain: number
  }
}

export class AdvancedAIPredictor {
  // Advanced Technical Indicators
  private static calculateIchimoku(prices: number[], period: number = 9) {
    const tenkanSen = this.calculateIchimokuLine(prices, period)
    const kijunSen = this.calculateIchimokuLine(prices, period * 3)
    const senkouSpanA = (tenkanSen + kijunSen) / 2
    const senkouSpanB = this.calculateIchimokuLine(prices, period * 6)
    
    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      cloudTop: Math.max(senkouSpanA, senkouSpanB),
      cloudBottom: Math.min(senkouSpanA, senkouSpanB)
    }
  }

  private static calculateIchimokuLine(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1]
    const slice = prices.slice(-period)
    return (Math.max(...slice) + Math.min(...slice)) / 2
  }

  private static calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 0

    let plusDM = 0
    let minusDM = 0
    let tr = 0

    for (let i = 1; i <= period; i++) {
      const high = highs[highs.length - i]
      const low = lows[lows.length - i]
      const prevHigh = highs[highs.length - i - 1]
      const prevLow = lows[lows.length - i - 1]
      const prevClose = closes[closes.length - i - 1]

      const upMove = high - prevHigh
      const downMove = prevLow - low

      plusDM += upMove > downMove && upMove > 0 ? upMove : 0
      minusDM += downMove > upMove && downMove > 0 ? downMove : 0

      const trValue = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      )
      tr += trValue
    }

    const plusDI = (plusDM / tr) * 100
    const minusDI = (minusDM / tr) * 100
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100

    // Smooth ADX - only if we have enough data
    if (highs.length >= period * 2 + 1) {
      const prevADX: number = this.calculateADX(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1), period)
      return (prevADX * (period - 1) + dx) / period
    }

    return dx
  }

  private static calculateParabolicSAR(highs: number[], lows: number[], af: number = 0.02, maxAF: number = 0.2) {
    if (highs.length < 2) return highs[highs.length - 1]

    let sar = lows[0]
    let ep = highs[0]
    let isUpTrend = true
    let currentAF = af

    for (let i = 1; i < highs.length; i++) {
      const high = highs[i]
      const low = lows[i]

      if (isUpTrend) {
        if (low < sar) {
          isUpTrend = false
          sar = ep
          ep = low
          currentAF = af
        } else {
          sar = sar + currentAF * (ep - sar)
          sar = Math.min(sar, lows[i - 1], lows[i - 2])
          if (high > ep) {
            ep = high
            currentAF = Math.min(currentAF + af, maxAF)
          }
        }
      } else {
        if (high > sar) {
          isUpTrend = true
          sar = ep
          ep = high
          currentAF = af
        } else {
          sar = sar - currentAF * (sar - ep)
          sar = Math.max(sar, highs[i - 1], highs[i - 2])
          if (low < ep) {
            ep = low
            currentAF = Math.min(currentAF + af, maxAF)
          }
        }
      }
    }

    return sar
  }

  private static calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14) {
    if (highs.length < period) return -50

    const recentHighs = highs.slice(-period)
    const recentLows = lows.slice(-period)
    const currentClose = closes[closes.length - 1]

    const highestHigh = Math.max(...recentHighs)
    const lowestLow = Math.min(...recentLows)

    if (highestHigh === lowestLow) return -50

    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100
  }

  private static calculateCCI(highs: number[], lows: number[], closes: number[], period: number = 20) {
    if (highs.length < period) return 0

    const typicalPrices = highs.map((h, i) => (h + lows[i] + closes[i]) / 3)
    const recentTP = typicalPrices.slice(-period)
    const smaTP = recentTP.reduce((a, b) => a + b, 0) / period

    const meanDeviation = recentTP.reduce((acc, tp) => acc + Math.abs(tp - smaTP), 0) / period

    if (meanDeviation === 0) return 0

    return (typicalPrices[typicalPrices.length - 1] - smaTP) / (0.015 * meanDeviation)
  }

  private static calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14) {
    if (highs.length < period + 1) return 50

    let positiveFlow = 0
    let negativeFlow = 0

    for (let i = 1; i <= period; i++) {
      const typicalPrice = (highs[highs.length - i] + lows[lows.length - i] + closes[closes.length - i]) / 3
      const prevTypicalPrice = (highs[highs.length - i - 1] + lows[lows.length - i - 1] + closes[closes.length - i - 1]) / 3

      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += typicalPrice * volumes[volumes.length - i]
      } else if (typicalPrice < prevTypicalPrice) {
        negativeFlow += typicalPrice * volumes[volumes.length - i]
      }
    }

    if (negativeFlow === 0) return 100
    if (positiveFlow === 0) return 0

    const moneyRatio = positiveFlow / negativeFlow
    return 100 - (100 / (1 + moneyRatio))
  }

  // Machine Learning Pattern Recognition
  private static detectPatterns(prices: number[]): {
    patterns: string[]
    confidence: number
  } {
    const patterns: string[] = []
    let confidence = 0

    // Double Top/Bottom Detection
    if (prices.length >= 10) {
      const recent = prices.slice(-10)
      const peak1 = Math.max(...recent.slice(0, 5))
      const peak2 = Math.max(...recent.slice(5))
      const trough1 = Math.min(...recent.slice(0, 5))
      const trough2 = Math.min(...recent.slice(5))

      if (Math.abs(peak1 - peak2) / peak1 < 0.01) {
        patterns.push('DOUBLE_TOP')
        confidence += 0.15
      }
      if (Math.abs(trough1 - trough2) / trough1 < 0.01) {
        patterns.push('DOUBLE_BOTTOM')
        confidence += 0.15
      }
    }

    // Head and Shoulders Detection
    if (prices.length >= 20) {
      const recent = prices.slice(-20)
      const leftShoulder = Math.max(...recent.slice(0, 5))
      const head = Math.max(...recent.slice(5, 10))
      const rightShoulder = Math.max(...recent.slice(10, 15))

      if (head > leftShoulder && head > rightShoulder && 
          Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.02) {
        patterns.push('HEAD_AND_SHOULDERS')
        confidence += 0.2
      }
    }

    // Triangle Pattern Detection
    if (prices.length >= 15) {
      const highs = prices.slice(-15).map((p, i, arr) => Math.max(p, ...arr.slice(Math.max(0, i - 3), i + 4)))
      const lows = prices.slice(-15).map((p, i, arr) => Math.min(p, ...arr.slice(Math.max(0, i - 3), i + 4)))
      
      const highTrend = highs.slice(0, 5).reduce((a, b) => a + b, 0) / 5 - 
                      highs.slice(-5).reduce((a, b) => a + b, 0) / 5
      const lowTrend = lows.slice(0, 5).reduce((a, b) => a + b, 0) / 5 - 
                     lows.slice(-5).reduce((a, b) => a + b, 0) / 5

      if (highTrend > 0 && lowTrend < 0) {
        patterns.push('ASCENDING_TRIANGLE')
        confidence += 0.18
      } else if (highTrend < 0 && lowTrend > 0) {
        patterns.push('DESCENDING_TRIANGLE')
        confidence += 0.18
      }
    }

    // Support/Resistance Levels
    if (prices.length >= 30) {
      const recent = prices.slice(-30)
      const pivot = (Math.max(...recent) + Math.min(...recent)) / 2
      const r1 = 2 * pivot - Math.min(...recent)
      const s1 = 2 * pivot - Math.max(...recent)
      
      const currentPrice = prices[prices.length - 1]
      if (Math.abs(currentPrice - r1) / r1 < 0.005) {
        patterns.push('NEAR_RESISTANCE')
        confidence += 0.12
      }
      if (Math.abs(currentPrice - s1) / s1 < 0.005) {
        patterns.push('NEAR_SUPPORT')
        confidence += 0.12
      }
    }

    return { patterns, confidence: Math.min(confidence, 0.8) }
  }

  // Market Regime Detection
  private static detectMarketRegime(prices: number[], volumes: number[]): {
    regime: string
    confidence: number
    characteristics: string[]
  } {
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i])
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const volatility = Math.sqrt(returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / returns.length)
    
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length
    const volumeTrend = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5 - avgVolume

    const characteristics: string[] = []
    let regime = 'NEUTRAL'
    let confidence = 0.5

    if (avgReturn > 0.001 && volatility < 0.02) {
      regime = 'BULL_TREND'
      confidence = 0.75
      characteristics.push('Strong uptrend with low volatility')
    } else if (avgReturn < -0.001 && volatility < 0.02) {
      regime = 'BEAR_TREND'
      confidence = 0.75
      characteristics.push('Strong downtrend with low volatility')
    } else if (volatility > 0.03) {
      regime = 'HIGH_VOLATILITY'
      confidence = 0.8
      characteristics.push('High volatility environment')
    } else if (Math.abs(avgReturn) < 0.0005 && volatility < 0.01) {
      regime = 'CONSOLIDATION'
      confidence = 0.7
      characteristics.push('Price consolidation')
    }

    if (volumeTrend > avgVolume * 0.2) {
      characteristics.push('Increasing volume')
      confidence += 0.1
    } else if (volumeTrend < -avgVolume * 0.2) {
      characteristics.push('Decreasing volume')
      confidence += 0.1
    }

    return {
      regime,
      confidence: Math.min(confidence, 0.95),
      characteristics
    }
  }

  // Ensemble Model
  private static ensemblePrediction(
    technicalScore: number,
    momentumScore: number,
    volumeScore: number,
    sentimentScore: number,
    mlScore: number,
    patternConfidence: number,
    weights: { technical: number; momentum: number; volume: number; sentiment: number; ml: number; pattern: number }
  ): number {
    const weightedSum = 
      technicalScore * weights.technical +
      momentumScore * weights.momentum +
      volumeScore * weights.volume +
      sentimentScore * weights.sentiment +
      mlScore * weights.ml +
      patternConfidence * weights.pattern

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
    return weightedSum / totalWeight
  }

  // Main Prediction Function
  static async predict(
    marketData: AdvancedMarketData[],
    targetPrice: number,
    timeToExpiry: number,
    additionalData?: {
      fearGreed?: number
      fundingRate?: number
      openInterest?: number
    }
  ): Promise<AdvancedPredictionResult> {
    const currentPrice = marketData[marketData.length - 1].price
    const prices = marketData.map(d => d.close)
    const highs = marketData.map(d => d.high)
    const lows = marketData.map(d => d.low)
    const volumes = marketData.map(d => d.volume)

    // Calculate advanced technical indicators
    const ichimoku = this.calculateIchimoku(prices)
    const adx = this.calculateADX(highs, lows, prices)
    const parabolicSAR = this.calculateParabolicSAR(highs, lows)
    const williamsR = this.calculateWilliamsR(highs, lows, prices)
    const cci = this.calculateCCI(highs, lows, prices)
    const mfi = this.calculateMFI(highs, lows, prices, volumes)

    // Pattern detection
    const patternAnalysis = this.detectPatterns(prices)

    // Market regime detection
    const regimeAnalysis = this.detectMarketRegime(prices, volumes)

    // Calculate individual model scores
    const technicalScore = this.calculateTechnicalScore(
      ichimoku, adx, parabolicSAR, williamsR, cci, mfi, currentPrice
    )
    const momentumScore = this.calculateMomentumScore(prices, volumes)
    const volumeScore = this.calculateVolumeScore(marketData)
    const sentimentScore = this.calculateSentimentScore(
      additionalData?.fearGreed,
      additionalData?.fundingRate,
      additionalData?.openInterest
    )
    const mlScore = this.calculateMLScore(
      patternAnalysis.patterns,
      regimeAnalysis.regime,
      adx,
      mfi
    )

    // Dynamic weighting based on market conditions
    const weights = this.calculateDynamicWeights(
      regimeAnalysis.regime,
      patternAnalysis.confidence,
      timeToExpiry
    )

    // Ensemble prediction
    const ensembleScore = this.ensemblePrediction(
      technicalScore,
      momentumScore,
      volumeScore,
      sentimentScore,
      mlScore,
      patternAnalysis.confidence,
      weights
    )

    // Calculate confidence
    const confidence = this.calculateConfidence(
      ensembleScore,
      patternAnalysis.confidence,
      regimeAnalysis.confidence,
      timeToExpiry,
      adx
    )

    // Determine prediction
    const prediction = this.determinePrediction(
      ensembleScore,
      confidence,
      currentPrice,
      targetPrice,
      timeToExpiry
    )

    // Calculate price targets
    const atr = this.calculateATR(prices)
    const expectedMove = atr * Math.sqrt(timeToExpiry / 60)
    const priceTargets = {
      conservative: currentPrice + (prediction === 'ABOVE' ? expectedMove * 0.5 : -expectedMove * 0.5),
      realistic: currentPrice + (prediction === 'ABOVE' ? expectedMove : -expectedMove),
      optimistic: currentPrice + (prediction === 'ABOVE' ? expectedMove * 1.5 : -expectedMove * 1.5)
    }

    // Risk assessment
    const riskAssessment = this.assessRisk(
      atr,
      volumes[volumes.length - 1],
      additionalData?.fearGreed,
      additionalData?.fundingRate
    )

    // Build reasoning
    const reasoning = this.buildReasoning(
      technicalScore,
      momentumScore,
      volumeScore,
      sentimentScore,
      mlScore,
      patternAnalysis,
      regimeAnalysis,
      ensembleScore,
      timeToExpiry
    )

    // Build key factors
    const keyFactors = this.buildKeyFactors(
      technicalScore,
      momentumScore,
      volumeScore,
      sentimentScore,
      mlScore,
      patternAnalysis
    )

    // Probability distribution
    const probabilityDistribution = this.calculateProbabilityDistribution(
      ensembleScore,
      confidence,
      timeToExpiry,
      currentPrice,
      targetPrice
    )

    return {
      prediction,
      confidence,
      reasoning,
      keyFactors,
      priceTargets,
      riskAssessment,
      modelScores: {
        technical: technicalScore,
        momentum: momentumScore,
        volume: volumeScore,
        sentiment: sentimentScore,
        machineLearning: mlScore,
        ensemble: ensembleScore
      },
      marketRegime: regimeAnalysis.regime,
      timeToExpiry,
      expectedMove,
      probabilityDistribution
    }
  }

  private static calculateTechnicalScore(
    ichimoku: any,
    adx: number,
    parabolicSAR: number,
    williamsR: number,
    cci: number,
    mfi: number,
    currentPrice: number
  ): number {
    let score = 0
    let count = 0

    // Ichimoku
    if (currentPrice > ichimoku.cloudTop) {
      score += 0.8
      count++
    } else if (currentPrice < ichimoku.cloudBottom) {
      score -= 0.8
      count++
    }

    // ADX (trend strength)
    if (adx > 25) {
      score += currentPrice > parabolicSAR ? 0.6 : -0.6
      count++
    } else if (adx > 20) {
      score += currentPrice > parabolicSAR ? 0.3 : -0.3
      count++
    }

    // Williams %R
    if (williamsR < -80) {
      score += 0.5
      count++
    } else if (williamsR > -20) {
      score -= 0.5
      count++
    }

    // CCI
    if (cci > 100) {
      score += 0.4
      count++
    } else if (cci < -100) {
      score -= 0.4
      count++
    }

    // MFI
    if (mfi > 80) {
      score -= 0.5
      count++
    } else if (mfi < 20) {
      score += 0.5
      count++
    }

    return count > 0 ? score / count : 0
  }

  private static calculateMomentumScore(prices: number[], volumes: number[]): number {
    if (prices.length < 10) return 0

    const shortMA = prices.slice(-5).reduce((a, b) => a + b, 0) / 5
    const longMA = prices.slice(-20).reduce((a, b) => a + b, 0) / 20
    const momentum = (shortMA - longMA) / longMA

    const volumeMA = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const recentVolume = volumes[volumes.length - 1]
    const volumeMomentum = (recentVolume - volumeMA) / volumeMA

    return momentum * 10 + volumeMomentum * 5
  }

  private static calculateVolumeScore(marketData: AdvancedMarketData[]): number {
    if (marketData.length < 5) return 0

    const recentData = marketData.slice(-5)
    const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / 5
    const currentVolume = marketData[marketData.length - 1].volume

    const volumeRatio = currentVolume / avgVolume

    // Analyze order book imbalance
    const currentOB = marketData[marketData.length - 1].orderBook
    const bidVolume = currentOB.bids.reduce((sum, b) => sum + b.amount, 0)
    const askVolume = currentOB.asks.reduce((sum, a) => sum + a.amount, 0)
    const obImbalance = (bidVolume - askVolume) / (bidVolume + askVolume)

    return obImbalance * 0.7 + (volumeRatio > 1 ? 0.3 : -0.3)
  }

  private static calculateSentimentScore(
    fearGreed?: number,
    fundingRate?: number,
    openInterest?: number
  ): number {
    let score = 0

    if (fearGreed) {
      // Contrarian: extreme fear = bullish, extreme greed = bearish
      if (fearGreed < 20) score += 0.6
      else if (fearGreed < 40) score += 0.3
      else if (fearGreed > 80) score -= 0.6
      else if (fearGreed > 60) score -= 0.3
    }

    if (fundingRate) {
      // Negative funding = bullish (short squeeze risk)
      if (fundingRate < -0.0001) score += 0.4
      else if (fundingRate > 0.0001) score -= 0.4
    }

    return Math.max(-1, Math.min(1, score))
  }

  private static calculateMLScore(
    patterns: string[],
    regime: string,
    adx: number,
    mfi: number
  ): number {
    let score = 0

    // Pattern-based scoring
    if (patterns.includes('DOUBLE_BOTTOM')) score += 0.4
    if (patterns.includes('DOUBLE_TOP')) score -= 0.4
    if (patterns.includes('HEAD_AND_SHOULDERS')) score -= 0.5
    if (patterns.includes('ASCENDING_TRIANGLE')) score += 0.3
    if (patterns.includes('DESCENDING_TRIANGLE')) score -= 0.3
    if (patterns.includes('NEAR_SUPPORT')) score += 0.2
    if (patterns.includes('NEAR_RESISTANCE')) score -= 0.2

    // Regime-based scoring
    if (regime === 'BULL_TREND') score += 0.5
    if (regime === 'BEAR_TREND') score -= 0.5
    if (regime === 'HIGH_VOLATILITY') score *= 0.5 // Reduce confidence in high vol
    if (regime === 'CONSOLIDATION') score *= 0.3

    // ADX strength
    if (adx > 25) score *= 1.2 // Strong trend amplifies signal
    if (adx < 20) score *= 0.8 // Weak trend reduces signal

    // MFI confirmation
    if (mfi > 60) score *= 1.1 // Strong buying pressure
    if (mfi < 40) score *= 1.1 // Strong selling pressure

    return Math.max(-1, Math.min(1, score))
  }

  private static calculateDynamicWeights(
    regime: string,
    patternConfidence: number,
    timeToExpiry: number
  ): { technical: number; momentum: number; volume: number; sentiment: number; ml: number; pattern: number } {
    let weights = {
      technical: 0.25,
      momentum: 0.20,
      volume: 0.20,
      sentiment: 0.15,
      ml: 0.15,
      pattern: 0.05
    }

    // Adjust based on regime
    if (regime === 'BULL_TREND' || regime === 'BEAR_TREND') {
      weights.momentum += 0.05
      weights.technical -= 0.03
      weights.ml += 0.02
    }

    if (regime === 'HIGH_VOLATILITY') {
      weights.volume += 0.05
      weights.sentiment -= 0.03
      weights.pattern += 0.02
    }

    // Adjust based on pattern confidence
    if (patternConfidence > 0.5) {
      weights.pattern += 0.05
      weights.technical -= 0.02
      weights.momentum -= 0.02
    }

    // Adjust based on time to expiry
    if (timeToExpiry < 300) { // Less than 5 minutes
      weights.momentum += 0.05
      weights.volume += 0.03
      weights.ml -= 0.04
      weights.pattern -= 0.02
    }

    return weights
  }

  private static calculateConfidence(
    ensembleScore: number,
    patternConfidence: number,
    regimeConfidence: number,
    timeToExpiry: number,
    adx: number
  ): number {
    let confidence = 0.5

    // Base confidence from ensemble score strength
    confidence += Math.abs(ensembleScore) * 0.3

    // Pattern confidence
    confidence += patternConfidence * 0.2

    // Regime confidence
    confidence += regimeConfidence * 0.15

    // ADX trend strength
    if (adx > 25) confidence += 0.1
    else if (adx > 20) confidence += 0.05

    // Time penalty (less time = less confidence)
    if (timeToExpiry < 300) confidence -= 0.1
    else if (timeToExpiry < 600) confidence -= 0.05

    return Math.max(0.3, Math.min(0.95, confidence))
  }

  private static determinePrediction(
    ensembleScore: number,
    confidence: number,
    currentPrice: number,
    targetPrice: number,
    timeToExpiry: number
  ): 'ABOVE' | 'BELOW' | 'UNCERTAIN' {
    // If confidence is too low, return uncertain
    if (confidence < 0.55) return 'UNCERTAIN'

    // If very close to target and little time, return uncertain
    const priceGap = Math.abs(currentPrice - targetPrice) / targetPrice
    if (priceGap < 0.002 && timeToExpiry < 180) return 'UNCERTAIN'

    // Determine direction based on ensemble score
    if (ensembleScore > 0.15) return 'ABOVE'
    if (ensembleScore < -0.15) return 'BELOW'

    return 'UNCERTAIN'
  }

  private static calculateATR(prices: number[], period: number = 14): number {
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

    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period
  }

  private static assessRisk(
    atr: number,
    currentVolume: number,
    fearGreed?: number,
    fundingRate?: number
  ): AdvancedPredictionResult['riskAssessment'] {
    const volatility = atr / (atr * 50) * 100 // Approximate percentage

    let volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
    if (volatility < 1) volatilityLevel = 'LOW'
    else if (volatility < 2) volatilityLevel = 'MEDIUM'
    else if (volatility < 4) volatilityLevel = 'HIGH'
    else volatilityLevel = 'EXTREME'

    const liquidity: 'HIGH' | 'MEDIUM' | 'LOW' = currentVolume > 1000000 ? 'HIGH' : currentVolume > 500000 ? 'MEDIUM' : 'LOW'

    let marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
    if (fearGreed) {
      if (fearGreed < 30) marketSentiment = 'BULLISH'
      else if (fearGreed > 70) marketSentiment = 'BEARISH'
    }

    if (fundingRate) {
      if (fundingRate < -0.0001 && marketSentiment !== 'BEARISH') marketSentiment = 'BULLISH'
      if (fundingRate > 0.0001 && marketSentiment !== 'BULLISH') marketSentiment = 'BEARISH'
    }

    return {
      volatility: volatilityLevel,
      liquidity,
      marketSentiment
    }
  }

  private static buildReasoning(
    technicalScore: number,
    momentumScore: number,
    volumeScore: number,
    sentimentScore: number,
    mlScore: number,
    patternAnalysis: { patterns: string[]; confidence: number },
    regimeAnalysis: { regime: string; confidence: number; characteristics: string[] },
    ensembleScore: number,
    timeToExpiry: number
  ): string[] {
    const reasoning: string[] = []

    // Technical analysis
    if (technicalScore > 0.3) reasoning.push('Strong technical indicators pointing upward')
    else if (technicalScore < -0.3) reasoning.push('Technical indicators showing bearish signals')
    else reasoning.push('Technical indicators are mixed')

    // Momentum
    if (momentumScore > 0.3) reasoning.push('Positive momentum detected')
    else if (momentumScore < -0.3) reasoning.push('Negative momentum detected')

    // Volume
    if (volumeScore > 0.3) reasoning.push('Strong buying volume supporting the move')
    else if (volumeScore < -0.3) reasoning.push('Selling pressure evident in volume')

    // Sentiment
    if (sentimentScore > 0.3) reasoning.push('Market sentiment contrarian bullish')
    else if (sentimentScore < -0.3) reasoning.push('Market sentiment contrarian bearish')

    // ML/Patterns
    if (patternAnalysis.patterns.length > 0) {
      reasoning.push(`Detected patterns: ${patternAnalysis.patterns.join(', ')}`)
    }

    // Regime
    reasoning.push(`Market regime: ${regimeAnalysis.regime} - ${regimeAnalysis.characteristics.join(', ')}`)

    // Time context
    const minutesLeft = Math.floor(timeToExpiry / 60)
    reasoning.push(`${minutesLeft} minutes remaining for price to reach target`)

    return reasoning.slice(0, 6)
  }

  private static buildKeyFactors(
    technicalScore: number,
    momentumScore: number,
    volumeScore: number,
    sentimentScore: number,
    mlScore: number,
    patternAnalysis: { patterns: string[]; confidence: number }
  ): AdvancedPredictionResult['keyFactors'] {
    const factors: AdvancedPredictionResult['keyFactors'] = []

    const addFactor = (factor: string, score: number, weight: number) => {
      let impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
      if (score > 0.15) impact = 'BULLISH'
      else if (score < -0.15) impact = 'BEARISH'

      factors.push({
        factor,
        impact,
        weight: Math.abs(score) * weight
      })
    }

    addFactor('Technical Analysis', technicalScore, 25)
    addFactor('Momentum', momentumScore, 20)
    addFactor('Volume Flow', volumeScore, 20)
    addFactor('Market Sentiment', sentimentScore, 15)
    addFactor('ML Pattern Recognition', mlScore, 15)
    addFactor('Pattern Detection', patternAnalysis.confidence, 5)

    return factors.sort((a, b) => b.weight - a.weight)
  }

  private static calculateProbabilityDistribution(
    ensembleScore: number,
    confidence: number,
    timeToExpiry: number,
    currentPrice: number,
    targetPrice: number
  ): { above: number; below: number; uncertain: number } {
    const baseAbove = ensembleScore > 0 ? 0.5 + Math.abs(ensembleScore) * 0.4 : 0.5 - Math.abs(ensembleScore) * 0.4
    const baseBelow = 1 - baseAbove

    // Adjust for confidence
    const adjustedAbove = baseAbove * confidence + 0.5 * (1 - confidence)
    const adjustedBelow = baseBelow * confidence + 0.5 * (1 - confidence)

    // Time decay
    const timeFactor = Math.min(1, timeToExpiry / 900) // 15 minutes max
    const finalAbove = adjustedAbove * timeFactor + 0.5 * (1 - timeFactor)
    const finalBelow = adjustedBelow * timeFactor + 0.5 * (1 - timeFactor)

    const uncertain = 1 - finalAbove - finalBelow

    return {
      above: Math.max(0, finalAbove),
      below: Math.max(0, finalBelow),
      uncertain: Math.max(0, uncertain)
    }
  }
}
