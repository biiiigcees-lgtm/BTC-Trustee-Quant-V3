import { NextRequest, NextResponse } from 'next/server';
import { generateGodTierPrediction, Timeframe, TimeframeData, MarketRegime } from '../../../lib/god-tier-prediction';
import { getOptimizedWeights, processLearningUpdate, getCalibrationAdjustment } from '../../../lib/reinforcement-learning';
import { calculateOptimalPositionSize, RiskProfile, RISK_PROFILES } from '../../../lib/advanced-risk';
import { getMarketIntelligence, MarketIntelligence } from '../../../lib/whale-monitor';
import { savePrediction } from '../../../lib/db/client';
import { createLogger, trackPrediction } from '../../../lib/observability';
import { optimizeForProfitability, recordTradeResult, SetupParams } from '../../../lib/profitability-engine';

// ═══════════════════════════════════════════════════════════════════════════
// GOD TIER PREDICTION API — Ultimate Trading Intelligence Endpoint
// ═══════════════════════════════════════════════════════════════════════════

const logger = createLogger('GodTierPredict');

interface GodTierRequest {
  symbol: string;
  currentPrice: number;
  strikePrice: number;
  expirySeconds: number;
  portfolioValue?: number;
  riskProfile?: 'conservative' | 'moderate' | 'aggressive' | 'extreme';
  
  // Timeframe data
  timeframes: {
    [key in Timeframe]?: {
      ema9: number;
      ema21: number;
      rsi: number;
      macd: { macd: number; signal: number; histogram: number };
      bb: { upper: number; middle: number; lower: number; pctB: number };
      atr: number;
      volume: number;
      closes: number[];
    };
  };
  
