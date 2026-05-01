"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  AlertTriangle,
  Brain,
  BarChart3,
  Zap,
  Clock,
  Bitcoin,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Settings,
  RefreshCw,
  Info
} from "lucide-react"
import { LiveBTCChart } from "./live-btc-chart"
import { BTCPriceDisplay } from "./btc-price-display"
import { 
  BTCTrajectoryAnalyzer, 
  BTCDataGenerator, 
  KalshiIntegration,
  type BTCAnalysisResult,
  type BTCTrajectoryPrediction,
  type KalshiRound,
  type BTCMarketData
} from "@/lib/btc-trajectory-analysis"
import { cn, formatNumber, formatPercent } from "@/lib/utils"

interface BTCKalshiAnalysisProps {
  className?: string;
  currentPrice?: number | null;
  expirySeconds?: number;
}

export function BTCKalshiAnalysis({ className, currentPrice, expirySeconds }: BTCKalshiAnalysisProps) {
  const [analysis, setAnalysis] = useState<BTCAnalysisResult | null>(null)
  const [kalshiRound, setKalshiRound] = useState<KalshiRound | null>(null)
  const [targetPrice, setTargetPrice] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now())
  const [countdown, setCountdown] = useState<string>("")

  // Initialize with real-time BTC data from context (single source of truth)
  useEffect(() => {
    const initializeData = async () => {
      // Only initialize if we have a real price from context
      if (!currentPrice) return

      const price = currentPrice
      const volume = 20_000_000_000 + (Math.random() - 0.5) * 10_000_000_000
      const currentBTCData: BTCMarketData = {
        price,
        volume,
        marketCap: price * 19_500_000,
        dominance: 52 + (Math.random() - 0.5) * 4,
        fearGreedIndex: 30 + Math.random() * 40,
        timestamp: Date.now(),
        exchangeFlow: {
          inflow: Math.random() * 1_000,
          outflow: Math.random() * 1_000,
          netFlow: (Math.random() - 0.5) * 1_000,
        },
        onChainMetrics: {
          activeAddresses: 800_000 + Math.floor(Math.random() * 200_000),
          transactionCount: 250_000 + Math.floor(Math.random() * 50_000),
          hashRate: 4e14 + Math.floor(Math.random() * 1e14),
          difficulty: 7.2e13 + Math.floor(Math.random() * 1e12),
        },
        derivativesData: {
          openInterest: 15_000_000_000 + Math.floor(Math.random() * 5_000_000_000),
          fundingRate: (Math.random() - 0.5) * 0.02,
          longShortRatio: 1.2 + (Math.random() - 0.5) * 0.4,
          liquidations: {
            long: Math.floor(Math.random() * 100_000_000),
            short: Math.floor(Math.random() * 100_000_000),
          },
        },
      }
      const historicalData = BTCDataGenerator.generateHistoricalData(100)
      const defaultRound = KalshiIntegration.createKalshiRound(price, 15)
      
      setKalshiRound(defaultRound)
      setTargetPrice(price.toString())
      
      const result = await BTCTrajectoryAnalyzer.analyzeBTCMarket(
        currentBTCData,
        defaultRound,
        historicalData
      )
      
      setAnalysis(result)
      setLastUpdate(Date.now())
    }

    initializeData()
  }, [currentPrice])
  
  // Update when price changes
  useEffect(() => {
    if (currentPrice && analysis) {
      refreshAnalysis()
    }
  }, [currentPrice])

  // Countdown timer effect with auto-restart
  useEffect(() => {
    if (!kalshiRound) return

    const interval = setInterval(() => {
      const updatedRound = KalshiIntegration.updateCountdown(kalshiRound)
      setKalshiRound(updatedRound)
      setCountdown(KalshiIntegration.formatTimeRemaining(updatedRound.timeRemaining))
      
      if (!updatedRound.isActive) {
        clearInterval(interval)
        // Auto-restart analysis when round expires
        setTimeout(async () => {
          const currentBTCData = BTCDataGenerator.generateCurrentBTCData()
          const newRound = KalshiIntegration.createKalshiRound(updatedRound.targetPrice, 15)
          setKalshiRound(newRound)
          
          const result = await BTCTrajectoryAnalyzer.analyzeBTCMarket(
            currentBTCData,
            newRound,
            BTCDataGenerator.generateHistoricalData(100)
          )
          setAnalysis(result)
          setLastUpdate(Date.now())
        }, 1000)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [kalshiRound])

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (analysis && kalshiRound) {
        refreshAnalysis()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [analysis, kalshiRound])
  
  // Update countdown based on shared expirySeconds
  useEffect(() => {
    if (expirySeconds !== undefined && kalshiRound) {
      const updatedRound = { ...kalshiRound, timeRemaining: expirySeconds * 1000 }
      setKalshiRound(updatedRound)
      setCountdown(KalshiIntegration.formatTimeRemaining(expirySeconds * 1000))
    }
  }, [expirySeconds])

  const refreshAnalysis = useCallback(async () => {
    if (!kalshiRound) return

    setIsAnalyzing(true)
    try {
      // Only refresh if we have a real price from context
      if (!currentPrice) return

      const price = currentPrice
      const volume = 20_000_000_000 + (Math.random() - 0.5) * 10_000_000_000
      const currentBTCData: BTCMarketData = {
        price,
        volume,
        marketCap: price * 19_500_000,
        dominance: 52 + (Math.random() - 0.5) * 4,
        fearGreedIndex: 30 + Math.random() * 40,
        timestamp: Date.now(),
        exchangeFlow: {
          inflow: Math.random() * 1_000,
          outflow: Math.random() * 1_000,
          netFlow: (Math.random() - 0.5) * 1_000,
        },
        onChainMetrics: {
          activeAddresses: 800_000 + Math.floor(Math.random() * 200_000),
          transactionCount: 250_000 + Math.floor(Math.random() * 50_000),
          hashRate: 4e14 + Math.floor(Math.random() * 1e14),
          difficulty: 7.2e13 + Math.floor(Math.random() * 1e12),
        },
        derivativesData: {
          openInterest: 15_000_000_000 + Math.floor(Math.random() * 5_000_000_000),
          fundingRate: (Math.random() - 0.5) * 0.02,
          longShortRatio: 1.2 + (Math.random() - 0.5) * 0.4,
          liquidations: {
            long: Math.floor(Math.random() * 100_000_000),
            short: Math.floor(Math.random() * 100_000_000),
          },
        },
      }
      const updatedRound = { ...kalshiRound, targetPrice: price }
      setKalshiRound(updatedRound)
      
      const result = await BTCTrajectoryAnalyzer.analyzeBTCMarket(
        currentBTCData,
        updatedRound,
        BTCDataGenerator.generateHistoricalData(100)
      )
      
      setAnalysis(result)
      setLastUpdate(Date.now())
    } catch (error) {
      console.error("Analysis failed:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [targetPrice, kalshiRound, currentPrice])

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'ABOVE': return 'text-green-400 bg-green-500/10 border-green-500/30'
      case 'BELOW': return 'text-red-400 bg-red-500/10 border-red-500/30'
      default: return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case 'STRONG_BULLISH': return 'text-green-500'
      case 'BULLISH': return 'text-green-400'
      case 'NEUTRAL': return 'text-gray-400'
      case 'BEARISH': return 'text-red-400'
      case 'STRONG_BEARISH': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!analysis || !kalshiRound) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-3">
            <Brain className="h-6 w-6 animate-pulse text-blue-400" />
            <span className="text-white/70">Initializing BTC trajectory analysis...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with BTC branding and Kalshi integration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Bitcoin className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">BTC Trajectory Analysis</h1>
            <p className="text-white/60 text-sm">Kalshi 15-minute prediction engine</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-white/60 text-xs">Last Update</div>
            <div className="text-white text-sm">
              {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAnalysis}
            disabled={isAnalyzing}
            className="text-white border-white/20 hover:bg-white/10"
          >
            <RefreshCw className={cn("h-4 w-4", isAnalyzing && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      {/* Live BTC Chart - Moved to Top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <LiveBTCChart />
      </motion.div>

      {/* BTC Price Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <BTCPriceDisplay />
      </motion.div>

      {/* Kalshi Round Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                Kalshi Round Configuration
              </div>
              <Badge 
                variant={kalshiRound.isActive ? "default" : "destructive"}
                className={cn(
                  "px-3 py-1 text-xs",
                  kalshiRound.isActive 
                    ? "bg-green-500/20 text-green-400 border-green-500/30" 
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                )}
              >
                {kalshiRound.isActive ? "ACTIVE" : "EXPIRED"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">
                  Target Price (USD)
                </label>
                <div className="relative">
                  <Bitcoin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-orange-400" />
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="pl-10 bg-white/5 border-white/20 text-white placeholder-white/40 rounded-lg px-4 py-2 w-full"
                    placeholder="65000"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">
                  Time Remaining
                </label>
                <div className="flex items-center space-x-2">
                  <Timer className="h-4 w-4 text-blue-400" />
                  <span className={cn(
                    "text-2xl font-bold font-mono",
                    kalshiRound.timeRemaining < 300 ? "text-red-400" : "text-white"
                  )}>
                    {KalshiIntegration.formatTimeRemaining(kalshiRound.timeRemaining)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">
                  Current BTC Price
                </label>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <span className="text-2xl font-bold text-white">
                    ${formatNumber(analysis.currentMarket.price)}
                  </span>
                </div>
              </div>
            </div>
            
            {kalshiRound.isActive && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-white/60 mb-2">
                  <span>Round Progress</span>
                  <span>{Math.round((1 - kalshiRound.timeRemaining / (15 * 60 * 1000)) * 100)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000"
                    style={{ width: `${(1 - kalshiRound.timeRemaining / (15 * 60 * 1000)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Prediction Result */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              AI Trajectory Prediction
              <Badge className={cn(
                "px-2 py-1 text-xs",
                getPredictionColor(analysis.trajectoryPrediction.prediction)
              )}>
                {analysis.trajectoryPrediction.prediction}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Prediction Display */}
            <div className={cn(
              "p-6 rounded-lg border-2 text-center",
              getPredictionColor(analysis.trajectoryPrediction.prediction)
            )}>
              <div className="text-4xl font-bold mb-2">
                {analysis.trajectoryPrediction.prediction === 'ABOVE' ? (
                  <div className="flex items-center justify-center space-x-2">
                    <ArrowUpRight className="h-8 w-8" />
                    <span>ABOVE</span>
                  </div>
                ) : analysis.trajectoryPrediction.prediction === 'BELOW' ? (
                  <div className="flex items-center justify-center space-x-2">
                    <ArrowDownRight className="h-8 w-8" />
                    <span>BELOW</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Activity className="h-8 w-8" />
                    <span>UNCERTAIN</span>
                  </div>
                )}
              </div>
              <div className="text-lg mb-4">
                Target: ${formatNumber(kalshiRound.targetPrice)}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Confidence</span>
                  <span className={cn("text-2xl font-bold", getConfidenceColor(analysis.trajectoryPrediction.confidence))}>
                    {formatNumber(analysis.trajectoryPrediction.confidence, 1)}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-lg h-3">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${analysis.trajectoryPrediction.confidence}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Price Targets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/60 text-sm mb-1">Conservative</div>
                <div className="text-white font-semibold">
                  ${formatNumber(analysis.trajectoryPrediction.priceTargets.conservative)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="text-white/60 text-sm mb-1">Realistic</div>
                <div className="text-blue-400 font-semibold">
                  ${formatNumber(analysis.trajectoryPrediction.priceTargets.realistic)}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/60 text-sm mb-1">Optimistic</div>
                <div className="text-white font-semibold">
                  ${formatNumber(analysis.trajectoryPrediction.priceTargets.optimistic)}
                </div>
              </div>
            </div>

            {/* Key Factors */}
            <div>
              <h4 className="text-white font-semibold mb-3">Key Analysis Factors</h4>
              <div className="space-y-2">
                {analysis.trajectoryPrediction.keyFactors.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        factor.impact === 'BULLISH' ? 'bg-green-400' : 'bg-red-400'
                      )} />
                      <span className="text-white">{factor.factor}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-xs",
                          factor.impact === 'BULLISH' 
                            ? "text-green-400 border-green-400/30" 
                            : "text-red-400 border-red-400/30"
                        )}
                      >
                        {factor.impact}
                      </Badge>
                      <span className="text-white/60 text-sm">{factor.weight}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enhanced AI Reasoning */}
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center space-x-2">
                <Info className="h-4 w-4" />
                Enhanced AI Reasoning
              </h4>
              <div className="space-y-2">
                {analysis.trajectoryPrediction.reasoning.map((reason, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 rounded-lg bg-white/5">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-white/80 text-sm">{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Betting Decision Guidance */}
            <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <h4 className="text-white font-semibold mb-3 flex items-center space-x-2">
                <Target className="h-4 w-4" />
                Recommended Action
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/10">
                  <div>
                    <div className="text-white/60 text-sm mb-1">Decision</div>
                    <div className={cn(
                      "text-xl font-bold",
                      analysis.trajectoryPrediction.confidence >= 75 ? "text-green-400" :
                      analysis.trajectoryPrediction.confidence >= 50 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {analysis.trajectoryPrediction.prediction}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/60 text-sm mb-1">Risk Level</div>
                    <div className={cn(
                      "text-lg font-semibold",
                      analysis.trajectoryPrediction.confidence >= 75 ? "text-green-400" :
                      analysis.trajectoryPrediction.confidence >= 50 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {analysis.trajectoryPrediction.confidence >= 75 ? "LOW" :
                       analysis.trajectoryPrediction.confidence >= 50 ? "MEDIUM" : "HIGH"}
                    </div>
                  </div>
                </div>
                
                <div className="text-white/80 text-sm">
                  {analysis.trajectoryPrediction.confidence >= 75 && (
                    <span>✅ Strong confidence ({formatNumber(analysis.trajectoryPrediction.confidence, 1)}%). AI is highly certain about this prediction. Consider this a reliable signal for your trading decision.</span>
                  )}
                  {analysis.trajectoryPrediction.confidence >= 50 && analysis.trajectoryPrediction.confidence < 75 && (
                    <span>⚠️ Moderate confidence ({formatNumber(analysis.trajectoryPrediction.confidence, 1)}%). AI shows reasonable certainty but recommends additional confirmation before making large trades.</span>
                  )}
                  {analysis.trajectoryPrediction.confidence < 50 && (
                    <span>❌ Low confidence ({formatNumber(analysis.trajectoryPrediction.confidence, 1)}%). AI indicates high uncertainty. Consider waiting for more data or reducing position size.</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Advanced Market Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                Advanced Market Analysis
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-white"
              >
                {showAdvanced ? "Hide Advanced" : "Show Advanced"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Market Signals */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/60 text-sm mb-2">Momentum</div>
                <div className={cn("text-lg font-semibold", getMomentumColor(analysis.marketSignals.momentum))}>
                  {analysis.marketSignals.momentum.replace('_', ' ')}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/60 text-sm mb-2">Trend</div>
                <div className="text-white font-semibold">
                  {analysis.marketSignals.trend}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/60 text-sm mb-2">Volatility</div>
                <div className="text-white font-semibold">
                  {analysis.marketSignals.volatility}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/60 text-sm mb-2">Liquidity</div>
                <div className="text-white font-semibold">
                  {analysis.marketSignals.liquidity}
                </div>
              </div>
            </div>

            {/* Technical Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-semibold mb-3">Technical Indicators</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">RSI (14)</span>
                    <span className={cn(
                      "font-semibold",
                      analysis.technicalIndicators.rsi > 70 ? "text-red-400" :
                      analysis.technicalIndicators.rsi > 30 ? "text-white" : "text-green-400"
                    )}>
                      {formatNumber(analysis.technicalIndicators.rsi, 1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">MACD</span>
                    <span className={cn(
                      "font-semibold",
                      analysis.technicalIndicators.macd.macd > analysis.technicalIndicators.macd.signal ? "text-green-400" : "text-red-400"
                    )}>
                      {formatNumber(analysis.technicalIndicators.macd.macd, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">VWAP</span>
                    <span className="text-white font-semibold">
                      ${formatNumber(analysis.technicalIndicators.volumeProfile.vwap)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3">Risk Assessment</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Volatility Risk</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      analysis.trajectoryPrediction.riskAssessment.volatility === 'EXTREME' ? "text-red-400 border-red-400/30" :
                      analysis.trajectoryPrediction.riskAssessment.volatility === 'HIGH' ? "text-orange-400 border-orange-400/30" :
                      analysis.trajectoryPrediction.riskAssessment.volatility === 'MEDIUM' ? "text-yellow-400 border-yellow-400/30" :
                      "text-green-400 border-green-400/30"
                    )}>
                      {analysis.trajectoryPrediction.riskAssessment.volatility}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Liquidity</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      analysis.trajectoryPrediction.riskAssessment.liquidity === 'HIGH' ? "text-green-400 border-green-400/30" :
                      analysis.trajectoryPrediction.riskAssessment.liquidity === 'MEDIUM' ? "text-yellow-400 border-yellow-400/30" :
                      "text-red-400 border-red-400/30"
                    )}>
                      {analysis.trajectoryPrediction.riskAssessment.liquidity}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Market Sentiment</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      analysis.trajectoryPrediction.riskAssessment.marketSentiment === 'BULLISH' ? "text-green-400 border-green-400/30" :
                      analysis.trajectoryPrediction.riskAssessment.marketSentiment === 'BEARISH' ? "text-red-400 border-red-400/30" :
                      "text-gray-400 border-gray-400/30"
                    )}>
                      {analysis.trajectoryPrediction.riskAssessment.marketSentiment}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Details */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 pt-6 border-t border-white/10"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-white font-semibold mb-3">BTC Market Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Market Cap</span>
                          <span className="text-white">
                            ${(analysis.currentMarket.marketCap / 1000000000).toFixed(1)}B
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Dominance</span>
                          <span className="text-white">
                            {formatNumber(analysis.currentMarket.dominance, 1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Fear & Greed</span>
                          <span className="text-white">
                            {formatNumber(analysis.currentMarket.fearGreedIndex)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-semibold mb-3">Derivatives Data</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Open Interest</span>
                          <span className="text-white">
                            ${(analysis.currentMarket.derivativesData.openInterest / 1000000000).toFixed(1)}B
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Funding Rate</span>
                          <span className={cn(
                            analysis.currentMarket.derivativesData.fundingRate > 0 ? "text-green-400" : "text-red-400"
                          )}>
                            {(analysis.currentMarket.derivativesData.fundingRate * 100).toFixed(3)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Long/Short Ratio</span>
                          <span className="text-white">
                            {formatNumber(analysis.currentMarket.derivativesData.longShortRatio, 2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Net Flow</span>
                          <span className={cn(
                            analysis.currentMarket.exchangeFlow.netFlow > 0 ? "text-green-400" : "text-red-400"
                          )}>
                            {formatNumber(analysis.currentMarket.exchangeFlow.netFlow, 1)} BTC
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
