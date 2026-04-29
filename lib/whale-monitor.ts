import { Timeframe } from './god-tier-prediction';

// ═══════════════════════════════════════════════════════════════════════════
// WHALE & ON-CHAIN MONITORING SYSTEM — Large Wallet & Exchange Flow Tracking
// ═══════════════════════════════════════════════════════════════════════════

interface WhaleWallet {
  address: string;
  label?: string;        // Known entity (e.g., "MicroStrategy", "Grayscale")
  balance: number;       // Current balance in BTC
  totalInflows: number;    // 30-day inflows
  totalOutflows: number;   // 30-day outflows
  netFlow: number;         // Inflows - Outflows
  lastActivity: number;    // Timestamp
  transactionCount: number;
  avgTransactionSize: number;
  riskScore: number;       // 0-100 (higher = more concerning)
}

interface ExchangeFlow {
  exchange: string;
  inflows: number;         // BTC flowing into exchange (potential selling)
  outflows: number;        // BTC flowing out of exchange (potential buying/hodling)
  netFlow: number;         // Negative = more outflows (bullish), Positive = more inflows (bearish)
  inflowUsd: number;
  outflowUsd: number;
  netFlowUsd: number;
  change24h: number;       // 24h change in net flow
  trend: 'increasing_inflows' | 'increasing_outflows' | 'stable';
}

interface OnChainMetrics {
  // Network health
  hashRate: number;        // Current network hash rate
  hashRateChange24h: number;
  difficulty: number;
  nextDifficultyChange: number; // Estimated % change
  
  // Transaction metrics
  mempoolSize: number;     // Pending transactions
  avgTransactionFee: number; // Satoshis per byte
  transactionCount24h: number;
  
  // Supply metrics
  activeSupply1y: number;  // % of supply active in last year
  activeSupply3y: number;
  illiquidSupply: number;    // % of supply in cold storage
  
  // Miner metrics
  minerRevenue: number;    // Daily miner revenue in USD
  minerPosition: 'accumulating' | 'selling' | 'neutral';
  minerOutflows: number;   // BTC miners moving to exchanges
}

interface WhaleSignal {
  type: 'accumulation' | 'distribution' | 'exchange_inflow' | 'exchange_outflow' | 'large_transfer';
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  description: string;
  amount: number;          // BTC
  amountUsd: number;
  wallet?: string;
  exchange?: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;      // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════
// WHALE THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

const WHALE_THRESHOLDS = {
  transactionSize: 1000,      // BTC - considered whale transaction
  walletBalance: 10000,       // BTC - considered whale wallet
  dailyInflowAlert: 5000,     // BTC - alert if exchange inflows exceed
  dailyOutflowAlert: 5000,    // BTC - alert if exchange outflows exceed
  significantFlowChange: 0.3, // 30% change in flow pattern
};

// Known large wallets (simplified - real implementation would use API)
const KNOWN_WALLETS: Map<string, string> = new Map([
  ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'Satoshi'],
  ['bc1qmxjefnuy06u5vjv3k5s8f5xqq7y9d0h0t', 'MicroStrategy'],
  ['bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0', 'Tesla'],
  ['3KyeQ5PWsM6bDng6a1N8DHpE1Q1oP1JxY8', 'Grayscale'],
]);

// ═══════════════════════════════════════════════════════════════════════════
// WHALE ACTIVITY ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

export class WhaleMonitor {
  private wallets: Map<string, WhaleWallet> = new Map();
  private exchanges: Map<string, ExchangeFlow> = new Map();
  private signals: WhaleSignal[] = [];
  private onChainMetrics: OnChainMetrics | null = null;
  
  // Simulate real-time data (replace with actual blockchain API calls)
  async fetchExchangeFlows(): Promise<ExchangeFlow[]> {
    // In production, this would call Glassnode, CryptoQuant, or similar API
    // For now, return simulated data
    const exchanges = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'];
    
    return exchanges.map(exchange => {
      // Simulate some correlation with market conditions
      const baseInflow = Math.random() * 1000 + 500;
      const baseOutflow = Math.random() * 1000 + 500;
      const price = 85000; // Current BTC price
      
      const inflow = baseInflow * (0.8 + Math.random() * 0.4);
      const outflow = baseOutflow * (0.8 + Math.random() * 0.4);
      
      return {
        exchange,
        inflows: inflow,
        outflows: outflow,
        netFlow: outflow - inflow,
        inflowUsd: inflow * price,
        outflowUsd: outflow * price,
        netFlowUsd: (outflow - inflow) * price,
        change24h: (Math.random() - 0.5) * 0.4,
        trend: outflow > inflow * 1.2 ? 'increasing_outflows' : 
               inflow > outflow * 1.2 ? 'increasing_inflows' : 'stable',
      };
    });
  }
  
