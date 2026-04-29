"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Bitcoin,
  RefreshCw,
  Maximize2,
  Minimize2,
  Settings,
  Clock,
  DollarSign,
  BarChart3
} from "lucide-react"
import { cn, formatNumber, formatPercent } from "@/lib/utils"
import { OHLC, TradingSignal } from "@/lib/types"
import { useEMA, useSMA, useRSI, useBollinger, useMACD, useVolume } from "@/lib/indicators"
import { useIndicatorStore } from "@/lib/store"

interface LiveBTCChartProps {
  readonly className?: string
  readonly data?: OHLC[]
  readonly signals?: TradingSignal[]
}

export function LiveBTCChart({ className, data: externalData, signals }: LiveBTCChartProps) {
  const [priceData, setPriceData] = useState<OHLC[]>([])
  const [currentPrice, setCurrentPrice] = useState<OHLC | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('5m')
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'area'>('area')
  const [viewOffset, setViewOffset] = useState(0)
  const [viewScale, setViewScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const wsRef = useRef<WebSocket | null>(null)

  // Initialize with realistic market data or use external data
  useEffect(() => {
    if (externalData && externalData.length > 0) {
      setPriceData(externalData)
      setCurrentPrice(externalData[externalData.length - 1])
      setIsConnected(true)
      return
    }

    const initializeData = () => {
      const basePrice = 65000
      const mockData: OHLC[] = []
      let currentPrice = basePrice
      let trend = 0.0001 // Base trend
      let volatility = 0.001 // Base volatility
      
      for (let i = 100; i >= 0; i--) {
        const timestamp = Date.now() - (i * 2 * 60 * 1000) // 2-minute intervals for more data
        
        // Simulate realistic market patterns
        const marketSentiment = Math.sin(i * 0.1) * 0.0005 // Cyclical sentiment
        const newsImpact = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.002 : 0 // Occasional news
        const whaleActivity = Math.random() < 0.05 ? (Math.random() - 0.5) * 0.003 : 0 // Whale movements
        
        // Combine all factors
        const priceMovement = trend + marketSentiment + newsImpact + whaleActivity + (Math.random() - 0.5) * volatility
        currentPrice = currentPrice * (1 + priceMovement)
        
        // Volume correlates with volatility and price movements
        const baseVolume = 25000000000
        const volumeMultiplier = Math.abs(priceMovement) * 1000 + Math.random() * 0.5 + 0.5
        const volume = baseVolume * volumeMultiplier
        
        mockData.push({
          timestamp,
          open: currentPrice * 0.999,
          high: currentPrice * 1.0015,
          low: currentPrice * 0.9985,
          close: currentPrice,
          volume,
        })
      }
      
      setPriceData(mockData)
      setCurrentPrice(mockData[mockData.length - 1])
      setIsConnected(true)
    }

    initializeData()
  }, [externalData])

  // Simulate live price updates with realistic market patterns
  useEffect(() => {
    if (!isConnected) return

    let momentum = 0
    let volatility = 0.001
    let trendDirection = 1 // 1 for uptrend, -1 for downtrend

    const interval = setInterval(() => {
      setPriceData(prevData => {
        if (prevData.length === 0) return prevData
        
        const lastPrice = prevData[prevData.length - 1]
        
        // Realistic market factors
        const momentumFactor = momentum * 0.0002 // Momentum continuation
        const volatilitySpike = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.002 : 0 // Occasional volatility spikes
        const meanReversion = (65000 - lastPrice.close) * 0.0001 // Tendency to return to mean
        const randomWalk = (Math.random() - 0.5) * volatility
        
        // Combine factors for realistic price movement
        const priceMovement = momentumFactor + volatilitySpike + meanReversion + randomWalk
        const newPrice = lastPrice.close * (1 + priceMovement)
        
        // Volume correlates with price movement and time of day
        const timeOfDay = new Date().getHours()
        const timeMultiplier = timeOfDay >= 9 && timeOfDay <= 16 ? 1.2 : 0.8 // Trading hours volume
        const volumeBase = 25000000000
        const volumeSpike = Math.abs(priceMovement) > 0.001 ? Math.random() * 0.5 + 0.5 : 0
        const volume = volumeBase * timeMultiplier * (1 + volumeSpike)

        // Update momentum and volatility
        momentum = momentum * 0.95 + priceMovement * 0.1 // Momentum decay and update
        volatility = volatility * 0.98 + Math.abs(priceMovement) * 0.1 // Volatility adjustment
        if (Math.random() < 0.05) trendDirection *= -1 // Occasional trend changes

        const newPoint: OHLC = {
          timestamp: Date.now(),
          open: lastPrice.close,
          high: Math.max(lastPrice.high, newPrice),
          low: Math.min(lastPrice.low, newPrice),
          close: newPrice,
          volume,
        }

        const newData = [...prevData.slice(-99), newPoint]
        setCurrentPrice(newPoint)
        setLastUpdate(Date.now())
        return newData
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isConnected])

  // Get indicator config from store
  const indicatorConfig = useIndicatorStore(state => state.config)

  // Compute indicator values
  const emaValues = useMemo(() => 
    indicatorConfig.ema.enabled ? useEMA(priceData, indicatorConfig.ema.period) : null,
    [priceData, indicatorConfig.ema.enabled, indicatorConfig.ema.period]
  )
  const smaValues = useMemo(() => 
    indicatorConfig.sma.enabled ? useSMA(priceData, indicatorConfig.sma.period) : null,
    [priceData, indicatorConfig.sma.enabled, indicatorConfig.sma.period]
  )
  const bollingerValues = useMemo(() => 
    indicatorConfig.bollinger.enabled ? useBollinger(priceData, indicatorConfig.bollinger.period, indicatorConfig.bollinger.multiplier) : null,
    [priceData, indicatorConfig.bollinger.enabled, indicatorConfig.bollinger.period, indicatorConfig.bollinger.multiplier]
  )
  const rsiValues = useMemo(() => 
    indicatorConfig.rsi.enabled ? useRSI(priceData, indicatorConfig.rsi.period) : null,
    [priceData, indicatorConfig.rsi.enabled, indicatorConfig.rsi.period]
  )
  const macdValues = useMemo(() => 
    indicatorConfig.macd.enabled ? useMACD(priceData, indicatorConfig.macd.fast, indicatorConfig.macd.slow, indicatorConfig.macd.signal) : null,
    [priceData, indicatorConfig.macd.enabled, indicatorConfig.macd.fast, indicatorConfig.macd.slow, indicatorConfig.macd.signal]
  )
  const volumeValues = useMemo(() => 
    indicatorConfig.volume.enabled ? useVolume(priceData) : null,
    [priceData, indicatorConfig.volume.enabled]
  )

  // Draw chart
  const drawChart = useCallback(() => {
    if (!canvasRef.current || priceData.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const padding = 40

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Calculate price range
    const prices = priceData.map(d => d.close)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    // Helper to transform x-coordinate with zoom/pan
    const transformX = (index: number): number => {
      const baseX = padding + (width - 2 * padding) * index / (priceData.length - 1)
      const scaledX = (baseX - padding) * viewScale + padding
      return scaledX - viewOffset * viewScale
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - 2 * padding) * i / 5
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()

      // Price labels
      const price = maxPrice - (priceRange * i / 5)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = '11px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`$${formatNumber(price)}`, padding - 5, y + 3)
    }

    // Vertical grid lines
    for (let i = 0; i <= 6; i++) {
      const x = padding + (width - 2 * padding) * i / 6
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, height - padding)
      ctx.stroke()
    }

    // Draw Bollinger Bands (if enabled)
    if (bollingerValues && bollingerValues.upper.length > 0) {
      const startIndex = Math.max(indicatorConfig.bollinger.period, indicatorConfig.ema.period, indicatorConfig.sma.period)
      
      // Upper band
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)'
      ctx.lineWidth = 1
      bollingerValues.upper.forEach((value, index) => {
        const dataIndex = startIndex + index
        if (dataIndex < priceData.length) {
          const x = transformX(dataIndex)
          const y = padding + (height - 2 * padding) * (1 - (value - minPrice) / priceRange)
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // Lower band
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)'
      bollingerValues.lower.forEach((value, index) => {
        const dataIndex = startIndex + index
        if (dataIndex < priceData.length) {
          const x = transformX(dataIndex)
          const y = padding + (height - 2 * padding) * (1 - (value - minPrice) / priceRange)
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // Fill between bands
      ctx.beginPath()
      ctx.fillStyle = 'rgba(255, 170, 0, 0.1)'
      bollingerValues.upper.forEach((value, index) => {
        const dataIndex = startIndex + index
        if (dataIndex < priceData.length) {
          const x = transformX(dataIndex)
          const y = padding + (height - 2 * padding) * (1 - (value - minPrice) / priceRange)
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      })
      for (let i = bollingerValues.lower.length - 1; i >= 0; i--) {
        const dataIndex = startIndex + i
        if (dataIndex < priceData.length) {
          const x = transformX(dataIndex)
          const y = padding + (height - 2 * padding) * (1 - (bollingerValues.lower[i] - minPrice) / priceRange)
          ctx.lineTo(x, y)
        }
      }
      ctx.closePath()
      ctx.fill()
    }

    // Draw EMA (if enabled)
    if (emaValues && emaValues.length > 0) {
      const startIndex = indicatorConfig.ema.period - 1
      ctx.beginPath()
      ctx.strokeStyle = indicatorConfig.ema.color
      ctx.lineWidth = 2
      emaValues.forEach((value, index) => {
        const dataIndex = startIndex + index
        if (dataIndex < priceData.length) {
          const x = transformX(dataIndex)
          const y = padding + (height - 2 * padding) * (1 - (value - minPrice) / priceRange)
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
    }

    // Draw SMA (if enabled)
    if (smaValues && smaValues.length > 0) {
      const startIndex = indicatorConfig.sma.period - 1
      ctx.beginPath()
      ctx.strokeStyle = indicatorConfig.sma.color
      ctx.lineWidth = 2
      smaValues.forEach((value, index) => {
        const dataIndex = startIndex + index
        if (dataIndex < priceData.length) {
          const x = transformX(dataIndex)
          const y = padding + (height - 2 * padding) * (1 - (value - minPrice) / priceRange)
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
    }

    // Draw price chart
    if (chartType === 'area' || chartType === 'line') {
      const changePercent = currentPrice ? ((currentPrice.close - priceData[0].close) / priceData[0].close) * 100 : 0
      
      // Create gradient
      const gradient = ctx.createLinearGradient(0, padding, 0, height - padding)
      gradient.addColorStop(0, changePercent > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

      // Draw area
      if (chartType === 'area') {
        ctx.beginPath()
        ctx.moveTo(transformX(0), height - padding)
        
        priceData.forEach((point, index) => {
          const x = transformX(index)
          const y = padding + (height - 2 * padding) * (1 - (point.close - minPrice) / priceRange)
          
          if (index === 0) {
            ctx.lineTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        
        ctx.lineTo(transformX(priceData.length - 1), height - padding)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Draw line
      ctx.beginPath()
      ctx.strokeStyle = changePercent > 0 ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 2

      priceData.forEach((point, index) => {
        const x = transformX(index)
        const y = padding + (height - 2 * padding) * (1 - (point.close - minPrice) / priceRange)
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()

      // Draw current price point
      if (currentPrice) {
        const lastX = width - padding
        const lastY = padding + (height - 2 * padding) * (1 - (currentPrice.close - minPrice) / priceRange)
        
        ctx.beginPath()
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
        ctx.fillStyle = changePercent > 0 ? '#22c55e' : '#ef4444'
        ctx.fill()
        
        // Glow effect
        ctx.shadowColor = changePercent > 0 ? '#22c55e' : '#ef4444'
        ctx.shadowBlur = 10
        ctx.fill()
        ctx.shadowBlur = 0
      }

    } else if (chartType === 'candlestick') {
      // Draw candlesticks
      priceData.forEach((point, index) => {
        const x = transformX(index)
        const candleWidth = Math.max(1, (width - 2 * padding) / priceData.length - 2)
        const closeY = padding + (height - 2 * padding) * (1 - (point.close - minPrice) / priceRange)
        const highY = padding + (height - 2 * padding) * (1 - (point.high - minPrice) / priceRange)
        const lowY = padding + (height - 2 * padding) * (1 - (point.low - minPrice) / priceRange)
        const openY = padding + (height - 2 * padding) * (1 - (point.open - minPrice) / priceRange)

        const isGreen = point.close >= point.open

        // Wick
        ctx.strokeStyle = isGreen ? '#22c55e' : '#ef4444'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, highY)
        ctx.lineTo(x, lowY)
        ctx.stroke()

        // Body
        const bodyTop = Math.min(openY, closeY)
        const bodyHeight = Math.abs(closeY - openY)
        
        ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444'
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, Math.max(1, bodyHeight))
      })
    }

    // Draw volume bars at bottom (if enabled)
    if (volumeValues && volumeValues.length > 0) {
      const maxVolume = Math.max(...volumeValues)
      const volumeHeight = 60

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
      volumeValues.forEach((volume: number, index: number) => {
        const x = transformX(index)
        const barWidth = Math.max(1, (width - 2 * padding) / priceData.length - 1)
        const barHeight = (volume / maxVolume) * volumeHeight
        const y = height - padding - volumeHeight

        ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight)
      })
    }

    // Draw trading signals (BUY/SELL arrows)
    if (signals && signals.length > 0) {
      signals.forEach((signal) => {
        const dataIndex = priceData.findIndex((d) => d.timestamp === signal.timestamp)
        if (dataIndex === -1) return

        const x = transformX(dataIndex)
        const point = priceData[dataIndex]
        
        // Arrow size based on strength
        const arrowSize = signal.strength === 3 ? 12 : signal.strength === 2 ? 10 : 8
        const opacity = signal.strength === 3 ? 1 : signal.strength === 2 ? 0.8 : 0.6

        if (signal.direction === "BUY") {
          // Green up arrow at candle low
          const y = padding + (height - 2 * padding) * (1 - (point.low - minPrice) / priceRange) + arrowSize
          
          ctx.save()
          ctx.globalAlpha = opacity
          ctx.fillStyle = '#22c55e'
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 2
          
          // Draw arrow
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - arrowSize / 2, y + arrowSize)
          ctx.lineTo(x + arrowSize / 2, y + arrowSize)
          ctx.closePath()
          ctx.fill()
          
          // Glow for strength 3
          if (signal.strength === 3) {
            ctx.shadowColor = '#22c55e'
            ctx.shadowBlur = 15
            ctx.fill()
          }
          
          ctx.restore()
        } else {
          // Red down arrow at candle high
          const y = padding + (height - 2 * padding) * (1 - (point.high - minPrice) / priceRange) - arrowSize
          
          ctx.save()
          ctx.globalAlpha = opacity
          ctx.fillStyle = '#ef4444'
          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = 2
          
          // Draw arrow
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - arrowSize / 2, y - arrowSize)
          ctx.lineTo(x + arrowSize / 2, y - arrowSize)
          ctx.closePath()
          ctx.fill()
          
          // Glow for strength 3
          if (signal.strength === 3) {
            ctx.shadowColor = '#ef4444'
            ctx.shadowBlur = 15
            ctx.fill()
          }
          
          ctx.restore()
        }
      })
    }

  }, [priceData, currentPrice, chartType, indicatorConfig, emaValues, smaValues, bollingerValues, volumeValues, signals, viewOffset, viewScale])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawChart()
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [drawChart])

  // Zoom/pan handlers
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const zoomSpeed = 0.001
    const newScale = Math.max(0.5, Math.min(5, viewScale - e.deltaY * zoomSpeed))
    setViewScale(newScale)
  }

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true)
    setDragStart(e.clientX)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    const delta = e.clientX - dragStart
    const sensitivity = 0.5
    const newOffset = Math.max(0, Math.min(priceData.length - 1, viewOffset + delta * sensitivity))
    setViewOffset(newOffset)
    setDragStart(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [viewOffset, viewScale, isDragging, dragStart, priceData.length])

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current
        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
        drawChart()
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [drawChart])

  const getPriceColor = (close: number, open: number) => {
    return close > open ? 'text-green-400' : close < open ? 'text-red-400' : 'text-gray-400'
  }

  if (!currentPrice) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-3">
            <Bitcoin className="h-6 w-6 animate-pulse text-orange-400" />
            <span className="text-white/70">Loading BTC price data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "bg-white/5 border-white/10 backdrop-blur-sm",
      isFullscreen && "fixed inset-0 z-50 m-0",
      className
    )}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Bitcoin className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Live BTC Price</h2>
              <div className="flex items-center space-x-2 text-sm">
                <div className={cn(
                  "flex items-center space-x-1",
                  getPriceColor(currentPrice.close, priceData[0]?.close ?? currentPrice.close)
                )}>
                  {currentPrice.close > (priceData[0]?.close ?? currentPrice.close) ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : currentPrice.close < (priceData[0]?.close ?? currentPrice.close) ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                  <span>{formatPercent(((currentPrice.close - (priceData[0]?.close ?? currentPrice.close)) / (priceData[0]?.close ?? currentPrice.close)) * 100)}</span>
                </div>
                <span className="text-white/60">24h</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge 
              variant={isConnected ? "default" : "destructive"}
              className={cn(
                "px-2 py-1 text-xs",
                isConnected 
                  ? "bg-green-500/20 text-green-400 border-green-500/30" 
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              )}
            >
              <div className="flex items-center space-x-1">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-green-400" : "bg-red-400"
                )} />
                <span>{isConnected ? "LIVE" : "OFFLINE"}</span>
              </div>
            </Badge>
            
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimeframe('1m')}
                className={cn(
                  "text-xs px-2 py-1",
                  timeframe === '1m' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "text-white/60"
                )}
              >
                1m
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimeframe('5m')}
                className={cn(
                  "text-xs px-2 py-1",
                  timeframe === '5m' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "text-white/60"
                )}
              >
                5m
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimeframe('15m')}
                className={cn(
                  "text-xs px-2 py-1",
                  timeframe === '15m' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "text-white/60"
                )}
              >
                15m
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimeframe('1h')}
                className={cn(
                  "text-xs px-2 py-1",
                  timeframe === '1h' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "text-white/60"
                )}
              >
                1h
              </Button>
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChartType('area')}
                className={cn(
                  "text-xs px-2 py-1",
                  chartType === 'area' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "text-white/60"
                )}
              >
                Area
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChartType('line')}
                className={cn(
                  "text-xs px-2 py-1",
                  chartType === 'line' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "text-white/60"
                )}
              >
                Line
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChartType('candlestick')}
                className={cn(
                  "text-xs px-2 py-1",
                  chartType === 'candlestick' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "text-white/60"
                )}
              >
                Candles
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-white border-white/20 hover:bg-white/10"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        {/* Chart Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-80 rounded-lg"
            style={{ imageRendering: 'crisp-edges' }}
          />
          
          {/* Price overlay */}
          {priceData && priceData.length > 0 && (
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-2">
              <div className="text-white text-xs space-y-1">
                <div>High: ${formatNumber(Math.max(...priceData.map(d => d.high)))}</div>
                <div>Low: ${formatNumber(Math.min(...priceData.map(d => d.low)))}</div>
                <div>Current: ${formatNumber(currentPrice.close)}</div>
                {emaValues && emaValues.length > 0 && (
                  <div>EMA{indicatorConfig.ema.period}: ${formatNumber(emaValues[emaValues.length - 1])}</div>
                )}
                {rsiValues && rsiValues.length > 0 && (
                  <div>RSI: {rsiValues[rsiValues.length - 1].toFixed(1)}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Volume and Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h High</div>
            <div className="text-white font-semibold">
              ${formatNumber(Math.max(...priceData.map(d => d.high)))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h Low</div>
            <div className="text-white font-semibold">
              ${formatNumber(Math.min(...priceData.map(d => d.low)))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h Volume</div>
            <div className="text-white font-semibold">
              ${((currentPrice.volume ?? 0) / 1000000000).toFixed(1)}B
            </div>
          </div>
          {rsiValues && rsiValues.length > 0 && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-white/60 text-xs mb-1">RSI ({indicatorConfig.rsi.period})</div>
              <div className={cn(
                "font-semibold",
                rsiValues[rsiValues.length - 1] > indicatorConfig.rsi.overbought ? "text-red-400" :
                rsiValues[rsiValues.length - 1] < indicatorConfig.rsi.oversold ? "text-green-400" :
                "text-white"
              )}>
                {rsiValues[rsiValues.length - 1].toFixed(1)}
              </div>
            </div>
          )}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">Points</div>
            <div className="text-white font-semibold">
              {priceData.length}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
