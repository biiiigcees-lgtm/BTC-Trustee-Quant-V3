import { MarketRegime, Timeframe } from './god-tier-prediction';

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED RISK MANAGEMENT ENGINE — Institutional-Grade Position Sizing
// ═══════════════════════════════════════════════════════════════════════════

export interface RiskProfile {
  maxDrawdown: number;        // Maximum acceptable drawdown (e.g., 0.10 = 10%)
  targetVolatility: number;   // Target annualized volatility (e.g., 0.20 = 20%)
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'extreme';
  maxPositionSize: number;    // Max % of portfolio in single position
  maxPositions: number;       // Max concurrent positions
  minKellyFraction: number;   // Minimum Kelly criterion fraction to use
  useStopLoss: boolean;
  useTakeProfit: boolean;
  trailingStop: boolean;
}

export interface PositionRisk {
  positionId: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  positionSize: number;       // In base currency
  positionValue: number;      // In USD
  portfolioPct: number;       // % of total portfolio
  
  // Risk metrics
  stopLoss: number;
  takeProfit: number;
  trailingStopPrice: number | null;
  riskAmount: number;         // USD at risk
  potentialProfit: number;    // USD potential gain
  riskRewardRatio: number;
  
  // Advanced metrics
  var95: number;              // Value at Risk (95% confidence)
  var99: number;              // Value at Risk (99% confidence)
  expectedShortfall: number;  // Conditional VaR
  maxAdverseExcursion: number; // Worst price movement since entry
  
  // Greeks (for options)
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  
  // Status
  status: 'open' | 'closed' | 'liquidated';
  unrealizedPnl: number;
  realizedPnl: number;
  openedAt: number;
  closedAt?: number;
}

export interface PortfolioRisk {
  totalValue: number;
  availableCash: number;
  marginUsed: number;
  marginAvailable: number;
  
  // Exposure
  grossExposure: number;      // Sum of all position values
  netExposure: number;        // Long - Short
  beta: number;               // Market correlation
  
  // Risk metrics
  portfolioVar95: number;
  portfolioVar99: number;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  
  // Concentration
  top5Concentration: number;  // % in top 5 positions
  sectorExposure: Map<string, number>;
  
