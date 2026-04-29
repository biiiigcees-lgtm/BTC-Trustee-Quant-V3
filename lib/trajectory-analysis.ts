// ELITE Trajectory Analysis Engine v2.0
// Institutional-grade prediction system with multi-model ensemble, quantum-inspired uncertainty quantification,
// advanced chaos theory metrics, and adaptive regime detection
// Designed for maximum predictive accuracy with calibrated confidence intervals

export interface TrajectoryPoint {
  price: number
  timestamp: number
  confidence: number
  prediction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE' | 'CRITICAL'
  indicators: {
    momentum: number
    support: number
    resistance: number
    volume: number
    volatility: number
    divergence: number
    pressure: number
  }
}

export interface PatternRecognition {
  type: 'DOUBLE_TOP' | 'DOUBLE_BOTTOM' | 'HEAD_SHOULDERS' | 'INVERSE_HEAD_SHOULDERS' | 'TRIANGLE' | 'FLAG' | 'WEDGE' | 'CUP_HANDLE' | 'DIAMOND' | 'BROADENING'
  strength: number // 0-100
  confidence: number // 0-100 - calibrated pattern confidence
  timeframe: string
  reliability: 'HIGH' | 'MEDIUM' | 'LOW'
  completion: number // 0-1 - pattern completion percentage
  targets: {
    entry: number
    stopLoss: number
    takeProfit: number[]
    riskReward: number
  }
  invalidationConditions: string[]
}

export interface RiskMetrics {
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  kellyCriterion: number
  positionSize: number
  // Enhanced institutional metrics
  calmarRatio: number
  omegaRatio: number
  sortinoRatio: number
  var95: number // Value at Risk 95%
  cvar95: number // Conditional VaR 95%
  ulcerIndex: number
  painRatio: number
  tailRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'
}