  // Additional context
  fundingRate?: number;
  fearGreed?: number;
  openInterest?: number;
  liquidationData?: {
    longLiquidations: number;
    shortLiquidations: number;
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: GodTierRequest = await req.json();
    
    // Validate required fields
    if (!body.symbol || !body.currentPrice || !body.strikePrice || !body.expirySeconds) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, currentPrice, strikePrice, expirySeconds' },
        { status: 400 }
      );
    }
    
    logger.info('God Tier prediction request', { 
      symbol: body.symbol, 
      price: body.currentPrice,
      strike: body.strikePrice,
    });
    
    // Convert timeframe data to Map
    const timeframes = new Map<Timeframe, TimeframeData>();
    for (const [tf, data] of Object.entries(body.timeframes)) {
      if (data) {
        timeframes.set(tf as Timeframe, {
          timeframe: tf as Timeframe,
          ema9: data.ema9,
          ema21: data.ema21,
          rsi: data.rsi,
          macd: data.macd,
          bb: data.bb,
          atr: data.atr,
          volume: data.volume,
          trendStrength: Math.abs(data.ema9 - data.ema21) / data.ema21 * 100,
          price: body.currentPrice,
          closes: data.closes,
        });
      }
    }
    
    // Get market intelligence (whale activity, sentiment, on-chain)
    const marketIntel = await getMarketIntelligence();
    
    // Generate God Tier prediction
    const prediction = await generateGodTierPrediction({
      symbol: body.symbol,
      currentPrice: body.currentPrice,
      strikePrice: body.strikePrice,
      timeToExpiry: body.expirySeconds,
      timeframes,
      portfolioValue: body.portfolioValue || 10000,
      riskTolerance: (body.riskProfile === 'extreme' ? 'aggressive' : body.riskProfile) || 'moderate',
    });
    
    // Apply reinforcement learning weights
    const optimizedWeights = await getOptimizedWeights(prediction.regime, Array.from(prediction.aiWeights.keys()));
    
    // Apply calibration adjustment
    const calibrationAdj = getCalibrationAdjustment(prediction.confidence);
    const adjustedConfidence = Math.max(50, Math.min(99, prediction.confidence + calibrationAdj));
    
    // Calculate optimal position sizing
    const riskProfile = RISK_PROFILES[body.riskProfile || 'moderate'];
    const volatility = prediction.multiTimeframe.timeframes.get(Timeframe.M15)?.atr || 100;
    const volatilityPct = volatility / body.currentPrice;
    
    const positionSizing = calculateOptimalPositionSize(
      body.portfolioValue || 10000,
      adjustedConfidence,
      prediction.ev,
      prediction.regime,
      riskProfile,
      volatilityPct
    );
    
    // Apply profitability optimization for maximum win rate and profit
    const now = new Date();
    const profitOptimization = optimizeForProfitability({
      confidence: adjustedConfidence,
      ev: prediction.ev,
      kelly: prediction.kelly,
      confluenceScore: prediction.multiTimeframe.confluenceScore,
      regime: prediction.regime,
      timeframeAlignment: prediction.multiTimeframe.alignment,
      momentumFlow: prediction.multiTimeframe.momentumFlow,
      divergence: prediction.divergence,
      whalePressure: marketIntel.whalePressure,
      sentimentScore: marketIntel.sentimentScore,
      timeToExpiry: body.expirySeconds,
      volatility: volatilityPct,
      distanceFromStrike: Math.abs(body.currentPrice - body.strikePrice) / body.strikePrice,
      recentWinRate: 0.6, // Would be fetched from DB
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      portfolioValue: body.portfolioValue || 10000,
      entryPrice: body.currentPrice,
      targetPrice: body.strikePrice,
      stopLoss: prediction.stopLoss,
      exchange: 'kalshi',
    });
    
    // Incorporate market intelligence
    let finalVerdict = prediction.verdict;
    let finalConfidence = adjustedConfidence;
    const intelReasoning: string[] = [];
    
    // Override with profitability-optimized values
    if (!profitOptimization.shouldTrade) {
      finalVerdict = 'PASS';
      intelReasoning.push(`PASS: Setup graded ${profitOptimization.setupGrade} — insufficient quality`);
    } else {
      finalConfidence = profitOptimization.optimizedConfidence;
    }
    
    // Adjust based on whale pressure
    if (marketIntel.whalePressure === 'buying' && prediction.verdict === 'ABOVE') {
      finalConfidence = Math.min(99, finalConfidence + 5);
      intelReasoning.push('+5% whale accumulation aligned with prediction');
    } else if (marketIntel.whalePressure === 'selling' && prediction.verdict === 'BELOW') {
      finalConfidence = Math.min(99, finalConfidence + 5);
      intelReasoning.push('+5% whale distribution aligned with prediction');
    } else if (marketIntel.whalePressure !== 'neutral' && prediction.verdict !== 'PASS') {
      finalConfidence = Math.max(50, finalConfidence - 3);
      intelReasoning.push('-3% whale activity contradicts prediction');
    }
    
    // Adjust based on sentiment
    if (marketIntel.sentimentScore > 40 && prediction.verdict === 'ABOVE') {
      finalConfidence = Math.min(99, finalConfidence + 3);
      intelReasoning.push('+3% bullish sentiment aligned');
    } else if (marketIntel.sentimentScore < -40 && prediction.verdict === 'BELOW') {
      finalConfidence = Math.min(99, finalConfidence + 3);
      intelReasoning.push('+3% bearish sentiment aligned');
    }
    
    // Apply confidence threshold
    if (finalConfidence < 55) {
      finalVerdict = 'PASS';
      intelReasoning.push('PASS: Confidence below 55% threshold');
    }
    
    // Recalculate EV and Kelly with adjusted confidence
    const winProb = finalConfidence / 100;
    const loseProb = 1 - winProb;
    const payout = 1.85;
    const finalEv = Math.round((winProb * payout - loseProb) * 100);
    const finalKelly = Math.max(0, (winProb * payout - loseProb) / payout * 100);
    
    // Build comprehensive response
    const latency = Date.now() - startTime;
    
    const response = {
      // Core prediction
      verdict: finalVerdict,
      confidence: finalConfidence,
      ev: finalEv,
      kelly: finalKelly,
      
      // IDs
      predictionId: prediction.predictionId,
      timestamp: Date.now(),
      latency,
      
      // Multi-timeframe analysis
      multiTimeframe: {
        alignment: prediction.multiTimeframe.alignment,
        confluenceScore: prediction.multiTimeframe.confluenceScore,
        dominantTrend: prediction.multiTimeframe.dominantTrend,
        momentumFlow: prediction.multiTimeframe.momentumFlow,
        timeframeWeights: Object.fromEntries(prediction.timeframeWeights),
      },
      
      // Market regime
      regime: prediction.regime,
      regimeConfidence: prediction.regimeConfidence,
      expectedAccuracy: prediction.expectedAccuracy,
      
      // AI weighting
      aiWeights: Object.fromEntries(optimizedWeights.weights),
      weightReasoning: optimizedWeights.reasoning,
      explorationRate: optimizedWeights.explorationRate,
      
      // Position sizing
      positionSizing: {
        recommendedSize: positionSizing.positionSize,
        portfolioPct: positionSizing.positionPct,
        kellyUsed: positionSizing.kellyUsed,
        reasoning: positionSizing.reasoning,
      },
      
      // Entry strategy
      entryStrategy: {
        timing: prediction.entryTiming,
        optimalEntryPrice: prediction.optimalEntryPrice,
        stopLoss: prediction.stopLoss,
        takeProfit: prediction.takeProfit,
        riskReward: prediction.riskReward,
        timeDecayRisk: prediction.timeDecayRisk,
      },
      
      // Technical analysis
      technical: {
        divergence: prediction.divergence,
        supportLevels: prediction.supportResistance.support.slice(0, 3),
        resistanceLevels: prediction.supportResistance.resistance.slice(0, 3),
        liquidityZones: prediction.liquidityZones,
        keyFactors: prediction.keyFactors,
      },
      
      // Market intelligence
      marketIntelligence: {
        whalePressure: marketIntel.whalePressure,
        whaleStrength: marketIntel.whaleStrength,
        sentimentScore: marketIntel.sentimentScore,
        sentimentTrend: marketIntel.sentimentTrend,
        overallSignal: marketIntel.overallSignal,
        signalConfidence: marketIntel.signalConfidence,
        alerts: marketIntel.alerts,
      },
      
      // Profitability optimization
      profitability: {
        setupGrade: profitOptimization.setupGrade,
        setupScore: profitOptimization.setupScore,
        shouldTrade: profitOptimization.shouldTrade,
        originalConfidence: profitOptimization.originalConfidence,
        confidenceMultiplier: profitOptimization.positionSize.sizingMultiplier,
        sizingMultiplier: profitOptimization.positionSize.sizingMultiplier,
        streakAdjustment: profitOptimization.positionSize.streakAdjustment,
        correlationAdjustment: profitOptimization.positionSize.correlationAdjustment,
        finalPositionSize: profitOptimization.positionSize.finalSize,
        grossEv: profitOptimization.ev.gross,
        netEv: profitOptimization.ev.afterCosts,
        isProfitable: profitOptimization.ev.isProfitable,
        profitTakingStrategy: profitOptimization.profitTaking.strategy,
        takeProfitLevels: profitOptimization.profitTaking.takeProfitLevels,
        trailingActivation: profitOptimization.profitTaking.trailingActivation,
        warnings: profitOptimization.warnings,
      },
      
      // Combined reasoning
      reasoning: [
        ...prediction.reasoning,
        ...intelReasoning,
        ...marketIntel.alerts,
        ...profitOptimization.reasoning,
        ...profitOptimization.warnings,
      ],
      
      // Meta
      modelVersion: 'god-tier-v1',
      calibrationAdjustment: calibrationAdj,
    };
    
    // Track prediction
    trackPrediction(finalVerdict, Object.keys(response.aiWeights), latency, true);
    
    // Save to database (if configured)
    try {
      await savePrediction({
        predictionId: prediction.predictionId,
        symbol: body.symbol,
        strikePrice: body.strikePrice,
        currentPrice: body.currentPrice,
        expiryLabel: `${Math.floor(body.expirySeconds / 60)}min`,
        secondsToExpiry: body.expirySeconds,
        verdict: finalVerdict,
        confidence: finalConfidence,
        ev: finalEv,
        kelly: finalKelly,
        reasoning: response.reasoning,
        providersUsed: Object.keys(response.aiWeights),
        modelVotes: Object.entries(response.aiWeights).map(([p, w]) => `${p}:${finalVerdict}`),
        modelAgreement: 1, // Simplified for single prediction
        ensembleConfidence: finalConfidence,
        latencyMs: latency,
        trajectory: {
          movesNeeded: undefined,
          velocity: undefined,
          projectedOutcome: finalVerdict,
          momentumDir: prediction.multiTimeframe.momentumFlow,
        },
        indicators: {
          rsi: timeframes.get(Timeframe.M15)?.rsi,
          ema9: timeframes.get(Timeframe.M15)?.ema9,
          ema21: timeframes.get(Timeframe.M15)?.ema21,
          macd: timeframes.get(Timeframe.M15)?.macd,
          bb: timeframes.get(Timeframe.M15)?.bb,
          atr: timeframes.get(Timeframe.M15)?.atr,
        },
        clientIp: (req as any).ip,
        userAgent: req.headers.get('user-agent') || undefined,
      });
    } catch (dbError) {
      logger.warn('Failed to save prediction to database', { error: (dbError as Error).message });
    }
    
    logger.info('God Tier prediction complete', { 
      predictionId: prediction.predictionId,
      verdict: finalVerdict,
      confidence: finalConfidence,
      latency,
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prediction failed';
    logger.error('God Tier prediction error', error as Error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Learning feedback endpoint
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    const update = {
      predictionId: body.predictionId,
      provider: body.provider,
      modelId: body.modelId,
      regime: body.regime as MarketRegime,
      verdict: body.verdict,
      confidence: body.confidence,
      wasCorrect: body.wasCorrect,
      actualOutcome: body.actualOutcome,
      profitLoss: body.profitLoss,
      timeToResolution: body.timeToResolution,
      timestamp: Date.now(),
    };
    
    await processLearningUpdate(update);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Learning update processed',
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'operational',
    version: 'god-tier-v1',
    features: [
      'multi-timeframe-analysis',
      'reinforcement-learning',
      'market-intelligence',
      'advanced-position-sizing',
      'risk-management',
    ],
    timestamp: Date.now(),
  });
}  
