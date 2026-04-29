"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  AlertTriangle,
  Brain,
  BarChart3,
  Zap
} from "lucide-react"
import { analyzeTrajectory, TrajectoryAnalysis, PatternRecognition } from "@/lib/trajectory-analysis"
import { cn, formatNumber, formatPercent } from "@/lib/utils"

interface TrajectoryAnalysisProps {
  prices: number[]
  volume: number[]
}

export function TrajectoryAnalysisComponent({ prices, volume }: TrajectoryAnalysisProps) {
  const [analysis, setAnalysis] = useState<TrajectoryAnalysis | null>(null)
  const [selectedPattern, setSelectedPattern] = useState<PatternRecognition | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (prices.length > 50) {
      const result = analyzeTrajectory(prices, volume)
      setAnalysis(result)
    }
  }, [prices, volume])

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'BULLISH': return 'text-green-400'
      case 'BEARISH': return 'text-red-400'
      case 'VOLATILE': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'DOUBLE_TOP': return '🔺'
      case 'DOUBLE_BOTTOM': return '🔻'
      case 'HEAD_SHOULDERS': return '👥'
      case 'TRIANGLE': return '📐'
      default: return '📊'
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'EXTREME_FEAR': return 'text-red-600 bg-red-50'
      case 'FEAR': return 'text-orange-600 bg-orange-50'
      case 'NEUTRAL': return 'text-gray-600 bg-gray-50'
      case 'GREED': return 'text-green-600 bg-green-50'
      case 'EXTREME_GREED': return 'text-green-700 bg-green-100'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (!analysis) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 animate-pulse text-blue-400" />
            <span className="text-white/70">Analyzing trajectory patterns...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Market Sentiment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              Market Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "px-4 py-2 rounded-lg font-semibold text-center",
              getSentimentColor(analysis.marketSentiment)
            )}>
              <div className="text-2xl mb-1">
                {analysis.marketSentiment.replace('_', ' ')}
              </div>
              <div className="text-sm opacity-70">
                Fear & Greed Index
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pattern Recognition */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Target className="h-4 w-4" />
              Pattern Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.patterns.length > 0 ? (
              <div className="space-y-3">
                {analysis.patterns.map((pattern, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all",
                      selectedPattern === pattern 
                        ? "bg-blue-500/20 border-blue-400" 
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getPatternIcon(pattern.type)}</span>
                        <div>
                          <div className="text-white font-semibold">
                            {pattern.type.replace('_', ' ')}
                          </div>
                          <div className="text-white/60 text-sm">
                            {pattern.timeframe} • {formatNumber(pattern.strength, 0)}% confidence
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-semibold",
                        pattern.strength > 80 ? "bg-green-500/20 text-green-400" :
                        pattern.strength > 60 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      )}>
                        {pattern.strength > 80 ? "STRONG" :
                         pattern.strength > 60 ? "MODERATE" : "WEAK"}
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {selectedPattern === pattern && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-3 pt-3 border-t border-white/10"
                        >
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-white/60">Entry</div>
                              <div className="text-white font-semibold">
                                ${formatNumber(pattern.targets.entry)}
                              </div>
                            </div>
                            <div>
                              <div className="text-white/60">Stop Loss</div>
                              <div className="text-red-400 font-semibold">
                                ${formatNumber(pattern.targets.stopLoss)}
                              </div>
                            </div>
                            <div>
                              <div className="text-white/60">Take Profit</div>
                              <div className="text-green-400 font-semibold space-y-1">
                                {pattern.targets.takeProfit.map((tp, i) => (
                                  <div key={i}>${formatNumber(tp)}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center text-white/60 py-8">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div>No patterns detected</div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Predictions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              Price Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {analysis.predictions.slice(0, 8).map((prediction, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="text-center space-y-2">
                    <div className={cn(
                      "text-xs font-semibold px-2 py-1 rounded",
                      getPredictionColor(prediction.prediction)
                    )}>
                      {prediction.prediction}
                    </div>
                    <div className="text-white font-semibold">
                      ${formatNumber(prediction.price)}
                    </div>
                    <div className="text-white/60 text-xs">
                      {formatPercent(prediction.confidence)} confidence
                    </div>
                    <div className="text-white/40 text-xs">
                      +{index}h
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Risk Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                Risk Metrics
              </div>
              <Button
                variant="glass"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-white"
              >
                {showAdvanced ? "Hide" : "Show"} Advanced
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-white/60 text-sm">Win Rate</div>
                <div className={cn(
                  "text-xl font-bold",
                  analysis.riskMetrics.winRate > 60 ? "text-green-400" :
                  analysis.riskMetrics.winRate > 40 ? "text-yellow-400" : "text-red-400"
                )}>
                  {formatNumber(analysis.riskMetrics.winRate, 1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/60 text-sm">Sharpe Ratio</div>
                <div className={cn(
                  "text-xl font-bold",
                  analysis.riskMetrics.sharpeRatio > 2 ? "text-green-400" :
                  analysis.riskMetrics.sharpeRatio > 1 ? "text-yellow-400" : "text-red-400"
                )}>
                  {formatNumber(analysis.riskMetrics.sharpeRatio, 2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/60 text-sm">Max Drawdown</div>
                <div className="text-xl font-bold text-red-400">
                  {formatPercent(analysis.riskMetrics.maxDrawdown)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/60 text-sm">Profit Factor</div>
                <div className={cn(
                  "text-xl font-bold",
                  analysis.riskMetrics.profitFactor > 2 ? "text-green-400" :
                  analysis.riskMetrics.profitFactor > 1.5 ? "text-yellow-400" : "text-red-400"
                )}>
                  {formatNumber(analysis.riskMetrics.profitFactor, 2)}
                </div>
              </div>
            </div>

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
                    <div className="space-y-4">
                      <div>
                        <div className="text-white/60 text-sm">Kelly Criterion</div>
                        <div className="text-white font-semibold">
                          {formatNumber(analysis.riskMetrics.kellyCriterion, 4)}
                        </div>
                        <div className="text-white/40 text-xs">
                          Optimal position size
                        </div>
                      </div>
                      <div>
                        <div className="text-white/60 text-sm">Position Size</div>
                        <div className="text-white font-semibold">
                          {formatPercent(analysis.riskMetrics.positionSize)}
                        </div>
                        <div className="text-white/40 text-xs">
                          Recommended allocation
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

      {/* Volatility Forecast */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              Volatility Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/60">Current Volatility</span>
                  <span className="text-white font-semibold">
                    {formatPercent(analysis.volatilityForecast.current)}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, analysis.volatilityForecast.current * 1000)}%` }}
                    transition={{ duration: 1, delay: 0.6 }}
                  />
                </div>
              </div>
              
              <div>
                <div className="text-white/60 text-sm mb-3">Projected Volatility</div>
                <div className="space-y-2">
                  {analysis.volatilityForecast.projected.slice(0, 4).map((vol, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">
                        {analysis.volatilityForecast.timeframe[index]}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-semibold text-sm">
                          {formatPercent(vol)}
                        </span>
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, vol * 1000)}%` }}
                            transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