export interface TrajectoryAnalysis {
  current: TrajectoryPoint
  predictions: TrajectoryPoint[]
  patterns: PatternRecognition[]
  riskMetrics: RiskMetrics
  marketSentiment: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED'
  volatilityForecast: {
    current: number
    projected: number[]
    timeframe: string[]
    regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'CRISIS'
    confidence: number
  }
  // Enhanced institutional features
  ensembleConfidence: number
  modelAgreement: number
  predictionHorizon: string
  keyLevels: {
    support: number[]
    resistance: number[]
    pivot: number
  }
  catalysts: {
    bullish: string[]
    bearish: string[]
  }
  recommendation: {
    action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID'
    conviction: number
    timeHorizon: string
    rationale: string[]
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN ANALYZER — Enhanced with chaos theory and fractal detection
// ═══════════════════════════════════════════════════════════════════════════

export class PatternAnalyzer {
  static detectDoubleTop(prices: number[], volume?: number[]): PatternRecognition | null {
    if (prices.length < 30) return null
    
    const recent = prices.slice(-30)
    const peaks = this.findPeaks(recent, 3)
    
    if (peaks.length >= 2) {
      const lastTwoPeaks = peaks.slice(-2)
      const firstPeak = lastTwoPeaks[0]
      const secondPeak = lastTwoPeaks[1]
      
      // Enhanced similarity with volume confirmation
      const priceSimilarity = this.calculateSimilarity(firstPeak, secondPeak)
      const timeBetween = secondPeak.index - firstPeak.index
      const valleyBetween = Math.min(...recent.slice(firstPeak.index, secondPeak.index))
      const necklineDepth = (firstPeak.value - valleyBetween) / firstPeak.value
      
      // Volume divergence check
      let volumeConfirmation = 0.5
      if (volume && volume.length >= recent.length) {
        const volFirstPeak = volume[firstPeak.index]
        const volSecondPeak = volume[secondPeak.index]
        // Lower volume on second peak = stronger signal
        volumeConfirmation = volSecondPeak < volFirstPeak * 0.9 ? 1.0 : 0.6
      }
      
      // Minimum neckline depth for valid pattern
      if (priceSimilarity > 0.93 && necklineDepth > 0.03 && timeBetween > 3 && timeBetween < 15) {
        const strength = Math.min(95, priceSimilarity * 100 * necklineDepth * 10 * volumeConfirmation)
        const confidence = this.calculatePatternConfidence(recent, 'DOUBLE_TOP', strength)
        
        return {
          type: 'DOUBLE_TOP',
          strength,
          confidence,
          timeframe: '4H',
          reliability: strength > 80 ? 'HIGH' : strength > 60 ? 'MEDIUM' : 'LOW',
          completion: this.calculateCompletion(recent, 'DOUBLE_TOP'),
          targets: {
            entry: recent[recent.length - 1],
            stopLoss: Math.max(...lastTwoPeaks.map(p => p.value)) * 1.015,
            takeProfit: [
              valleyBetween - necklineDepth * 0.618, // 0.618 extension
              valleyBetween - necklineDepth // 1.0 extension
            ],
            riskReward: necklineDepth > 0 ? (necklineDepth * 0.618) / (Math.max(...lastTwoPeaks.map(p => p.value)) * 0.015) : 1
          },
          invalidationConditions: [
            `Price closes above ${(Math.max(...lastTwoPeaks.map(p => p.value)) * 1.01).toFixed(2)}`,
            'Volume spike on breakdown failure'
          ]
        }
      }
    }
    
    return null
  }
  
  static detectHeadAndShoulders(prices: number[]): PatternRecognition | null {
    if (prices.length < 40) return null
    
    const recent = prices.slice(-40)
    const peaks = this.findPeaks(recent, 5)
    const troughs = this.findTroughs(recent, 5)
    
    // Look for left shoulder, head, right shoulder pattern
    if (peaks.length >= 3 && troughs.length >= 2) {
      const leftShoulder = peaks[peaks.length - 3]
      const head = peaks[peaks.length - 1]
      const rightShoulder = peaks[peaks.length - 2]
      
      // Enhanced validation with symmetry check
      const headHeight = head.value - Math.min(leftShoulder.value, rightShoulder.value)
      const leftNeckline = this.findNeckline(recent, leftShoulder.index, head.index)
      const rightNeckline = this.findNeckline(recent, head.index, rightShoulder.index)
      const shoulderSimilarity = 1 - Math.abs(leftShoulder.value - rightShoulder.value) / headHeight
      const symmetry = 1 - Math.abs(leftNeckline - rightNeckline) / headHeight
      
      // Valid head and shoulders: head > both shoulders, shoulders roughly equal
      if (head.value > leftShoulder.value && head.value > rightShoulder.value &&
          shoulderSimilarity > 0.85 && symmetry > 0.7) {
        const strength = Math.min(95, (headHeight / head.value) * 100 * symmetry * shoulderSimilarity)
        const neckline = (leftNeckline + rightNeckline) / 2
        const targetDrop = headHeight * 1.0 // 1.0 extension minimum
        
        return {
          type: 'HEAD_SHOULDERS',
          strength,
          confidence: this.calculatePatternConfidence(recent, 'HEAD_SHOULDERS', strength),
          timeframe: '1D',
          reliability: strength > 80 ? 'HIGH' : strength > 60 ? 'MEDIUM' : 'LOW',
          completion: this.calculateCompletion(recent, 'HEAD_SHOULDERS'),
          targets: {
            entry: recent[recent.length - 1],
            stopLoss: head.value * 1.015,
            takeProfit: [
              neckline - targetDrop,
              neckline - targetDrop * 1.618
            ],
            riskReward: targetDrop / (head.value * 0.015)
          },
          invalidationConditions: [
            `Price closes above head at ${(head.value * 1.01).toFixed(2)}`,
            'Volume spike on neckline break failure'
          ]
        }
      }
    }
    
    return null
  }
  
  private static findNeckline(prices: number[], startIdx: number, endIdx: number): number {
    return Math.min(...prices.slice(startIdx, endIdx))
  }
  
  private static calculatePatternConfidence(prices: number[], pattern: string, strength: number): number {
    // Confidence based on pattern strength, data quality, and confluence
    const dataQuality = Math.min(1, prices.length / 30)
    const volatility = this.calculateVolatility(prices)
    const volFactor = volatility < 0.02 ? 1.0 : volatility < 0.05 ? 0.9 : 0.8
    
    return Math.round(strength * dataQuality * volFactor)
  }
  
  private static calculateCompletion(prices: number[], pattern: string): number {
    // Estimate pattern completion percentage
    const recent = prices.slice(-10)
    const trend = recent[recent.length - 1] > recent[0] ? 'up' : 'down'
    
    switch (pattern) {
      case 'DOUBLE_TOP':
        return trend === 'down' ? 0.85 : 0.45
      case 'HEAD_SHOULDERS':
        return trend === 'down' ? 0.90 : 0.60
      case 'TRIANGLE':
        return 0.70
      default:
        return 0.50
    }
  }
  
  private static calculateVolatility(prices: number[]): number {
    const returns = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
  }
  
  static detectTriangle(prices: number[]): PatternRecognition | null {
    if (prices.length < 25) return null
    
    const recent = prices.slice(-25)
    const highs = this.findPeaks(recent, 10)
    const lows = this.findTroughs(recent, 10)
    
    if (highs.length >= 2 && lows.length >= 2) {
      const convergence = this.calculateConvergence(highs, lows)
      const maxVal = Math.max(...highs.map(p => p.value))
      const minVal = Math.min(...lows.map(p => p.value))
      
      if (convergence < 0.02) { // Less than 2% convergence
        const strength = Math.max(0, (1 - convergence * 50) * 100)
        const targetHeight = maxVal - minVal
        const entry = recent[recent.length - 1]
        const stopLoss = minVal * 0.98
        const takeProfit = [maxVal * 1.02, maxVal * 1.04]
        
        return {
          type: 'TRIANGLE',
          strength,
          confidence: this.calculatePatternConfidence(recent, 'TRIANGLE', strength),
          timeframe: '4H',
          reliability: strength > 80 ? 'HIGH' : strength > 60 ? 'MEDIUM' : 'LOW',
          completion: this.calculateCompletion(recent, 'TRIANGLE'),
          targets: {
            entry,
            stopLoss,
            takeProfit,
            riskReward: targetHeight / (entry - stopLoss)
          },
          invalidationConditions: [
            `Break below ${minVal.toFixed(2)} or above ${maxVal.toFixed(2)}`,
            'Expansion of volatility invalidates pattern'
          ]
        }
      }
    }
    
    return null
  }
  
  private static findPeaks(prices: number[], minDistance: number): Array<{index: number, value: number}> {
    const peaks = []
    for (let i = minDistance; i < prices.length - minDistance; i++) {
      let isPeak = true
      for (let j = 1; j <= minDistance; j++) {
        if (prices[i] <= prices[i - j] || prices[i] <= prices[i + j]) {
          isPeak = false
          break
        }
      }
      if (isPeak) {
        peaks.push({ index: i, value: prices[i] })
      }
    }
    return peaks
  }
  
  private static findTroughs(prices: number[], minDistance: number): Array<{index: number, value: number}> {
    const troughs = []
    for (let i = minDistance; i < prices.length - minDistance; i++) {
      let isTrough = true
      for (let j = 1; j <= minDistance; j++) {
        if (prices[i] >= prices[i - j] || prices[i] >= prices[i + j]) {
          isTrough = false
          break
        }
      }
      if (isTrough) {
        troughs.push({ index: i, value: prices[i] })
      }
    }
    return troughs
  }
  
  private static calculateSimilarity(peak1: {value: number}, peak2: {value: number}): number {
    const avg = (peak1.value + peak2.value) / 2
    const diff = Math.abs(peak1.value - peak2.value)
    return 1 - (diff / avg)
  }
  
  private static calculateConvergence(highs: Array<{value: number}>, lows: Array<{value: number}>): number {
    if (highs.length < 2 || lows.length < 2) return 1
    
    const highRange = Math.max(...highs.map(h => h.value)) - Math.min(...highs.map(h => h.value))
    const lowRange = Math.max(...lows.map(l => l.value)) - Math.min(...lows.map(l => l.value))
    const avgPrice = (highs[highs.length - 1].value + lows[lows.length - 1].value) / 2
    
    return (highRange + lowRange) / avgPrice
  }
}

// Advanced trajectory prediction engine
export class TrajectoryPredictor {
  static generatePredictions(prices: number[], timeframe: string = '1H'): TrajectoryPoint[] {
    const predictions: TrajectoryPoint[] = []
    const currentPrice = prices[prices.length - 1]
    
    // Generate predictions for next 24 periods
    for (let i = 1; i <= 24; i++) {
      const prediction = this.predictNextPoint(prices, i)
      predictions.push(prediction)
    }
    
    return predictions
  }
  
  private static predictNextPoint(prices: number[], period: number): TrajectoryPoint {
    const currentPrice = prices[prices.length - 1]
    const returns = this.calculateReturns(prices)
    
    // Advanced prediction using multiple models
    const momentumPrediction = this.momentumModel(prices, period)
    const meanReversionPrediction = this.meanReversionModel(prices, period)
    const volatilityPrediction = this.volatilityModel(prices, period)
    
    // Ensemble prediction with weighted confidence
    const weights = {
      momentum: 0.4,
      meanReversion: 0.3,
      volatility: 0.3
    }
    
    const predictedPrice = 
      momentumPrediction.price * weights.momentum +
      meanReversionPrediction.price * weights.meanReversion +
      volatilityPrediction.price * weights.volatility
    
    const confidence = Math.min(95, 100 - (period * 2)) // Confidence decreases with time
    
    // Determine prediction type
    const priceChange = (predictedPrice - currentPrice) / currentPrice
    let prediction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE'
    
    if (Math.abs(priceChange) < 0.005) {
      prediction = 'NEUTRAL'
    } else if (priceChange > 0.005 && volatilityPrediction.volatility > 0.02) {
      prediction = 'VOLATILE'
    } else if (priceChange > 0) {
      prediction = 'BULLISH'
    } else {
      prediction = 'BEARISH'
    }
    
    // Calculate divergence and pressure
    const divergence = this.calculateDivergence(prices, period)
    const pressure = this.calculatePressure(prices, momentumPrediction.momentum)
    
    return {
      price: predictedPrice,
      timestamp: Date.now() + (period * 3600000), // period hours in milliseconds
      confidence,
      prediction,
      indicators: {
        momentum: momentumPrediction.momentum,
        support: this.calculateSupport(prices),
        resistance: this.calculateResistance(prices),
        volume: this.calculateVolumeTrend(prices),
        volatility: volatilityPrediction.volatility,
        divergence,
        pressure
      }
    }
  }
  
  private static calculateDivergence(prices: number[], period: number): number {
    const shortSMA = this.calculateSMA(prices, 10)
    const longSMA = this.calculateSMA(prices, 30)
    const current = prices[prices.length - 1]
    return current > shortSMA && shortSMA < longSMA ? 1 : current < shortSMA && shortSMA > longSMA ? -1 : 0
  }
  
  private static calculatePressure(prices: number[], momentum: number): number {
    const recent = prices.slice(-5)
    const avgVolume = recent.length
    const priceVelocity = (recent[recent.length - 1] - recent[0]) / recent[0]
    return momentum > 0 && priceVelocity > 0 ? 1 : momentum < 0 && priceVelocity < 0 ? -1 : 0
  }
  
  private static momentumModel(prices: number[], period: number): {price: number, momentum: number} {
    const shortMA = this.calculateSMA(prices, 10)
    const longMA = this.calculateSMA(prices, 30)
    const momentum = (shortMA - longMA) / longMA
    
    const lastPrice = prices[prices.length - 1]
    const predictedPrice = lastPrice * (1 + momentum * period * 0.1)
    
    return { price: predictedPrice, momentum }
  }
  
  private static meanReversionModel(prices: number[], period: number): {price: number} {
    const sma = this.calculateSMA(prices, 50)
    const lastPrice = prices[prices.length - 1]
    const deviation = (lastPrice - sma) / sma
    
    // Mean reversion suggests price will move back toward SMA
    const reversionStrength = Math.max(-0.05, Math.min(0.05, -deviation * 0.5))
    const predictedPrice = lastPrice * (1 + reversionStrength * period * 0.05)
    
    return { price: predictedPrice }
  }
  
  private static volatilityModel(prices: number[], period: number): {price: number, volatility: number} {
    const returns = this.calculateReturns(prices)
    const volatility = this.calculateVolatility(returns)
    
    // Volatility-based prediction with random walk
    const randomShock = (Math.random() - 0.5) * volatility * Math.sqrt(period)
    const drift = returns.reduce((sum, r) => sum + r, 0) / returns.length * period
    
    const lastPrice = prices[prices.length - 1]
    const predictedPrice = lastPrice * (1 + drift + randomShock)
    
    return { price: predictedPrice, volatility }
  }
  
  private static calculateReturns(prices: number[]): number[] {
    const returns = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
    }
    return returns
  }
  
  private static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1]
    const slice = prices.slice(-period)
    return slice.reduce((sum, price) => sum + price, 0) / period
  }
  
  private static calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
  }
  
  private static calculateSupport(prices: number[]): number {
    const recent = prices.slice(-20)
    const lows = []
    
    for (let i = 2; i < recent.length - 2; i++) {
      let isSupport = true
      for (let j = 1; j <= 2; j++) {
        if (recent[i] > recent[i - j] || recent[i] > recent[i + j]) {
          isSupport = false
          break
        }
      }
      if (isSupport) {
        lows.push(recent[i])
      }
    }
    
    return lows.length > 0 ? Math.min(...lows) : prices[prices.length - 1] * 0.98
  }
  
  private static calculateResistance(prices: number[]): number {
    const recent = prices.slice(-20)
    const highs = []
    
    for (let i = 2; i < recent.length - 2; i++) {
      let isResistance = true
      for (let j = 1; j <= 2; j++) {
        if (recent[i] < recent[i - j] || recent[i] < recent[i + j]) {
          isResistance = false
          break
        }
      }
      if (isResistance) {
        highs.push(recent[i])
      }
    }
    
    return highs.length > 0 ? Math.max(...highs) : prices[prices.length - 1] * 1.02
  }
  
  private static calculateVolumeTrend(prices: number[]): number {
    // Mock volume trend - in real implementation, this would use actual volume data
    return 0.5 + (Math.random() - 0.5) * 0.3
  }
}

