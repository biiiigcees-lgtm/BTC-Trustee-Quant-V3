"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

interface TradingData {
  price: number
  change: number
  changePercent: number
  volume: number
  high24h: number
  low24h: number
  marketCap: number
  indicators: {
    rsi: number | null
    macd: { macd: number; signal: number; histogram: number } | null
    bollinger: { upper: number; middle: number; lower: number; pctB: number } | null
    momentum: number | null
    regime: string | null
  }
  priceHistory: number[]
}

// Technical indicator calculations
function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const k = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k)
  }
  return ema
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  const slice = prices.slice(prices.length - period - 1)
  let gains = 0, losses = 0
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1]
    if (d >= 0) gains += d
    else losses -= d
  }
  if (losses === 0) return 100
  if (gains === 0) return 0
  return 100 - 100 / (1 + gains / losses)
}

function calcMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
  if (prices.length < 35) return null
  const ema12 = calcEMA(prices, 12)
  const ema26 = calcEMA(prices, 26)
  if (ema12 === null || ema26 === null) return null
  const macdLine = ema12 - ema26
  
  const macdSeries: number[] = []
  for (let i = 26; i <= prices.length; i++) {
    const e12 = calcEMA(prices.slice(0, i), 12)
    const e26 = calcEMA(prices.slice(0, i), 26)
    if (e12 !== null && e26 !== null) macdSeries.push(e12 - e26)
  }
  if (macdSeries.length < 9) return null
  const signalLine = calcEMA(macdSeries, 9)
  if (signalLine === null) return null
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine }
}

function calcBollingerBands(
  prices: number[],
  period = 20
): { upper: number; middle: number; lower: number; pctB: number } | null {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / period
  const std = Math.sqrt(variance)
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const last = prices[prices.length - 1]
  const pctB = std === 0 ? 0.5 : (last - lower) / (upper - lower)
  return { upper, middle: mean, lower, pctB }
}

function calcMomentumScore(
  rsi: number | null,
  macd: { macd: number; histogram: number } | null,
  bb: { pctB: number } | null,
  ema9: number | null,
  ema21: number | null,
  windowBias: number | null
): number | null {
  let score = 50
  let factors = 0

  if (rsi !== null) {
    score += (rsi - 50) * 0.3
    factors++
  }
  if (macd !== null) {
    score += macd.histogram > 0 ? 8 : -8
    score += macd.macd > 0 ? 4 : -4
    factors++
  }
  if (bb !== null) {
    score += (bb.pctB - 0.5) * 20
    factors++
  }
  if (ema9 !== null && ema21 !== null) {
    score += ema9 > ema21 ? 8 : -8
    factors++
  }
  if (windowBias !== null) {
    score += (windowBias - 50) * 0.2
    factors++
  }

  if (factors === 0) return null
  return Math.max(0, Math.min(100, score))
}

function calcWindowBias(prices: number[]): number | null {
  if (prices.length < 2) return null
  let up = 0, total = 0
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] !== prices[i - 1]) {
      if (prices[i] > prices[i - 1]) up++
      total++
    }
  }
  if (total === 0) return null
  return (up / total) * 100
}

function detectMarketRegime(
  ema9: number | null,
  ema21: number | null,
  bb: { upper: number; middle: number; lower: number } | null,
  atr: number | null,
  price: number | null
): string | null {
  if (!bb || !price) return null
  const bbWidth = (bb.upper - bb.lower) / bb.middle
  if (bbWidth < 0.003) return "SQUEEZE"
  if (atr !== null && atr / price > 0.003) return "VOLATILE"
  if (ema9 !== null && ema21 !== null) {
    const gap = (ema9 - ema21) / ema21
    if (gap > 0.002) return "TRENDING UP"
    if (gap < -0.002) return "TRENDING DOWN"
  }
  return "RANGING"
}

export function useTradingData(autoRefresh = true, refreshInterval = 2000) {
  const {
    data: rawData,
    error,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['trading-data'],
    queryFn: async () => {
      const response = await fetch('/api/prices')
      if (!response.ok) throw new Error('Failed to fetch trading data')
      return response.json()
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 1000,
    gcTime: 5000
  })

  const processedData = useMemo(() => {
    if (!rawData || !('prices' in rawData) || !rawData.prices) return null

    const prices = rawData.prices
    const currentPrice = prices[prices.length - 1]
    const previousPrice = prices[prices.length - 2]
    const change = currentPrice - previousPrice
    const changePercent = (change / previousPrice) * 100

    // Calculate indicators
    const rsi = calcRSI(prices)
    const ema9 = calcEMA(prices, 9)
    const ema21 = calcEMA(prices, 21)
    const macd = calcMACD(prices)
    const bollinger = calcBollingerBands(prices)
    const windowBias = calcWindowBias(prices)
    const momentum = calcMomentumScore(rsi, macd, bollinger, ema9, ema21, windowBias)
    const regime = detectMarketRegime(ema9, ema21, bollinger, null, currentPrice)

    return {
      price: currentPrice,
      change,
      changePercent,
      volume: rawData.volume,
      high24h: rawData.high24h,
      low24h: rawData.low24h,
      marketCap: rawData.marketCap,
      indicators: {
        rsi,
        macd,
        bollinger,
        momentum,
        regime
      },
      priceHistory: prices
    }
  }, [rawData])

  const playAlert = useCallback((frequency: number) => {
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
  }, [])

  return {
    data: processedData,
    isLoading,
    error,
    refetch,
    playAlert
  }
}
