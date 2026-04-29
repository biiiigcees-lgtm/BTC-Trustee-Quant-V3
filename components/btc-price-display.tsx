"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Bitcoin,
  DollarSign,
  Clock
} from "lucide-react"
import { cn, formatNumber, formatPercent } from "@/lib/utils"

interface PricePoint {
  price: number
  timestamp: number
  volume: number
  high: number
  low: number
  change: number
  changePercent: number
}

interface BTCPriceDisplayProps {
  className?: string
}

export function BTCPriceDisplay({ className }: BTCPriceDisplayProps) {
  const [currentPrice, setCurrentPrice] = useState<PricePoint | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)

  // Initialize with mock data - only run once
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const basePrice = 65000
    const randomChange = (Math.random() - 0.5) * 0.002 // ±0.2% change
    const price = basePrice * (1 + randomChange)
    const volume = 20000000000 + Math.random() * 10000000000

    const pricePoint: PricePoint = {
      price,
      timestamp: Date.now(),
      volume,
      high: price * 1.001,
      low: price * 0.999,
      change: price - basePrice,
      changePercent: ((price - basePrice) / basePrice) * 100
    }

    setCurrentPrice(pricePoint)
    setIsConnected(true)

    // Simulate live updates
    intervalRef.current = setInterval(() => {
      setCurrentPrice(prevPrice => {
        if (!prevPrice) return prevPrice
        
        const randomChange = (Math.random() - 0.5) * 0.001 // ±0.1% change
        const newPrice = prevPrice.price * (1 + randomChange)
        const volume = 20000000000 + Math.random() * 10000000000

        const newPoint: PricePoint = {
          price: newPrice,
          timestamp: Date.now(),
          volume,
          high: Math.max(prevPrice.high, newPrice),
          low: Math.min(prevPrice.low, newPrice),
          change: newPrice - prevPrice.price + prevPrice.change,
          changePercent: ((newPrice - prevPrice.price + prevPrice.change) / prevPrice.price) * 100
        }

        return newPoint
      })
    }, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, []) // Empty dependency array ensures this only runs once

  const getPriceColor = (change: number) => {
    return change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!currentPrice) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <Bitcoin className="h-6 w-6 animate-pulse text-orange-400" />
            <span className="text-white/70">Loading BTC price...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-white/20 backdrop-blur-md",
      className
    )}>
      <CardContent className="p-6 pt-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Bitcoin className="h-5 w-5 text-orange-400" />
            </div>
            <Badge 
              variant="outline"
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
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">
              ${formatNumber(currentPrice.price)}
            </span>
            <span className={cn(
              "text-sm font-semibold",
              getPriceColor(currentPrice.change)
            )}>
              {currentPrice.change > 0 ? '+' : ''}{formatNumber(currentPrice.change, 2)}
            </span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-white/60">
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4" />
              <span>Vol: ${(currentPrice.volume / 1000000000).toFixed(1)}B</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>{formatTime(currentPrice.timestamp)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h High</div>
            <div className="text-white font-semibold">
              ${formatNumber(currentPrice.high)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h Low</div>
            <div className="text-white font-semibold">
              ${formatNumber(currentPrice.low)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h Volume</div>
            <div className="text-white font-semibold">
              ${(currentPrice.volume / 1000000000).toFixed(1)}B
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-white/60 text-xs mb-1">24h Change</div>
            <div className={cn(
              "font-semibold flex items-center space-x-1",
              getPriceColor(currentPrice.changePercent)
            )}>
              {currentPrice.changePercent > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : currentPrice.changePercent < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Activity className="h-3 w-3" />
              )}
              {formatPercent(currentPrice.changePercent)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