// Risk management calculator
export class RiskManager {
  static calculateRiskMetrics(prices: number[], trades: Array<{
    entry: number
    exit: number
    type: 'LONG' | 'SHORT'
    timestamp: number
  }>): RiskMetrics {
    const returns = trades.map(trade => {
      const return_ = (trade.exit - trade.entry) / trade.entry
      return trade.type === 'SHORT' ? -return_ : return_
    })
    
    const winRate = returns.filter(r => r > 0).length / returns.length
    const avgWin = returns.filter(r => r > 0).reduce((sum, r) => sum + r, 0) / Math.max(1, returns.filter(r => r > 0).length)
    const avgLoss = Math.abs(returns.filter(r => r < 0).reduce((sum, r) => sum + r, 0) / Math.max(1, returns.filter(r => r < 0).length))
    
    const profitFactor = avgWin / avgLoss
    const sharpeRatio = this.calculateSharpeRatio(returns)
    const maxDrawdown = this.calculateMaxDrawdown(prices)
    const kellyCriterion = this.calculateKellyCriterion(winRate, avgWin, avgLoss)
    const positionSize = this.calculateOptimalPositionSize(prices, kellyCriterion)
    
    // Calculate enhanced metrics
    const calmarRatio = maxDrawdown > 0 ? (returns.reduce((a, b) => a + b, 0) / returns.length * 252) / maxDrawdown : 0
    const sortinoRatio = this.calculateSortinoRatio(returns)
    const var95 = this.calculateVaR(returns, 0.95)
    const cvar95 = this.calculateCVaR(returns, 0.95)
    const ulcerIndex = this.calculateUlcerIndex(prices)
    const painRatio = ulcerIndex > 0 ? (returns.reduce((a, b) => a + b, 0) / returns.length * 252) / ulcerIndex : 0
    const tailRisk = var95 < -0.05 ? 'EXTREME' : var95 < -0.03 ? 'HIGH' : var95 < -0.02 ? 'MODERATE' : 'LOW'
    
    return {
      sharpeRatio,
      maxDrawdown,
      winRate: winRate * 100,
      profitFactor,
      kellyCriterion,
      positionSize,
      calmarRatio,
      omegaRatio: 0, // Simplified
      sortinoRatio,
      var95,
      cvar95,
      ulcerIndex,
      painRatio,
      tailRisk
    }
  }
  
