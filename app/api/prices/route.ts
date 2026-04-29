import { NextRequest, NextResponse } from 'next/server'

// Mock real-time price data generation
function generateRealisticPrices(basePrice: number = 45000, count: number = 100): number[] {
  const prices: number[] = [basePrice]
  let trend = (Math.random() - 0.5) * 0.002
  let volatility = 0.01
  
  for (let i = 1; i < count; i++) {
    const randomWalk = (Math.random() - 0.5) * volatility
    const meanReversion = (basePrice - prices[i - 1]) * 0.001
    const momentum = trend * 0.1
    
    trend += (Math.random() - 0.5) * 0.0001
    volatility = Math.max(0.005, volatility + (Math.random() - 0.5) * 0.0001)
    
    const change = randomWalk + meanReversion + momentum
    const newPrice = prices[i - 1] * (1 + change)
    
    prices.push(Math.max(basePrice * 0.8, Math.min(basePrice * 1.2, newPrice)))
  }
  
  return prices
}

function generateMarketData() {
  const basePrice = 45000 + Math.random() * 10000
  const prices = generateRealisticPrices(basePrice, 100)
  const currentPrice = prices[prices.length - 1]
  const previousPrice = prices[prices.length - 2]
  const change = currentPrice - previousPrice
  const changePercent = (change / previousPrice) * 100
  
  // Generate additional market metrics
  const volume = Math.floor(Math.random() * 1000000000) + 500000000
  const high24h = Math.max(...prices.slice(-24)) || currentPrice
  const low24h = Math.min(...prices.slice(-24)) || currentPrice
  const marketCap = currentPrice * 19000000 // Approximate BTC supply
  
  return {
    prices,
    currentPrice,
    change,
    changePercent,
    volume,
    high24h,
    low24h,
    marketCap,
    timestamp: Date.now()
  }
}

export async function GET(request: NextRequest) {
  try {
    // Add cache control for real-time data
    const headers = new Headers({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Type': 'application/json'
    })

    const data = generateMarketData()
    
    return NextResponse.json(data, { headers })
  } catch (error) {
    console.error('Error generating price data:', error)
    return NextResponse.json(
      { error: 'Failed to generate price data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle custom parameters
    const { basePrice, count, timeframe } = body
    
    const prices = generateRealisticPrices(
      basePrice || 45000,
      Math.min(Math.max(count || 100, 10), 1000)
    )
    
    return NextResponse.json({
      prices,
      timestamp: Date.now(),
      parameters: { basePrice, count, timeframe }
    })
  } catch (error) {
    console.error('Error in POST request:', error)
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
