"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  Zap, 
  AlertTriangle,
  Settings,
  Maximize2,
  Volume2,
  Eye,
  EyeOff,
  Shield,
  DollarSign,
  Target,
  Smartphone,
  Monitor,
  History,
} from "lucide-react"
import { Sparkline } from "@/components/sparkline"
import { RsiGauge } from "@/components/rsi-gauge"
import { BTCKalshiAnalysis } from "./btc-kalshi-analysis"
import { cn, formatNumber, formatPercent, formatCurrency } from "@/lib/utils"
import { RiskManager, type RiskMetrics } from "@/lib/risk-management"
import { Badge } from "@/components/ui/badge"
import { UltimateAIPredictor, type UltimatePredictionResult } from "@/lib/ultimate-ai-prediction"
import { KalshiTradingAdvisor, type TradeOpportunity, type AccountState, type KalshiMarketData } from "@/lib/kalshi-trading-advisor"

interface TradeHistory {
  id: string
  timestamp: number
  contractType: 'ABOVE' | 'BELOW'
  strikePrice: number
  entryPrice: number
  positionSize: number
  result: 'PENDING' | 'WIN' | 'LOSS'
  profitLoss: number
  exitPrice?: number
  exitTime?: number
  predictedProbability: number
  kalshiImpliedProbability: number
  edgePercentage: number
}

interface TradingData {
  price: number
  change: number
  changePercent: number
  volume: number
  high24h: number
  low24h: number
  marketCap: number
  closes: number[]
  indicators: {
    rsi: number | null
    macd: { macd: number; signal: number; histogram: number } | null
    bollinger: { upper: number; middle: number; lower: number; pctB: number } | null
    momentum: number | null
    regime: string | null
  }
  priceHistory: number[]
}