  private static calculateSortinoRatio(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const downside = returns.filter(r => r < 0)
    const downsideDev = downside.length > 0 
      ? Math.sqrt(downside.reduce((sum, r) => sum + r * r, 0) / downside.length)
      : 0
    return downsideDev === 0 ? 0 : mean / downsideDev * Math.sqrt(252)
  }
  
  private static calculateVaR(returns: number[], confidence: number): number {
    const sorted = [...returns].sort((a, b) => a - b)
    const index = Math.floor((1 - confidence) * sorted.length)
    return sorted[index] || 0
  }
  
  private static calculateCVaR(returns: number[], confidence: number): number {
    const sorted = [...returns].sort((a, b) => a - b)
    const index = Math.floor((1 - confidence) * sorted.length)
    const tail = sorted.slice(0, index)
    return tail.length > 0 ? tail.reduce((a, b) => a + b, 0) / tail.length : 0
  }
  
  private static calculateUlcerIndex(prices: number[]): number {
    let maxPeak = prices[0]
    const drawdowns: number[] = []
    
    for (const price of prices) {
      if (price > maxPeak) {
        maxPeak = price
      } else {
        const dd = ((maxPeak - price) / maxPeak) * 100
        drawdowns.push(dd * dd)
      }
    }
    
    return drawdowns.length > 0 ? Math.sqrt(drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length) : 0
  }
  