  async fetchOnChainMetrics(): Promise<OnChainMetrics> {
    // Simulate on-chain metrics
    return {
      hashRate: 500_000_000, // 500 EH/s
      hashRateChange24h: 0.02,
      difficulty: 80_000_000_000_000,
      nextDifficultyChange: 0.05,
      
      mempoolSize: 15000,
      avgTransactionFee: 25,
      transactionCount24h: 300_000,
      
      activeSupply1y: 0.65,
      activeSupply3y: 0.45,
      illiquidSupply: 0.78,
      
      minerRevenue: 30_000_000,
      minerPosition: Math.random() > 0.5 ? 'accumulating' : 'neutral',
      minerOutflows: Math.random() * 100,
    };
  }
  
  analyzeWhalePressure(): {
    pressure: 'buying' | 'selling' | 'neutral';
    strength: number; // 0-100
    signals: WhaleSignal[];
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    const activeSignals: WhaleSignal[] = [];
    
    // Analyze exchange flows
    let totalNetFlow = 0;
    let outflowDominantExchanges = 0;
    let inflowDominantExchanges = 0;
    
    for (const flow of this.exchanges.values()) {
      totalNetFlow += flow.netFlow;
      
      if (flow.netFlow < -WHALE_THRESHOLDS.transactionSize) {
        outflowDominantExchanges++;
        
        // Create signal for significant outflows
        if (Math.abs(flow.netFlow) > WHALE_THRESHOLDS.dailyOutflowAlert) {
          const signal: WhaleSignal = {
            type: 'exchange_outflow',
            severity: 'warning',
            timestamp: Date.now(),
            description: `${flow.exchange} showing significant outflows: ${Math.abs(flow.netFlow).toFixed(0)} BTC`,
            amount: Math.abs(flow.netFlow),
            amountUsd: Math.abs(flow.netFlowUsd),
            exchange: flow.exchange,
            direction: 'bullish',
            confidence: 75,
          };
          activeSignals.push(signal);
          reasoning.push(`🔵 ${flow.exchange}: ${Math.abs(flow.netFlow).toFixed(0)} BTC outflow (bullish - removing supply)`);
        }
      } else if (flow.netFlow > WHALE_THRESHOLDS.transactionSize) {
        inflowDominantExchanges++;
        
        if (flow.netFlow > WHALE_THRESHOLDS.dailyInflowAlert) {
          const signal: WhaleSignal = {
            type: 'exchange_inflow',
            severity: 'warning',
            timestamp: Date.now(),
            description: `${flow.exchange} showing significant inflows: ${flow.netFlow.toFixed(0)} BTC`,
            amount: flow.netFlow,
            amountUsd: flow.netFlowUsd,
            exchange: flow.exchange,
            direction: 'bearish',
            confidence: 70,
          };
          activeSignals.push(signal);
          reasoning.push(`🔴 ${flow.exchange}: ${flow.netFlow.toFixed(0)} BTC inflow (bearish - potential selling)`);
        }
      }
    }
    
    // Determine pressure
    let pressure: 'buying' | 'selling' | 'neutral' = 'neutral';
    let strength = 50;
    
    if (totalNetFlow < -2000) {
      pressure = 'buying';
      strength = Math.min(100, 50 + Math.abs(totalNetFlow) / 100);
      reasoning.push(`Net exchange outflows: ${Math.abs(totalNetFlow).toFixed(0)} BTC (withdrawal to cold storage)`);
    } else if (totalNetFlow > 2000) {
      pressure = 'selling';
      strength = Math.min(100, 50 + totalNetFlow / 100);
      reasoning.push(`Net exchange inflows: ${totalNetFlow.toFixed(0)} BTC (depositing to sell)`);
    } else {
      reasoning.push('Exchange flows balanced - no clear whale direction');
    }
    
    // Add miner position analysis
    if (this.onChainMetrics) {
      if (this.onChainMetrics.minerPosition === 'selling') {
        reasoning.push('⚠️ Miners are selling (revenue pressure)');
        if (pressure === 'buying') {
          strength -= 15;
          reasoning.push('Miner selling offsetting whale accumulation');
        } else if (pressure === 'selling') {
          strength += 10;
          reasoning.push('Miner selling adding to distribution pressure');
        }
      } else if (this.onChainMetrics.minerPosition === 'accumulating') {
        reasoning.push('✅ Miners are accumulating (strong hands)');
        if (pressure === 'buying') {
          strength += 10;
        }
      }
      
      // Illiquid supply analysis
      if (this.onChainMetrics.illiquidSupply > 0.75) {
        reasoning.push(`High illiquid supply (${(this.onChainMetrics.illiquidSupply * 100).toFixed(1)}%) - strong hodling`);
      }
    }
    
    return { pressure, strength: Math.round(strength), signals: activeSignals, reasoning };
  }
  