export function TradingDashboard() {
  const [data, setData] = useState<TradingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [riskAlerts, setRiskAlerts] = useState<string[]>([])
  const [accountBalance, setAccountBalance] = useState(100000)
  const [showRiskPanel, setShowRiskPanel] = useState(true)
  const [advancedPrediction, setAdvancedPrediction] = useState<UltimatePredictionResult | null>(null)
  const [showAdvancedAI, setShowAdvancedAI] = useState(true)
  const [kalshiTradeOpportunity, setKalshiTradeOpportunity] = useState<TradeOpportunity | null>(null)
  const [showKalshiAdvisor, setShowKalshiAdvisor] = useState(true)
  const [viewMode, setViewMode] = useState<'phone' | 'computer'>('computer')
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([])
  const [showTradeHistory, setShowTradeHistory] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [kalshiAccountState, setKalshiAccountState] = useState<AccountState>({
    balance: 100000,
    initialBalance: 100000,
    dailyPnL: 0,
    rolling30TradePnL: 0,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    totalTrades: 0,
    winRate: 0,
    averageWin: 0,
    averageLoss: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    currentDrawdown: 0
  })

  // Fetch real-time data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const btcResponse = await fetch('/api/btc')
        if (!btcResponse.ok) throw new Error('Failed to fetch BTC data')
        const btcData = await btcResponse.json()

        if (!btcData.price || isNaN(btcData.price)) {
          throw new Error('Invalid price data received')
        }

        const closes = btcData.closes && Array.isArray(btcData.closes) && btcData.closes.length > 20
          ? btcData.closes
          : Array.from({ length: 100 }, (_, i) => 
              btcData.price * (1 + (Math.random() - 0.5) * 0.02)
            )

        const priceHistory = closes.slice(-50)
        const previousPrice = priceHistory[priceHistory.length - 2] || btcData.price
        const change = btcData.price - previousPrice
        const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0

        const rsi = calculateRSI(closes)
        const macd = calculateMACD(closes)
        const bollinger = calculateBollingerBands(closes)
        const momentum = calculateMomentum(closes)
        const regime = detectRegime(closes, btcData.change24h)

        const tradingData: TradingData = {
          price: btcData.price,
          change,
          changePercent,
          volume: btcData.volume24h || 0,
          high24h: btcData.high24h || btcData.price,
          low24h: btcData.low24h || btcData.price,
          marketCap: btcData.price * 19000000,
          closes,
          indicators: {
            rsi,
            macd: macd || { macd: 0, signal: 0, histogram: 0 },
            bollinger: bollinger || { upper: btcData.price * 1.02, middle: btcData.price, lower: btcData.price * 0.98, pctB: 0.5 },
            momentum,
            regime
          },
          priceHistory
        }

        setData(tradingData)
        setLoading(false)
        setError(null)

        if (closes.length > 20) {
          try {
            const riskConfig = {
              accountBalance,
              maxRiskPerTrade: 0.02,
              maxDrawdownLimit: 15,
              atrMultiplier: 2,
              riskRewardRatio: 2
            }
            const metrics = RiskManager.calculateRiskMetrics(
              closes,
              riskConfig,
              btcData.price,
              btcData.volume24h || 0,
              btcData.price * 19000000
            )
            setRiskMetrics(metrics)
            setRiskAlerts(RiskManager.generateRiskAlerts(metrics))

            // Ultimate AI Prediction
            try {
              const marketData = closes.map((price: number, i: number) => ({
                price,
                volume: btcData.volume24h || 1000000,
                high: price * 1.001,
                low: price * 0.999,
                close: price,
                timestamp: Date.now() - (closes.length - i) * 60000,
                orderBook: {
                  bids: [{ price: price * 0.9999, amount: 1000 }],
                  asks: [{ price: price * 1.0001, amount: 1000 }]
                },
                fundingRate: btcData.fundingRate || 0,
                openInterest: btcData.openInterest || 0,
                liquidations: { long: 0, short: 0 },
                fearGreed: btcData.fearGreed?.value || 50,
                marketCap: btcData.price * 19000000,
                socialVolume: 1000000,
                whaleActivity: 0
              }))

              const targetPrice = btcData.price * (btcData.price > 75000 ? 1.002 : 0.998)
              const timeToExpiry = 900 // 15 minutes

              const prediction = await UltimateAIPredictor.predict(
                marketData,
                targetPrice,
                timeToExpiry,
                accountBalance
              )
              setAdvancedPrediction(prediction)

              // Kalshi Trading Advisor Analysis
              try {
                // Simulated Kalshi market data (in production, this would come from Kalshi API)
                const kalshiMarket: KalshiMarketData = {
                  bidPrice: 0.48,
                  askPrice: 0.52,
                  marketPrice: 0.50,
                  impliedProbability: 0.50,
                  contractType: prediction.prediction === 'ABOVE' ? 'ABOVE' : 'BELOW',
                  strikePrice: targetPrice,
                  expiryTime: Date.now() + timeToExpiry * 1000,
                  currentBTCPrice: btcData.price
                }

                // Calculate current volatility (ATR-based)
                const atr = riskMetrics?.atr || btcData.price * 0.02
                const currentVolatility = atr / btcData.price
                const historicalVolatility = 0.02 // 2% historical volatility

                const tradeOpportunity = KalshiTradingAdvisor.analyzeTrade(
                  prediction.accuracyEstimate, // Use accuracy estimate as predicted probability
                  kalshiMarket,
                  kalshiAccountState,
                  currentVolatility,
                  historicalVolatility
                )
                setKalshiTradeOpportunity(tradeOpportunity)
              } catch (kalshiError) {
                console.warn('Kalshi advisor error:', kalshiError)
              }
            } catch (aiError) {
              console.warn('Ultimate AI prediction error:', aiError)
            }
          } catch (riskError) {
            console.warn('Risk calculation error:', riskError)
            setRiskAlerts(['Risk metrics temporarily unavailable'])
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trading data'
        setError(errorMessage)
        setLoading(false)
        console.error('Data fetch error:', err)
      }
    }

    // Initial fetch
    fetchData()

    // WebSocket connection for real-time updates
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade')
    
    ws.onopen = () => {
      setWsConnected(true)
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.p) { // price
        setData(prev => {
          if (!prev) return prev
          const newPrice = message.p
          const newChange = newPrice - prev.closes[prev.closes.length - 2]
          const newChangePercent = (newChange / prev.closes[prev.closes.length - 2]) * 100
          
          // Update closes array with new price
          const newCloses = [...prev.closes.slice(1), newPrice]
          const newPriceHistory = newCloses.slice(-50)
          
          // Recalculate indicators
          const rsi = calculateRSI(newCloses)
          const macd = calculateMACD(newCloses)
          const bollinger = calculateBollingerBands(newCloses)
          const momentum = calculateMomentum(newCloses)
          const regime = detectRegime(newCloses, newChangePercent)

          return {
            ...prev,
            price: newPrice,
            change: newChange,
            changePercent: newChangePercent,
            closes: newCloses,
            priceHistory: newPriceHistory,
            indicators: {
              rsi,
              macd: macd || { macd: 0, signal: 0, histogram: 0 },
              bollinger: bollinger || { upper: newPrice * 1.02, middle: newPrice, lower: newPrice * 0.98, pctB: 0.5 },
              momentum,
              regime
            },
            high24h: Math.max(prev.high24h, newPrice),
            low24h: Math.min(prev.low24h, newPrice)
          }
        })
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsConnected(false)
    }

    ws.onclose = () => {
      setWsConnected(false)
      console.log('WebSocket disconnected')
      // Reconnect after 5 seconds
      setTimeout(() => {
        fetchData()
      }, 5000)
    }

    return () => {
      ws.close()
    }
  }, [accountBalance])

  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50
    let gains = 0, losses = 0
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1]
      if (change >= 0) gains += change
      else losses -= change
    }
    const avgGain = gains / period
    const avgLoss = losses / period
    const rs = avgGain / (avgLoss || 1)
    return 100 - (100 / (1 + rs))
  }

  const calculateEMA = (prices: number[], period: number): number => {
    if (prices.length === 0) return 0
    const multiplier = 2 / (period + 1)
    let ema = prices[0]
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema
    }
    return ema
  }

  const calculateMACD = (prices: number[]) => {
    const ema12 = calculateEMA(prices, 12)
    const ema26 = calculateEMA(prices, 26)
    const macd = ema12 - ema26
    const signal = calculateEMA([macd], 9)
    const histogram = macd - signal
    return { macd, signal, histogram }
  }

  const calculateBollingerBands = (prices: number[], period: number = 20, stdDev: number = 2) => {
    if (prices.length < period) {
      const price = prices[prices.length - 1]
      return { upper: price * 1.02, middle: price, lower: price * 0.98, pctB: 0.5 }
    }
    const recent = prices.slice(-period)
    const middle = recent.reduce((sum, p) => sum + p, 0) / period
    const variance = recent.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period
    const standardDeviation = Math.sqrt(variance)
    const upper = middle + (standardDeviation * stdDev)
    const lower = middle - (standardDeviation * stdDev)
    const pctB = (prices[prices.length - 1] - lower) / (upper - lower)
    return { upper, middle, lower, pctB }
  }

  const executeTrade = (opportunity: TradeOpportunity) => {
    if (!opportunity.shouldTrade) return

    const newTrade: TradeHistory = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      contractType: opportunity.contractType,
      strikePrice: opportunity.strikePrice,
      entryPrice: opportunity.positionSizeDollars,
      positionSize: opportunity.positionSizePercent,
      result: 'PENDING',
      profitLoss: 0,
      predictedProbability: opportunity.predictedProbability,
      kalshiImpliedProbability: opportunity.kalshiImpliedProbability,
      edgePercentage: opportunity.edgePercentage
    }

    setTradeHistory(prev => [newTrade, ...prev])

    // Update account state
    setKalshiAccountState(prev => ({
      ...prev,
      balance: prev.balance - opportunity.positionSizeDollars,
      totalTrades: prev.totalTrades + 1
    }))

    // Simulate trade result after 15 minutes (in production, this would be determined by actual market outcome)
    setTimeout(() => {
      const isWin = Math.random() < opportunity.predictedProbability
      const profitLoss = isWin ? opportunity.maxProfitDollars : -opportunity.maxLossDollars

      setTradeHistory(prev => prev.map(trade => 
        trade.id === newTrade.id 
          ? { 
              ...trade, 
              result: isWin ? 'WIN' : 'LOSS',
              profitLoss,
              exitPrice: opportunity.positionSizeDollars + profitLoss,
              exitTime: Date.now()
            }
          : trade
      ))

      setKalshiAccountState(prev => {
        const updated = KalshiTradingAdvisor.updateAccountState(
          prev,
          isWin ? 'WIN' : 'LOSS',
          profitLoss
        )
        return updated
      })
    }, 15 * 60 * 1000) // 15 minutes
  }

  const calculateMomentum = (prices: number[]): number => {
    if (prices.length < 2) return 50
    const rsi = calculateRSI(prices)
    const change = prices[prices.length - 1] - prices[prices.length - 2]
    const momentum = 50 + (change / prices[prices.length - 2]) * 1000
    return Math.max(0, Math.min(100, (rsi + momentum) / 2))
  }

  const detectRegime = (prices: number[], change24h: number | null): string => {
    const volatility = calculateBollingerBands(prices)
    const bbWidth = (volatility.upper - volatility.lower) / volatility.middle
    const recentChange = prices[prices.length - 1] - prices[prices.length - 10]
    
    if (bbWidth < 0.01) return "SQUEEZE"
    if (bbWidth > 0.05) return "VOLATILE"
    if (change24h && Math.abs(change24h) > 5) return "VOLATILE"
    if (recentChange > 0) return "TRENDING UP"
    if (recentChange < 0) return "TRENDING DOWN"
    return "RANGING"
  }

  const playAlert = (frequency: number) => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.1)
    } catch (e) {
      // Ignore audio errors
    }
  }

  const getRegimeColor = (regime: string | null) => {
    switch (regime) {
      case "TRENDING UP": return "text-green-400"
      case "TRENDING DOWN": return "text-red-400"
      case "VOLATILE": return "text-yellow-400"
      case "SQUEEZE": return "text-purple-400"
      default: return "text-gray-400"
    }
  }

  const getMomentumColor = (momentum: number | null) => {
    if (!momentum) return "text-gray-400"
    if (momentum > 70) return "text-green-400"
    if (momentum < 30) return "text-red-400"
    return "text-yellow-400"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded-lg w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white/10 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span>{error || "No data available"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 transition-all duration-300",
        isFullscreen && "p-0"
      )}
      role="application"
      aria-label="Trading Dashboard Application"
    >
      <div className={cn(
        "mx-auto space-y-6 transition-all duration-300",
        viewMode === 'phone' ? "max-w-md" : "max-w-7xl"
      )}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold text-white mb-2">Elite Trading Dashboard</h1>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  wsConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                )} />
                <span className="text-white/60 text-sm">
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            <p className="text-white/60">Real-time market analysis and indicators</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="glass"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-white"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <Volume2 className="h-4 w-4 opacity-50" />}
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setShowRiskPanel(!showRiskPanel)}
              className={cn("text-white", showRiskPanel && "bg-blue-500/20")}
            >
              <Shield className="h-4 w-4" />
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setShowAdvancedAI(!showAdvancedAI)}
              className={cn("text-white", showAdvancedAI && "bg-purple-500/20")}
              title="Advanced AI Prediction"
            >
              <Zap className="h-4 w-4" />
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setShowKalshiAdvisor(!showKalshiAdvisor)}
              className={cn("text-white", showKalshiAdvisor && "bg-green-500/20")}
              title="Kalshi Trading Advisor"
            >
              <Target className="h-4 w-4" />
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setViewMode(viewMode === 'phone' ? 'computer' : 'phone')}
              className={cn("text-white", viewMode === 'phone' ? "bg-cyan-500/20" : "bg-cyan-500/20")}
              title={viewMode === 'phone' ? 'Switch to Computer View' : 'Switch to Phone View'}
            >
              {viewMode === 'phone' ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setShowTradeHistory(!showTradeHistory)}
              className={cn("text-white", showTradeHistory && "bg-purple-500/20")}
              title="Trade History"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-white"
            >
              {showAdvanced ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-white"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Indicators Grid */}
        <div className={cn(
          "grid gap-4",
          viewMode === 'phone' ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        )}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>RSI</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RsiGauge value={data.indicators.rsi} />
                <p className="text-center text-white/60 text-sm mt-2">
                  {data.indicators.rsi ? formatNumber(data.indicators.rsi, 1) : "--"}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center space-x-2">
                  <Zap className="h-4 w-4" />
                  <span>Momentum</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={cn(
                    "text-3xl font-bold",
                    getMomentumColor(data.indicators.momentum)
                  )}>
                    {data.indicators.momentum ? formatNumber(data.indicators.momentum, 0) : "--"}
                  </div>
                  <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${data.indicators.momentum || 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Price Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-blue-500/30 backdrop-blur-sm">
            <CardHeader>
              <div className={cn(
                "flex items-center justify-between",
                viewMode === 'phone' ? "flex-col gap-2" : ""
              )}>
                <div>
                  <CardTitle className={cn(
                    "text-white",
                    viewMode === 'phone' ? "text-xl" : "text-2xl"
                  )}>BTC/USD</CardTitle>
                  <CardDescription className="text-white/60">Bitcoin Price</CardDescription>
                </div>
                <div className={cn(
                  "text-right",
                  viewMode === 'phone' ? "text-center w-full" : ""
                )}>
                  <div className={cn(
                    "font-bold text-white",
                    viewMode === 'phone' ? "text-3xl" : "text-4xl"
                  )}>
                    ${formatNumber(data.price, 0)}
                  </div>
                  <div className={cn(
                    "font-semibold",
                    data.change >= 0 ? "text-green-400" : "text-red-400",
                    viewMode === 'phone' ? "text-base" : "text-lg"
                  )}>
                    {data.change >= 0 ? "+" : ""}{formatNumber(data.change, 2)}
                    <span className="text-sm ml-1">
                      ({data.changePercent >= 0 ? "+" : ""}{formatNumber(data.changePercent, 2)}%)
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "",
                viewMode === 'phone' ? "h-32" : "h-48"
              )}>
                <Sparkline prices={data.priceHistory} color={data.change >= 0 ? "#10b981" : "#ef4444"} />
              </div>
              <div className={cn(
                "grid gap-4 mt-4",
                viewMode === 'phone' ? "grid-cols-1" : "grid-cols-3"
              )}>
                <div className="text-center">
                  <p className="text-white/60 text-sm">24h High</p>
                  <p className="text-white font-semibold">${formatNumber(data.high24h, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/60 text-sm">24h Low</p>
                  <p className="text-white font-semibold">${formatNumber(data.low24h, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/60 text-sm">Volume</p>
                  <p className="text-white font-semibold">{formatNumber(data.volume / 1e9, 2)}B</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Management Panel */}
        <AnimatePresence>
          {showRiskPanel && riskMetrics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4" />
                      <span>Risk Management Center</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "px-3 py-1 text-xs",
                        riskMetrics.riskLevel === 'EXTREME' ? "bg-red-500/20 text-red-400 border-red-500/30" :
                        riskMetrics.riskLevel === 'HIGH' ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                        riskMetrics.riskLevel === 'MEDIUM' ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                        "bg-green-500/20 text-green-400 border-green-500/30"
                      )}
                    >
                      {riskMetrics.riskLevel} RISK
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {riskAlerts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-white font-semibold flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Active Risk Alerts</span>
                      </h4>
                      <div className="space-y-2">
                        {riskAlerts.map((alert, index) => (
                          <div key={index} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                            {alert}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs mb-1">Volatility</div>
                      <div className={cn(
                        "text-lg font-bold",
                        riskMetrics.volatility > 4 ? "text-red-400" :
                        riskMetrics.volatility > 2 ? "text-yellow-400" : "text-green-400"
                      )}>
                        {riskMetrics.volatility.toFixed(2)}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs mb-1">ATR</div>
                      <div className="text-lg font-bold text-white">
                        ${formatNumber(riskMetrics.atr)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs mb-1">Max Drawdown</div>
                      <div className={cn(
                        "text-lg font-bold",
                        riskMetrics.maxDrawdown > 15 ? "text-red-400" :
                        riskMetrics.maxDrawdown > 10 ? "text-yellow-400" : "text-green-400"
                      )}>
                        {riskMetrics.maxDrawdown.toFixed(2)}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs mb-1">Current Drawdown</div>
                      <div className={cn(
                        "text-lg font-bold",
                        riskMetrics.currentDrawdown > 10 ? "text-red-400" :
                        riskMetrics.currentDrawdown > 5 ? "text-yellow-400" : "text-green-400"
                      )}>
                        {riskMetrics.currentDrawdown.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-sm mb-2 flex items-center space-x-2">
                        <DollarSign className="h-4 w-4" />
                        <span>Recommended Position Size</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-400">
                        ${formatNumber(riskMetrics.positionSize)}
                      </div>
                      <div className="text-white/40 text-xs mt-1">
                        Based on {((riskMetrics.positionSize / accountBalance) * 100).toFixed(1)}% of account
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-sm mb-2 flex items-center space-x-2">
                        <Target className="h-4 w-4" />
                        <span>Stop Loss (ATR-based)</span>
                      </div>
                      <div className="text-2xl font-bold text-red-400">
                        ${formatNumber(riskMetrics.stopLoss)}
                      </div>
                      <div className="text-white/40 text-xs mt-1">
                        {((riskMetrics.stopLoss / riskMetrics.currentPrice) * 100).toFixed(2)}% of current price
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-sm mb-2 flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Take Profit</span>
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        ${formatNumber(riskMetrics.takeProfit)}
                      </div>
                      <div className="text-white/40 text-xs mt-1">
                        R/R Ratio: {riskMetrics.riskRewardRatio.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs mb-1">Market Condition</div>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-xs",
                          riskMetrics.marketCondition === 'VOLATILE' ? "text-red-400 border-red-400/30" :
                          riskMetrics.marketCondition === 'TRENDING' ? "text-green-400 border-green-400/30" :
                          riskMetrics.marketCondition === 'ILLIQUID' ? "text-orange-400 border-orange-400/30" :
                          "text-gray-400 border-gray-400/30"
                        )}
                      >
                        {riskMetrics.marketCondition}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs mb-1">Liquidity Risk</div>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-xs",
                          riskMetrics.liquidityRisk === 'HIGH' ? "text-red-400 border-red-400/30" :
                          riskMetrics.liquidityRisk === 'MEDIUM' ? "text-yellow-400 border-yellow-400/30" :
                          "text-green-400 border-green-400/30"
                        )}
                      >
                        {riskMetrics.liquidityRisk}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 pt-4 border-t border-white/10">
                    <div className="flex-1">
                      <label className="text-white/60 text-sm block mb-2">
                        Account Balance (USD)
                      </label>
                      <input
                        type="number"
                        value={accountBalance}
                        onChange={(e) => setAccountBalance(Number(e.target.value))}
                        className="bg-white/5 border-white/20 text-white rounded-lg px-4 py-2 w-full"
                        placeholder="100000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kalshi Trading Advisor */}
        <AnimatePresence>
          {showKalshiAdvisor && kalshiTradeOpportunity && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <Card className={`glass-strong ${
                kalshiTradeOpportunity.shouldTrade 
                  ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/30' 
                  : 'bg-gradient-to-br from-red-900/40 to-rose-900/40 border-red-500/30'
              } backdrop-blur-sm`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Target className={`w-5 h-5 ${kalshiTradeOpportunity.shouldTrade ? 'text-green-400' : 'text-red-400'}`} />
                        Kalshi BTC Trading Advisor
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Statistically significant edge detection with disciplined risk management
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKalshiAdvisor(false)}
                      className="text-white/60 hover:text-white"
                    >
                      <EyeOff className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Trade Recommendation */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                    <div>
                      <p className="text-white/60 text-sm mb-1">Recommendation</p>
                      <Badge 
                        variant={kalshiTradeOpportunity.shouldTrade ? 'default' : 'destructive'}
                        className={`text-sm ${
                          kalshiTradeOpportunity.shouldTrade 
                            ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                            : 'bg-red-500/20 text-red-400 border-red-500/50'
                        }`}
                      >
                        {kalshiTradeOpportunity.recommendation}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-sm mb-1">Confidence</p>
                      <p className={`text-xl font-bold ${
                        kalshiTradeOpportunity.confidence === 'HIGH' ? 'text-green-400' :
                        kalshiTradeOpportunity.confidence === 'MEDIUM' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {kalshiTradeOpportunity.confidence}
                      </p>
                    </div>
                  </div>

                  {/* Edge Analysis */}
                  <div className={cn(
                    "grid gap-3",
                    viewMode === 'phone' ? "grid-cols-1" : "grid-cols-3"
                  )}>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-white/60 text-xs mb-1">Your Probability</p>
                      <p className="text-lg font-bold text-cyan-400">
                        {(kalshiTradeOpportunity.predictedProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-white/60 text-xs mb-1">Kalshi Implied</p>
                      <p className="text-lg font-bold text-purple-400">
                        {(kalshiTradeOpportunity.kalshiImpliedProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-white/60 text-xs mb-1">Edge</p>
                      <p className={`text-lg font-bold ${kalshiTradeOpportunity.edgePercentage > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {kalshiTradeOpportunity.edgePercentage > 0 ? '+' : ''}{(kalshiTradeOpportunity.edgePercentage * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Expected Value */}
                  <div className={cn(
                    "grid gap-3",
                    viewMode === 'phone' ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Expected Value</p>
                      <p className={`text-xl font-bold ${kalshiTradeOpportunity.expectedValue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {kalshiTradeOpportunity.expectedValue.toFixed(3)}
                      </p>
                      <p className="text-white/40 text-xs">per $1 invested</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Win Rate Required</p>
                      <p className="text-xl font-bold text-white">
                        {(kalshiTradeOpportunity.winRateRequired * 100).toFixed(1)}%
                      </p>
                      <p className="text-white/40 text-xs">after fees</p>
                    </div>
                  </div>

                  {/* Position Sizing */}
                  <div className={cn(
                    "grid gap-3",
                    viewMode === 'phone' ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Position Size</p>
                      <p className="text-xl font-bold text-cyan-400">
                        {(kalshiTradeOpportunity.positionSizePercent * 100).toFixed(2)}%
                      </p>
                      <p className="text-white/40 text-xs">${kalshiTradeOpportunity.positionSizeDollars.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Kelly Fraction</p>
                      <p className="text-xl font-bold text-purple-400">
                        {(kalshiTradeOpportunity.kellyFraction * 100).toFixed(1)}%
                      </p>
                      <p className="text-white/40 text-xs">vol adj: {(kalshiTradeOpportunity.volatilityAdjustment * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  {/* Risk Metrics */}
                  <div className={cn(
                    "grid gap-3",
                    viewMode === 'phone' ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Max Loss</p>
                      <p className="text-lg font-bold text-red-400">
                        ${kalshiTradeOpportunity.maxLossDollars.toFixed(2)}
                      </p>
                      <p className="text-white/40 text-xs">{(kalshiTradeOpportunity.maxLossPercent * 100).toFixed(2)}% of account</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Max Profit</p>
                      <p className="text-lg font-bold text-green-400">
                        ${kalshiTradeOpportunity.maxProfitDollars.toFixed(2)}
                      </p>
                      <p className="text-white/40 text-xs">even-money bet</p>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div>
                    <h4 className="text-white font-semibold mb-2">Analysis Reasoning</h4>
                    <div className="space-y-1">
                      {kalshiTradeOpportunity.reasoning.map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-white/70 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                          <p>{reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Warnings */}
                  {kalshiTradeOpportunity.riskWarnings.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Risk Warnings
                      </h4>
                      <div className="space-y-1">
                        {kalshiTradeOpportunity.riskWarnings.map((warning, idx) => (
                          <p key={idx} className="text-red-300/80 text-sm">
                            • {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execute Trade Button */}
                  {kalshiTradeOpportunity.shouldTrade && (
                    <Button
                      onClick={() => executeTrade(kalshiTradeOpportunity)}
                      className={cn(
                        "w-full",
                        kalshiTradeOpportunity.confidence === 'HIGH' 
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                          : kalshiTradeOpportunity.confidence === 'MEDIUM'
                          ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                      )}
                      size="lg"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Execute Trade
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trade History Panel */}
        <AnimatePresence>
          {showTradeHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <Card className="glass-strong bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500/30 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-purple-400" />
                        Trade History
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Track your Kalshi trades and performance
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white/60 text-xs">Total Trades</p>
                        <p className="text-white font-bold">{tradeHistory.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-xs">Win Rate</p>
                        <p className="text-white font-bold">
                          {tradeHistory.length > 0 
                            ? ((tradeHistory.filter(t => t.result === 'WIN').length / tradeHistory.filter(t => t.result !== 'PENDING').length) * 100).toFixed(0) 
                            : '0'}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tradeHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/60">No trades yet. Execute your first trade to see history.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {tradeHistory.map((trade) => (
                        <div
                          key={trade.id}
                          className={cn(
                            "p-4 rounded-lg border transition-all",
                            trade.result === 'WIN' ? "bg-green-500/10 border-green-500/30" :
                            trade.result === 'LOSS' ? "bg-red-500/10 border-red-500/30" :
                            "bg-white/5 border-white/10"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  trade.result === 'WIN' ? "bg-green-500/20 text-green-400 border-green-500/50" :
                                  trade.result === 'LOSS' ? "bg-red-500/20 text-red-400 border-red-500/50" :
                                  "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                                )}
                              >
                                {trade.result}
                              </Badge>
                              <span className="text-white font-semibold">{trade.contractType}</span>
                              <span className="text-white/60 text-sm">${formatNumber(trade.strikePrice, 0)}</span>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "font-bold",
                                trade.profitLoss > 0 ? "text-green-400" :
                                trade.profitLoss < 0 ? "text-red-400" :
                                "text-white/60"
                              )}>
                                {trade.profitLoss !== 0 ? (trade.profitLoss > 0 ? '+' : '') + formatCurrency(trade.profitLoss) : 'PENDING'}
                              </p>
                              <p className="text-white/40 text-xs">
                                {new Date(trade.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-white/40">Position</p>
                              <p className="text-white">{(trade.positionSize * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-white/40">Your Prob</p>
                              <p className="text-white">{(trade.predictedProbability * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-white/40">Kalshi Prob</p>
                              <p className="text-white">{(trade.kalshiImpliedProbability * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-white/40">Edge</p>
                              <p className={trade.edgePercentage > 0 ? "text-green-400" : "text-red-400"}>
                                {trade.edgePercentage > 0 ? '+' : ''}{(trade.edgePercentage * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced AI Prediction */}
        <AnimatePresence>
          {showAdvancedAI && advancedPrediction && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <Card className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500/30 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        Advanced AI Prediction Engine
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Machine learning powered prediction with ensemble models
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={advancedPrediction.prediction === 'ABOVE' ? 'default' : advancedPrediction.prediction === 'BELOW' ? 'destructive' : 'secondary'}
                      className="text-sm font-bold"
                    >
                      {advancedPrediction.prediction}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Confidence & Probability */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 text-center">
                      <p className="text-white/60 text-sm mb-1">Confidence</p>
                      <p className="text-2xl font-bold text-white">
                        {(advancedPrediction.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 text-center">
                      <p className="text-white/60 text-sm mb-1">Above Probability</p>
                      <p className="text-2xl font-bold text-green-400">
                        {(advancedPrediction.probabilityDistribution.above * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 text-center">
                      <p className="text-white/60 text-sm mb-1">Below Probability</p>
                      <p className="text-2xl font-bold text-red-400">
                        {(advancedPrediction.probabilityDistribution.below * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Model Scores */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Model Scores</h4>
                    <div className={cn(
                      "grid gap-2",
                      viewMode === 'phone' ? "grid-cols-2" : "grid-cols-4"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Technical</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.technical) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono">
                            {advancedPrediction.modelScores.technical.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Momentum</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.momentum) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono">
                            {advancedPrediction.modelScores.momentum.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Volume</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.volume) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono">
                            {advancedPrediction.modelScores.volume.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Sentiment</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-yellow-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.sentiment) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono">
                            {advancedPrediction.modelScores.sentiment.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Physics</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-cyan-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.physics) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono">
                            {advancedPrediction.modelScores.physics.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Meta Learner</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-pink-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.metaLearner) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono">
                            {advancedPrediction.modelScores.metaLearner.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm font-semibold">Ensemble</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                              style={{ width: `${Math.abs(advancedPrediction.modelScores.ensemble) * 100}%` }}
                            />
                          </div>
                          <span className="text-white text-sm font-mono font-bold">
                            {advancedPrediction.modelScores.ensemble.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Factors */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Key Factors</h4>
                    <div className="space-y-2">
                      {advancedPrediction.keyFactors.slice(0, 5).map((factor, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                          <span className="text-white/80 text-sm">{factor.factor}</span>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={factor.impact === 'BULLISH' ? 'default' : factor.impact === 'BEARISH' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {factor.impact}
                            </Badge>
                            <span className="text-white/60 text-xs font-mono">
                              {(factor.weight * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Risk Assessment</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Volatility</p>
                        <Badge 
                          variant={advancedPrediction.riskAssessment.volatility === 'LOW' ? 'default' : advancedPrediction.riskAssessment.volatility === 'MEDIUM' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {advancedPrediction.riskAssessment.volatility}
                        </Badge>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Liquidity</p>
                        <Badge 
                          variant={advancedPrediction.riskAssessment.liquidity === 'HIGH' ? 'default' : advancedPrediction.riskAssessment.liquidity === 'MEDIUM' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {advancedPrediction.riskAssessment.liquidity}
                        </Badge>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Sentiment</p>
                        <Badge 
                          variant={advancedPrediction.riskAssessment.marketSentiment === 'BULL' || advancedPrediction.riskAssessment.marketSentiment === 'EXTREME_BULL' ? 'default' : advancedPrediction.riskAssessment.marketSentiment === 'BEAR' || advancedPrediction.riskAssessment.marketSentiment === 'EXTREME_BEAR' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {advancedPrediction.riskAssessment.marketSentiment}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Price Targets */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Price Targets</h4>
                    <div className={cn(
                      "grid gap-2",
                      viewMode === 'phone' ? "grid-cols-1" : "grid-cols-5"
                    )}>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Ultra Cons</p>
                        <p className="text-white font-mono text-xs">
                          ${advancedPrediction.priceTargets.ultraConservative.toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Conservative</p>
                        <p className="text-white font-mono text-xs">
                          ${advancedPrediction.priceTargets.conservative.toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Realistic</p>
                        <p className="text-white font-mono text-xs font-bold">
                          ${advancedPrediction.priceTargets.realistic.toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Optimistic</p>
                        <p className="text-white font-mono text-xs">
                          ${advancedPrediction.priceTargets.optimistic.toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Ultra Opt</p>
                        <p className="text-white font-mono text-xs">
                          ${advancedPrediction.priceTargets.ultraOptimistic.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Metrics */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Advanced Metrics</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Accuracy</p>
                        <p className="text-lg font-bold text-green-400">
                          {(advancedPrediction.accuracyEstimate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Expected Value</p>
                        <p className="text-lg font-bold text-white">
                          ${advancedPrediction.expectedValue.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">R/R Ratio</p>
                        <p className="text-lg font-bold text-blue-400">
                          {advancedPrediction.riskRewardRatio.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Kelly %</p>
                        <p className="text-lg font-bold text-purple-400">
                          {(advancedPrediction.kellyFraction * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Position Management */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Position Management</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Position Size</p>
                        <p className="text-lg font-bold text-white">
                          ${formatNumber(advancedPrediction.positionSize)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Stop Loss</p>
                        <p className="text-lg font-bold text-red-400">
                          ${formatNumber(advancedPrediction.stopLoss)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Take Profit</p>
                        <p className="text-lg font-bold text-green-400">
                          ${formatNumber(advancedPrediction.takeProfit)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Probability Distribution */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Probability Distribution</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Above</p>
                        <p className="text-xl font-bold text-green-400">
                          {(advancedPrediction.probabilityDistribution.above * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Below</p>
                        <p className="text-xl font-bold text-red-400">
                          {(advancedPrediction.probabilityDistribution.below * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Pass</p>
                        <p className="text-xl font-bold text-yellow-400">
                          {(advancedPrediction.probabilityDistribution.pass * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Timeframe Confluence */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Multi-Timeframe Confluence</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">1m</p>
                        <Badge 
                          variant={advancedPrediction.multiTimeframeConfluence.m1.direction === 'BULLISH' ? 'default' : advancedPrediction.multiTimeframeConfluence.m1.direction === 'BEARISH' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {advancedPrediction.multiTimeframeConfluence.m1.direction}
                        </Badge>
                        <p className="text-white/60 text-xs mt-1">{(advancedPrediction.multiTimeframeConfluence.m1.confidence * 100).toFixed(0)}%</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">5m</p>
                        <Badge 
                          variant={advancedPrediction.multiTimeframeConfluence.m5.direction === 'BULLISH' ? 'default' : advancedPrediction.multiTimeframeConfluence.m5.direction === 'BEARISH' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {advancedPrediction.multiTimeframeConfluence.m5.direction}
                        </Badge>
                        <p className="text-white/60 text-xs mt-1">{(advancedPrediction.multiTimeframeConfluence.m5.confidence * 100).toFixed(0)}%</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">15m</p>
                        <Badge 
                          variant={advancedPrediction.multiTimeframeConfluence.m15.direction === 'BULLISH' ? 'default' : advancedPrediction.multiTimeframeConfluence.m15.direction === 'BEARISH' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {advancedPrediction.multiTimeframeConfluence.m15.direction}
                        </Badge>
                        <p className="text-white/60 text-xs mt-1">{(advancedPrediction.multiTimeframeConfluence.m15.confidence * 100).toFixed(0)}%</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">1h</p>
                        <Badge 
                          variant={advancedPrediction.multiTimeframeConfluence.h1.direction === 'BULLISH' ? 'default' : advancedPrediction.multiTimeframeConfluence.h1.direction === 'BEARISH' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {advancedPrediction.multiTimeframeConfluence.h1.direction}
                        </Badge>
                        <p className="text-white/60 text-xs mt-1">{(advancedPrediction.multiTimeframeConfluence.h1.confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-white/60 text-xs">Confluence Score: <span className="text-white font-bold">{(advancedPrediction.multiTimeframeConfluence.confluenceScore * 100).toFixed(1)}%</span></p>
                    </div>
                  </div>

                  {/* Trajectory Analysis */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Physics Trajectory Analysis</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Velocity</p>
                        <p className="text-lg font-bold text-cyan-400">
                          {advancedPrediction.trajectoryAnalysis.velocity.toFixed(4)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Acceleration</p>
                        <p className="text-lg font-bold text-purple-400">
                          {advancedPrediction.trajectoryAnalysis.acceleration.toFixed(4)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">Crossing Prob</p>
                        <p className="text-lg font-bold text-green-400">
                          {(advancedPrediction.trajectoryAnalysis.crossingProbability * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Uncertainty Quantification */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Monte Carlo Uncertainty</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">95% CI Lower</p>
                        <p className="text-lg font-bold text-white">
                          ${formatNumber(advancedPrediction.uncertaintyQuantification.confidenceInterval.lower)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">95% CI Upper</p>
                        <p className="text-lg font-bold text-white">
                          ${formatNumber(advancedPrediction.uncertaintyQuantification.confidenceInterval.upper)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Std Dev</p>
                        <p className="text-white font-mono text-xs">
                          {advancedPrediction.uncertaintyQuantification.standardDeviation.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Skewness</p>
                        <p className="text-white font-mono text-xs">
                          {advancedPrediction.uncertaintyQuantification.skewness.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-white/60 text-xs mb-1">Kurtosis</p>
                        <p className="text-white font-mono text-xs">
                          {advancedPrediction.uncertaintyQuantification.kurtosis.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Market Regime & Reasoning */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-white font-semibold mb-2">Market Regime</h4>
                      <Badge variant="outline" className="text-white border-white/30">
                        {advancedPrediction.riskAssessment.regime}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">Regime Confidence</h4>
                      <p className="text-white/80 text-sm">
                        {(advancedPrediction.riskAssessment.regimeConfidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">AI Reasoning</h4>
                    <div className="space-y-2">
                      {advancedPrediction.reasoning.slice(0, 4).map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-white/70 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced Features */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">MACD Analysis</CardTitle>
                    <CardDescription className="text-white/60">
                      Moving Average Convergence Divergence
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.indicators.macd ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-white/60 text-sm">MACD</p>
                            <p className={cn(
                              "font-semibold",
                              data.indicators.macd.macd > 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {formatNumber(data.indicators.macd.macd)}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 text-sm">Signal</p>
                            <p className={cn(
                              "font-semibold",
                              data.indicators.macd.signal > 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {formatNumber(data.indicators.macd.signal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 text-sm">Histogram</p>
                            <p className={cn(
                              "font-semibold",
                              data.indicators.macd.histogram > 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {formatNumber(data.indicators.macd.histogram)}
                            </p>
                          </div>
                        </div>
                        <div className="h-20 bg-white/5 rounded-lg flex items-center justify-center">
                          <span className="text-white/40">MACD Chart</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/40">MACD data unavailable</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white">Price Action</CardTitle>
                    <CardDescription className="text-white/60">
                      Recent price movements and patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32 bg-white/5 rounded-lg flex items-center justify-center w-full">
                      <Sparkline prices={data.priceHistory} height={128} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Elite BTC Kalshi Analysis */}
        <BTCKalshiAnalysis />
      </div>
    </div>
  )
}