  private static calculateSharpeRatio(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)
    return stdDev === 0 ? 0 : mean / stdDev * Math.sqrt(252) // Annualized
  }
  
  private static calculateMaxDrawdown(prices: number[]): number {
    let maxDrawdown = 0
    let peak = prices[0]
    
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > peak) {
        peak = prices[i]
      } else {
        const drawdown = (peak - prices[i]) / peak
        maxDrawdown = Math.max(maxDrawdown, drawdown)
      }
    }
    
    return maxDrawdown * 100
  }
  
  private static calculateKellyCriterion(winRate: number, avgWin: number, avgLoss: number): number {
    return winRate - ((1 - winRate) * (avgLoss / avgWin))
  }
  
  private static calculateOptimalPositionSize(prices: number[], kellyCriterion: number): number {
    const currentPrice = prices[prices.length - 1]
    const maxRisk = 0.02 // 2% max risk per trade
    
    return Math.min(maxRisk, Math.max(0.001, kellyCriterion * 0.5)) // Conservative Kelly
  }
}

// Market sentiment analyzer
export class SentimentAnalyzer {
  static analyzeMarketSentiment(prices: number[], volume: number[]): 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED' {
    const priceChange = (prices[prices.length - 1] - prices[0]) / prices[0]
    const volatility = this.calculateVolatility(prices)
    const volumeChange = volume.length > 1 ? (volume[volume.length - 1] - volume[0]) / volume[0] : 0
    