  async refreshData(): Promise<void> {
    // Fetch latest data
    const flows = await this.fetchExchangeFlows();
    for (const flow of flows) {
      this.exchanges.set(flow.exchange, flow);
    }
    
    this.onChainMetrics = await this.fetchOnChainMetrics();
    
    // Analyze and generate signals
    const analysis = this.analyzeWhalePressure();
    this.signals = analysis.signals;
  }
  
  getWhaleSummary(): {
    pressure: string;
    strength: number;
    totalOutflows: number;
    totalInflows: number;
    netFlow: number;
    recentSignals: number;
  } {
    let totalOutflows = 0;
    let totalInflows = 0;
    
    for (const flow of this.exchanges.values()) {
      if (flow.netFlow < 0) totalOutflows += Math.abs(flow.netFlow);
      else totalInflows += flow.netFlow;
    }
    
    const analysis = this.analyzeWhalePressure();
    
    return {
      pressure: analysis.pressure,
      strength: analysis.strength,
      totalOutflows,
      totalInflows,
      netFlow: totalOutflows - totalInflows,
      recentSignals: this.signals.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL SENTIMENT ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

interface SentimentSource {
  name: string;
  weight: number;
}

interface SentimentData {
  bullish: number;
  bearish: number;
  neutral: number;
  volume: number;          // Number of posts/mentions
  engagement: number;        // Likes, shares, comments
  timestamp: number;
}

export class SocialSentimentAnalyzer {
  private sources: Map<string, SentimentData> = new Map();
  private history: Array<{ timestamp: number; overall: number }> = [];
  
  // Source weights (based on reliability/historical accuracy)
  private sourceWeights: Map<string, number> = new Map([
    ['twitter', 0.30],
    ['reddit', 0.25],
    ['4chan_biz', 0.05],
    ['youtube', 0.15],
    ['news', 0.25],
  ]);
  
  // Fetch sentiment from different sources (simulated)
  async fetchSentiment(): Promise<void> {
    const sources = ['twitter', 'reddit', 'news'];
    
    for (const source of sources) {
      // Simulate API call
      const bullish = Math.random() * 100;
      const bearish = Math.random() * 100;
      const neutral = 100 - bullish - bearish;
      
      this.sources.set(source, {
        bullish,
        bearish,
        neutral: Math.max(0, neutral),
        volume: Math.floor(Math.random() * 10000),
        engagement: Math.floor(Math.random() * 50000),
        timestamp: Date.now(),
      });
    }
  }
  
  calculateOverallSentiment(): {
    score: number;        // -100 to 100 (negative = bearish)
    confidence: number;   // 0-100
    trend: 'improving' | 'worsening' | 'stable';
    extreme: 'greed' | 'fear' | 'neutral';
    reasoning: string[];
  } {
    let weightedBullish = 0;
    let weightedBearish = 0;
    let totalWeight = 0;
    const reasoning: string[] = [];
    
    for (const [source, data] of this.sources) {
      const weight = this.sourceWeights.get(source) || 0.2;
      
      weightedBullish += data.bullish * weight;
      weightedBearish += data.bearish * weight;
      totalWeight += weight;
      
      const sourceSentiment = data.bullish > data.bearish ? 'bullish' : 'bearish';
      const strength = Math.abs(data.bullish - data.bearish);
      
      if (strength > 30) {
        reasoning.push(`${source}: ${sourceSentiment.toUpperCase()} (${strength.toFixed(0)}% margin)`);
      }
    }
    
    // Normalize
    weightedBullish /= totalWeight;
    weightedBearish /= totalWeight;
    
    // Calculate score (-100 to 100)
    const score = ((weightedBullish - weightedBearish) / (weightedBullish + weightedBearish)) * 100;
    
    // Confidence based on volume and agreement
    const totalVolume = Array.from(this.sources.values()).reduce((sum, s) => sum + s.volume, 0);
    const agreement = Math.abs(weightedBullish - weightedBearish);
    const confidence = Math.min(100, (totalVolume / 1000) * 10 + agreement * 0.5);
    
    // Determine trend
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (this.history.length > 0) {
      const lastSentiment = this.history[this.history.length - 1].overall;
      const change = score - lastSentiment;
      
      if (change > 10) trend = 'improving';
      else if (change < -10) trend = 'worsening';
    }
    
    // Determine extreme
    let extreme: 'greed' | 'fear' | 'neutral' = 'neutral';
    if (score > 60) {
      extreme = 'greed';
      reasoning.push('⚠️ Extreme greed detected - potential top signal');
    } else if (score < -60) {
      extreme = 'fear';
      reasoning.push('✅ Extreme fear detected - potential bottom signal');
    }
    
    // Store in history
    this.history.push({ timestamp: Date.now(), overall: score });
    if (this.history.length > 100) this.history.shift();
    
    return { score: Math.round(score), confidence: Math.round(confidence), trend, extreme, reasoning };
  }
  
  // Detect sentiment divergences (price vs sentiment)
  detectDivergence(currentPrice: number, priceHistory: number[]): {
    divergence: 'bullish' | 'bearish' | 'none';
    strength: number;
    description: string;
  } {
    if (this.history.length < 10 || priceHistory.length < 10) {
      return { divergence: 'none', strength: 0, description: 'Insufficient data' };
    }
    
    const recentSentiment = this.history.slice(-10).map(h => h.overall);
    const recentPrices = priceHistory.slice(-10);
    
    // Check for divergence
    const sentimentTrend = recentSentiment[recentSentiment.length - 1] - recentSentiment[0];
    const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[0];
    const priceTrendPct = priceTrend / recentPrices[0];
    
    // Bullish divergence: price down, sentiment up
    if (priceTrendPct < -0.05 && sentimentTrend > 10) {
      return {
        divergence: 'bullish',
        strength: Math.abs(sentimentTrend),
        description: 'Price declining but sentiment improving - bullish divergence',
      };
    }
    
    // Bearish divergence: price up, sentiment down
    if (priceTrendPct > 0.05 && sentimentTrend < -10) {
      return {
        divergence: 'bearish',
        strength: Math.abs(sentimentTrend),
        description: 'Price rising but sentiment declining - bearish divergence',
      };
    }
    
    return { divergence: 'none', strength: 0, description: 'No significant divergence' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED MARKET INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketIntelligence {
  timestamp: number;
  
  // Whale activity
  whalePressure: 'buying' | 'selling' | 'neutral';
  whaleStrength: number;
  exchangeFlows: ExchangeFlow[];
  
  // On-chain
  onChainMetrics: OnChainMetrics | null;
  
  // Sentiment
  sentimentScore: number;
  sentimentConfidence: number;
  sentimentTrend: string;
  sentimentExtreme: string;
  
  // Combined signal
  overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  signalConfidence: number;
  
  // Key alerts
  alerts: string[];
}

export async function getMarketIntelligence(): Promise<MarketIntelligence> {
  const whaleMonitor = new WhaleMonitor();
  const sentimentAnalyzer = new SocialSentimentAnalyzer();
  
  await whaleMonitor.refreshData();
  await sentimentAnalyzer.fetchSentiment();
  
  const whaleAnalysis = whaleMonitor.analyzeWhalePressure();
  const sentiment = sentimentAnalyzer.calculateOverallSentiment();
  
  // Combine signals
  let overallSignal: MarketIntelligence['overallSignal'] = 'neutral';
  let signalConfidence = 50;
  const alerts: string[] = [];
  
  // Whale + Sentiment consensus
  if (whaleAnalysis.pressure === 'buying' && sentiment.score > 20) {
    overallSignal = whaleAnalysis.strength > 70 ? 'strong_buy' : 'buy';
    signalConfidence = (whaleAnalysis.strength + sentiment.confidence) / 2;
  } else if (whaleAnalysis.pressure === 'selling' && sentiment.score < -20) {
    overallSignal = whaleAnalysis.strength > 70 ? 'strong_sell' : 'sell';
    signalConfidence = (whaleAnalysis.strength + sentiment.confidence) / 2;
  }
  
  // Contrarian alerts
  if (whaleAnalysis.pressure === 'buying' && sentiment.score < -40) {
    alerts.push('Whales accumulating despite extreme fear - potential bottom');
  } else if (whaleAnalysis.pressure === 'selling' && sentiment.score > 60) {
    alerts.push('Whales distributing into greed - potential top');
  }
  
  // Large flow alerts
  if (Math.abs(whaleAnalysis.signals.length) > 3) {
    alerts.push('High whale activity detected - increased volatility likely');
  }
  
  return {
    timestamp: Date.now(),
    whalePressure: whaleAnalysis.pressure,
    whaleStrength: whaleAnalysis.strength,
    exchangeFlows: Array.from(whaleMonitor['exchanges'].values()),
    onChainMetrics: whaleMonitor['onChainMetrics'],
    sentimentScore: sentiment.score,
    sentimentConfidence: sentiment.confidence,
    sentimentTrend: sentiment.trend,
    sentimentExtreme: sentiment.extreme,
    overallSignal,
    signalConfidence,
    alerts,
  };
}  