  // Stress test
  stressTestResults: Map<string, number>; // Scenario -> PnL
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT RISK PROFILES
// ═══════════════════════════════════════════════════════════════════════════

export const RISK_PROFILES: Record<string, RiskProfile> = {
  conservative: {
    maxDrawdown: 0.05,
    targetVolatility: 0.10,
    riskTolerance: 'conservative',
    maxPositionSize: 0.05,
    maxPositions: 10,
    minKellyFraction: 0.15,
    useStopLoss: true,
    useTakeProfit: true,
    trailingStop: true,
  },
  moderate: {
    maxDrawdown: 0.10,
    targetVolatility: 0.20,
    riskTolerance: 'moderate',
    maxPositionSize: 0.10,
    maxPositions: 15,
    minKellyFraction: 0.25,
    useStopLoss: true,
    useTakeProfit: true,
    trailingStop: true,
  },
  aggressive: {
    maxDrawdown: 0.20,
    targetVolatility: 0.35,
    riskTolerance: 'aggressive',
    maxPositionSize: 0.20,
    maxPositions: 20,
    minKellyFraction: 0.40,
    useStopLoss: true,
    useTakeProfit: true,
    trailingStop: false,
  },
  extreme: {
    maxDrawdown: 0.35,
    targetVolatility: 0.50,
    riskTolerance: 'extreme',
    maxPositionSize: 0.35,
    maxPositions: 25,
    minKellyFraction: 0.60,
    useStopLoss: false,
    useTakeProfit: true,
    trailingStop: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// KELLY CRITERION WITH FRACTIONAL MODIFICATION
// ═══════════════════════════════════════════════════════════════════════════

interface KellyParams {
  winProbability: number;
  winAmount: number;        // Average win as multiple of stake
  lossAmount: number;       // Average loss as multiple of stake
  kellyFraction: number;    // Fractional Kelly (0.25 = Quarter Kelly)
}

export function calculateKelly({ winProbability, winAmount, lossAmount, kellyFraction }: KellyParams): {
  fullKelly: number;
  fractionalKelly: number;
  edge: number;
} {
  // Kelly formula: f* = (p * b - q) / b
  // where p = win probability, q = loss probability, b = win/loss ratio
  const lossProbability = 1 - winProbability;
  const b = winAmount / lossAmount;
  
  const edge = winProbability * b - lossProbability;
  const fullKelly = edge / b;
  
  // Fractional Kelly for safety
  const fractionalKelly = Math.max(0, fullKelly * kellyFraction);
  
  return { fullKelly, fractionalKelly, edge };
}

export function calculateOptimalPositionSize(
  portfolioValue: number,
  confidence: number,
  ev: number,
  regime: MarketRegime,
  riskProfile: RiskProfile,
  volatility: number
): {
  positionSize: number;
  positionPct: number;
  kellyUsed: number;
  reasoning: string[];
} {
  const reasoning: string[] = [];
  
  // Base Kelly calculation
  const winProbability = confidence / 100;
  const winAmount = 0.85;  // Typical binary payout
  const lossAmount = 1.0;
  
  const { fullKelly, fractionalKelly, edge } = calculateKelly({
    winProbability,
    winAmount,
    lossAmount,
    kellyFraction: riskProfile.minKellyFraction,
  });
  
  reasoning.push(`Full Kelly: ${(fullKelly * 100).toFixed(2)}%, Fractional (${riskProfile.minKellyFraction * 100}% Kelly): ${(fractionalKelly * 100).toFixed(2)}%`);
  
  let positionPct = fractionalKelly;
  
  // Regime-based adjustment
  const regimeMultipliers: Record<MarketRegime, number> = {
    'strong_uptrend': 1.2,
    'weak_uptrend': 1.0,
    'ranging': 0.7,
    'weak_downtrend': 1.0,
    'strong_downtrend': 1.2,
    'high_volatility': 0.5,
    'low_volatility': 1.1,
    'breakout': 0.8,
    'reversal': 0.6,
  };
  
  const regimeMultiplier = regimeMultipliers[regime] || 1.0;
  positionPct *= regimeMultiplier;
  
  if (regimeMultiplier !== 1.0) {
    reasoning.push(`${regime}: ${regimeMultiplier > 1 ? '+' : ''}${((regimeMultiplier - 1) * 100).toFixed(0)}% regime adjustment`);
  }
  
  // Volatility adjustment
  const targetVol = riskProfile.targetVolatility;
  const volMultiplier = Math.min(1.5, targetVol / (volatility * Math.sqrt(365)));
  positionPct *= volMultiplier;
  
  reasoning.push(`Volatility: ${(volatility * 100).toFixed(2)}%, multiplier: ${volMultiplier.toFixed(2)}`);
  
  // Edge quality adjustment
  if (edge < 0) {
    positionPct = 0;
    reasoning.push('No edge detected - position size set to 0');
  } else if (edge < 0.05) {
    positionPct *= 0.5;
    reasoning.push('Small edge (-50% size)');
  } else if (edge > 0.15) {
    positionPct *= 1.2;
    reasoning.push('Strong edge (+20% size)');
  }
  
  // Apply maximum position limit
  const maxPosition = riskProfile.maxPositionSize;
  if (positionPct > maxPosition) {
    positionPct = maxPosition;
    reasoning.push(`Capped at max position size (${(maxPosition * 100).toFixed(1)}%)`);
  }
  
  // Minimum position check (don't trade if too small)
  if (positionPct < 0.01) {
    positionPct = 0;
    reasoning.push('Position too small (<1%), skipping trade');
  }
  
  const positionSize = portfolioValue * positionPct;
  
  return { positionSize, positionPct, kellyUsed: fractionalKelly, reasoning };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALUE AT RISK (VaR) CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

interface VaRParams {
  positionValue: number;
  volatility: number;       // Daily volatility
  confidence: number;       // 0.95 or 0.99
  timeHorizon: number;      // Days
}

export function calculateVaR(params: VaRParams): number {
  const { positionValue, volatility, confidence, timeHorizon } = params;
  
  // Z-scores for confidence levels
  const zScores: Record<number, number> = {
    0.90: 1.28,
    0.95: 1.645,
    0.99: 2.33,
  };
  
  const z = zScores[confidence] || 1.645;
  
  // VaR = Position Value × Z × Volatility × √Time
  const var_ = positionValue * z * volatility * Math.sqrt(timeHorizon);
  
  return var_;
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAWDOWN AND STRESS TESTING
// ═══════════════════════════════════════════════════════════════════════════

export function calculateMaxDrawdown(equityCurve: number[]): {
  maxDrawdown: number;
  maxDrawdownPct: number;
  startIndex: number;
  endIndex: number;
  recoveryTime: number;
} {
  let peak = equityCurve[0];
  let trough = equityCurve[0];
  let maxDD = 0;
  let peakIndex = 0;
  let troughIndex = 0;
  let ddStart = 0;
  let ddEnd = 0;
  
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      peakIndex = i;
    }
    
    if (equityCurve[i] < trough) {
      trough = equityCurve[i];
      troughIndex = i;
    }
    
    const drawdown = peak - equityCurve[i];
    if (drawdown > maxDD) {
      maxDD = drawdown;
      ddStart = peakIndex;
      ddEnd = i;
    }
  }
  
  // Calculate recovery time
  let recoveryTime = 0;
  for (let i = ddEnd; i < equityCurve.length; i++) {
    if (equityCurve[i] >= equityCurve[ddStart]) {
      recoveryTime = i - ddEnd;
      break;
    }
  }
  
  return {
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDD / peak,
    startIndex: ddStart,
    endIndex: ddEnd,
    recoveryTime,
  };
}

// Stress test scenarios
export const STRESS_SCENARIOS = {
  'Market Crash (-20%)': -0.20,
  'Sharp Correction (-10%)': -0.10,
  'Flash Crash (-30%)': -0.30,
  'Bear Market (-50%)': -0.50,
  'Volatility Spike (+50%)': 0.0, // Special handling
  'Liquidity Crisis': -0.15,
};

export function runStressTest(
  positions: PositionRisk[],
  portfolioValue: number,
  correlations: Map<string, number> // Symbol -> market correlation
): Map<string, number> {
  const results = new Map<string, number>();
  
  for (const [scenario, marketMove] of Object.entries(STRESS_SCENARIOS)) {
    let totalPnl = 0;
    
    for (const position of positions) {
      if (scenario === 'Volatility Spike (+50%)') {
        // Volatility affects option prices (simplified)
        const volImpact = position.vega ? position.vega * 0.5 : 0;
        totalPnl += volImpact * position.positionSize;
      } else {
        // Linear approximation with beta
        const correlation = correlations.get(position.symbol) || 0.7;
        const positionMove = marketMove * correlation * (position.direction === 'long' ? 1 : -1);
        const pnl = position.positionValue * positionMove;
        totalPnl += pnl;
      }
    }
    
    results.set(scenario, totalPnl);
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTFOLIO OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════

interface AssetReturns {
  symbol: string;
  expectedReturn: number;
  volatility: number;
}

// Simplified mean-variance optimization
export function optimizePortfolio(
  assets: AssetReturns[],
  targetReturn: number,
  riskProfile: RiskProfile
): {
  weights: Map<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
} {
  // This is a simplified version - real implementation would use quadratic programming
  const n = assets.length;
  
  // Equal risk contribution as simple heuristic
  const inverseVol = assets.map(a => 1 / a.volatility);
  const sumInverseVol = inverseVol.reduce((a, b) => a + b, 0);
  
  const weights = new Map<string, number>();
  let totalWeight = 0;
  
  for (let i = 0; i < n; i++) {
    const weight = (inverseVol[i] / sumInverseVol);
    weights.set(assets[i].symbol, weight);
    totalWeight += weight;
  }
  
  // Normalize
  for (const [symbol, weight] of weights) {
    weights.set(symbol, weight / totalWeight);
  }
  
  // Calculate portfolio metrics
  let expectedReturn = 0;
  let expectedVariance = 0;
  
  for (let i = 0; i < n; i++) {
    const w1 = weights.get(assets[i].symbol) || 0;
    expectedReturn += w1 * assets[i].expectedReturn;
    expectedVariance += Math.pow(w1 * assets[i].volatility, 2);
  }
  
  const expectedVolatility = Math.sqrt(expectedVariance);
  const sharpeRatio = expectedReturn / expectedVolatility;
  
  return { weights, expectedReturn, expectedVolatility, sharpeRatio };
}

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME RISK MONITORING
// ═══════════════════════════════════════════════════════════════════════════

export class RealTimeRiskMonitor {
  private positions: Map<string, PositionRisk> = new Map();
  private portfolioValue: number = 0;
  private riskProfile: RiskProfile;
  private alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical'; timestamp: number }> = [];
  
  constructor(riskProfile: RiskProfile) {
    this.riskProfile = riskProfile;
  }
  
  updatePortfolioValue(value: number): void {
    this.portfolioValue = value;
    this.checkRiskLimits();
  }
  
  addPosition(position: PositionRisk): void {
    this.positions.set(position.positionId, position);
    this.checkRiskLimits();
  }
  
  updatePosition(positionId: string, updates: Partial<PositionRisk>): void {
    const position = this.positions.get(positionId);
    if (position) {
      Object.assign(position, updates);
      this.positions.set(positionId, position);
      this.checkPositionRisk(position);
    }
  }
  
  closePosition(positionId: string): void {
    this.positions.delete(positionId);
  }
  
  private checkRiskLimits(): void {
    const totalExposure = Array.from(this.positions.values())
      .reduce((sum, p) => sum + p.positionValue, 0);
    
    const exposurePct = totalExposure / this.portfolioValue;
    
    if (exposurePct > 1.5) {
      this.alerts.push({
        type: 'exposure',
        message: `High exposure: ${(exposurePct * 100).toFixed(1)}%`,
        severity: 'warning',
        timestamp: Date.now(),
      });
    }
    
    if (exposurePct > 2.0) {
      this.alerts.push({
        type: 'exposure',
        message: `Critical exposure: ${(exposurePct * 100).toFixed(1)}%`,
        severity: 'critical',
        timestamp: Date.now(),
      });
    }
    
    // Check concentration
    const sortedPositions = Array.from(this.positions.values())
      .sort((a, b) => b.positionValue - a.positionValue);
    
    const top5Value = sortedPositions.slice(0, 5)
      .reduce((sum, p) => sum + p.positionValue, 0);
    const top5Pct = top5Value / totalExposure;
    
    if (top5Pct > 0.8) {
      this.alerts.push({
        type: 'concentration',
        message: `High concentration: Top 5 = ${(top5Pct * 100).toFixed(1)}%`,
        severity: 'warning',
        timestamp: Date.now(),
      });
    }
  }
  
  private checkPositionRisk(position: PositionRisk): void {
    // Check if position exceeds max size
    const positionPct = position.positionValue / this.portfolioValue;
    if (positionPct > this.riskProfile.maxPositionSize * 1.1) {
      this.alerts.push({
        type: 'position_size',
        message: `Position ${position.positionId} exceeds max size: ${(positionPct * 100).toFixed(1)}%`,
        severity: 'critical',
        timestamp: Date.now(),
      });
    }
    
    // Check drawdown from entry
    const currentPrice = position.entryPrice + position.unrealizedPnl / position.positionSize;
    const drawdown = position.direction === 'long' 
      ? (position.entryPrice - currentPrice) / position.entryPrice
      : (currentPrice - position.entryPrice) / currentPrice;
    
    if (drawdown > 0.10) { // 10% drawdown
      this.alerts.push({
        type: 'drawdown',
        message: `Position ${position.positionId} drawdown: ${(drawdown * 100).toFixed(1)}%`,
        severity: 'warning',
        timestamp: Date.now(),
      });
    }
  }
  
  getRiskReport(): {
    portfolioValue: number;
    totalExposure: number;
    netExposure: number;
    var95: number;
    var99: number;
    positions: number;
    alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical'; timestamp: number }>;
  } {
    const positions = Array.from(this.positions.values());
    const totalExposure = positions.reduce((sum, p) => sum + p.positionValue, 0);
    const netExposure = positions.reduce((sum, p) => 
      sum + (p.direction === 'long' ? p.positionValue : -p.positionValue), 0);
    
    // Simplified VaR calculation
    const portfolioVolatility = 0.02; // 2% daily vol assumption
    const var95 = this.portfolioValue * 1.645 * portfolioVolatility;
    const var99 = this.portfolioValue * 2.33 * portfolioVolatility;
    
    return {
      portfolioValue: this.portfolioValue,
      totalExposure,
      netExposure,
      var95,
      var99,
      positions: positions.length,
      alerts: this.alerts.slice(-20), // Last 20 alerts
    };
  }
  
  clearAlerts(): void {
    this.alerts = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function formatRiskReport(report: PortfolioRisk): string {
  const lines = [
    '═══════════════════════════════════════════════════',
    '           PORTFOLIO RISK REPORT                   ',
    '═══════════════════════════════════════════════════',
    '',
    `Portfolio Value:     $${report.totalValue.toLocaleString()}`,
    `Available Cash:      $${report.availableCash.toLocaleString()}`,
    `Margin Used:         $${report.marginUsed.toLocaleString()}`,
    '',
    'EXPOSURE',
    `Gross Exposure:      $${report.grossExposure.toLocaleString()}`,
    `Net Exposure:        $${report.netExposure.toLocaleString()}`,
    `Beta:                ${report.beta.toFixed(2)}`,
    '',
    'RISK METRICS',
    `VaR (95%):           $${report.portfolioVar95.toLocaleString()}`,
    `VaR (99%):           $${report.portfolioVar99.toLocaleString()}`,
    `Expected Return:     ${(report.expectedReturn * 100).toFixed(2)}%`,
    `Volatility:          ${(report.volatility * 100).toFixed(2)}%`,
    `Sharpe Ratio:        ${report.sharpeRatio.toFixed(2)}`,
    `Max Drawdown:        ${(report.maxDrawdown * 100).toFixed(2)}%`,
    '',
    'CONCENTRATION',
    `Top 5 Holdings:      ${(report.top5Concentration * 100).toFixed(1)}%`,
    '',
    'STRESS TEST',
    ...Array.from(report.stressTestResults.entries()).map(([scenario, pnl]) => 
      `${scenario.padEnd(20)} ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}`
    ),
    '═══════════════════════════════════════════════════',
  ];
  
  return lines.join('\n');
}  