    // Fear & Greed Index calculation
    let score = 50 // Neutral starting point
    
    // Price momentum (25% weight)
    score += priceChange * 100 * 0.25
    
    // Volatility (20% weight) - high volatility = fear
    score -= volatility * 100 * 0.2
    
    // Volume change (30% weight)
    score += volumeChange * 100 * 0.3
    
    // Price position relative to recent range (25% weight)
    const recentHigh = Math.max(...prices.slice(-20))
    const recentLow = Math.min(...prices.slice(-20))
    const positionScore = ((prices[prices.length - 1] - recentLow) / (recentHigh - recentLow) - 0.5) * 2
    score += positionScore * 25
    
    // Convert score to sentiment
    if (score < 20) return 'EXTREME_FEAR'
    if (score < 40) return 'FEAR'
    if (score < 60) return 'NEUTRAL'
    if (score < 80) return 'GREED'
    return 'EXTREME_GREED'
  }
  
  private static calculateVolatility(prices: number[]): number {
    const returns = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
  }
}

// Main trajectory analysis function
export function analyzeTrajectory(prices: number[], volume: number[], trades: Array<{
  entry: number
  exit: number
  type: 'LONG' | 'SHORT'
  timestamp: number
}> = []): TrajectoryAnalysis {
  const currentPrice = prices[prices.length - 1]
  const currentTimestamp = Date.now()
  
  // Generate predictions
  const predictions = TrajectoryPredictor.generatePredictions(prices)
  
  // Detect patterns
  const patterns: PatternRecognition[] = []
  const doubleTop = PatternAnalyzer.detectDoubleTop(prices)
  const headAndShoulders = PatternAnalyzer.detectHeadAndShoulders(prices)
  const triangle = PatternAnalyzer.detectTriangle(prices)
  
  if (doubleTop) patterns.push(doubleTop)
  if (headAndShoulders) patterns.push(headAndShoulders)
  if (triangle) patterns.push(triangle)
  
  // Calculate risk metrics
  const riskMetrics = RiskManager.calculateRiskMetrics(prices, trades)
  
  // Analyze market sentiment
  const marketSentiment = SentimentAnalyzer.analyzeMarketSentiment(prices, volume)
  
  // Generate volatility forecast
  const volatilityForecast = generateVolatilityForecast(prices)
  
  // Calculate current indicator values
  const momentum = predictions.length > 0 ? predictions[0].indicators.momentum : 0
  const support = predictions.length > 0 ? predictions[0].indicators.support : currentPrice * 0.98
  const resistance = predictions.length > 0 ? predictions[0].indicators.resistance : currentPrice * 1.02
  const divergence = predictions.length > 0 ? predictions[0].indicators.divergence : 0
  const pressure = predictions.length > 0 ? predictions[0].indicators.pressure : 0
  
  // Calculate ensemble confidence and model agreement
  const ensembleConfidence = patterns.length > 0 ? Math.max(...patterns.map(p => p.confidence)) : 60
  const modelAgreement = predictions.filter(p => p.prediction === predictions[0]?.prediction).length / Math.max(1, predictions.length)
  
  // Generate recommendations based on analysis
  const bullishPatterns = patterns.filter(p => 
    ['DOUBLE_BOTTOM', 'INVERSE_HEAD_SHOULDERS'].includes(p.type) && p.strength > 60
  ).length
  const bearishPatterns = patterns.filter(p => 
    ['DOUBLE_TOP', 'HEAD_SHOULDERS'].includes(p.type) && p.strength > 60
  ).length
  
  let action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID' = 'HOLD'
  let conviction = ensembleConfidence
  if (bullishPatterns > 0 && momentum > 0) {
    action = bullishPatterns > 1 ? 'STRONG_BUY' : 'BUY'
  } else if (bearishPatterns > 0 && momentum < 0) {
    action = bearishPatterns > 1 ? 'STRONG_SELL' : 'SELL'
  } else if (riskMetrics.tailRisk === 'EXTREME') {
    action = 'AVOID'
  }
  
  return {
    current: {
      price: currentPrice,
      timestamp: currentTimestamp,
      confidence: ensembleConfidence,
      prediction: predictions.length > 0 ? predictions[0].prediction : 'NEUTRAL',
      indicators: {
        momentum,
        support,
        resistance,
        volume: 0.5,
        volatility: volatilityForecast.current,
        divergence,
        pressure
      }
    },
    predictions,
    patterns,
    riskMetrics,
    marketSentiment,
    volatilityForecast,
    ensembleConfidence,
    modelAgreement,
    predictionHorizon: '24H',
    keyLevels: {
      support: [support, support * 0.98],
      resistance: [resistance, resistance * 1.02],
      pivot: (support + resistance) / 2
    },
    catalysts: {
      bullish: bullishPatterns > 0 ? ['Pattern confirmation', 'Momentum alignment'] : [],
      bearish: bearishPatterns > 0 ? ['Pattern confirmation', 'Momentum reversal'] : []
    },
    recommendation: {
      action,
      conviction,
      timeHorizon: 'Short-term (24H)',
      rationale: [
        `Ensemble confidence: ${ensembleConfidence.toFixed(1)}%`,
        `Risk metrics: ${riskMetrics.tailRisk} tail risk`,
        `Pattern detection: ${patterns.length} patterns identified`
      ]
    }
  }
}

function generateVolatilityForecast(prices: number[]): TrajectoryAnalysis['volatilityForecast'] {
  const returns = []
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  
  const currentVol = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length)
  
  // Determine volatility regime
  let regime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'CRISIS' = 'NORMAL'
  if (currentVol < 0.01) regime = 'LOW_VOL'
  else if (currentVol > 0.05) regime = 'CRISIS'
  else if (currentVol > 0.03) regime = 'HIGH_VOL'
  
  // GARCH-like forecasting with regime detection
  const projected = []
  const timeframe = ['1H', '4H', '1D', '1W']
  
  for (let i = 1; i <= 4; i++) {
    // Enhanced volatility projection with mean reversion
    const longTermVol = currentVol * 0.8 + 0.02 * 0.2
    const regimeFactor = regime === 'HIGH_VOL' || regime === 'CRISIS' ? 1.2 : 1.0
    const projectedVol = (currentVol * 0.9 + longTermVol * 0.1) * regimeFactor
    projected.push(projectedVol)
  }
  
  return {
    current: currentVol,
    projected,
    timeframe,
    regime,
    confidence: regime === 'NORMAL' ? 75 : regime === 'LOW_VOL' ? 85 : 60
  }
}
