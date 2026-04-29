import { createClient } from '@vercel/postgres';

// Database client singleton
let client: ReturnType<typeof createClient> | null = null;

export function getDbClient() {
  if (!client) {
    client = createClient({
      connectionString: process.env.POSTGRES_URL,
    });
  }
  return client;
}

// Check if database is configured
export function isDbConfigured(): boolean {
  return !!process.env.POSTGRES_URL;
}

// Types for predictions
export interface PredictionRecord {
  predictionId: string;
  symbol: string;
  strikePrice: number;
  currentPrice: number;
  expiryLabel?: string;
  secondsToExpiry?: number;
  verdict: 'ABOVE' | 'BELOW' | 'PASS';
  confidence: number;
  ev?: number;
  kelly?: number;
  reasoning: string[];
  providersUsed: string[];
  modelVotes: string[];
  modelAgreement: number;
  ensembleConfidence: number;
  latencyMs: number;
  trajectory?: {
    movesNeeded?: number;
    velocity?: number;
    projectedOutcome?: string;
    momentumDir?: string;
  };
  indicators?: {
    rsi?: number;
    ema9?: number;
    ema21?: number;
    macd?: { macd: number; signal: number; histogram: number };
    bb?: { upper: number; lower: number; pctB: number };
    atr?: number;
    fundingRate?: number;
    fearGreed?: number;
    marketRegime?: string;
  };
  clientIp?: string;
  userAgent?: string;
}

export interface PredictionOutcome {
  predictionId: string;
  actualOutcome: 'ABOVE' | 'BELOW' | 'EXPIRED';
  finalPrice?: number;
  wasCorrect?: boolean;
  profitLoss?: number;
  resolutionSource: string;
}

// Insert prediction
export async function savePrediction(record: PredictionRecord): Promise<void> {
  if (!isDbConfigured()) {
    console.warn('Database not configured, skipping prediction save');
    return;
  }

  const db = getDbClient();
  
  // Convert arrays to PostgreSQL array format
  const reasoningArray = record.reasoning.length > 0 ? `{${record.reasoning.map(r => `"${r.replace(/"/g, '\"')}"`).join(',')}}` : null;
  const providersArray = record.providersUsed.length > 0 ? `{${record.providersUsed.join(',')}}` : null;
  const votesArray = record.modelVotes.length > 0 ? `{${record.modelVotes.join(',')}}` : null;
  
  try {
    await db.sql`
      INSERT INTO predictions (
        prediction_id, symbol, strike_price, current_price, expiry_label, seconds_to_expiry,
        verdict, confidence, ev, kelly, reasoning, providers_used, model_votes,
        model_agreement, ensemble_confidence, latency_ms,
        moves_needed, velocity, projected_outcome, momentum_dir,
        rsi, ema9, ema21, macd_macd, macd_signal, macd_histogram,
        bb_upper, bb_lower, bb_pctb, atr, funding_rate, fear_greed, market_regime,
        client_ip, user_agent
      ) VALUES (
        ${record.predictionId}, ${record.symbol}, ${record.strikePrice}, ${record.currentPrice},
        ${record.expiryLabel || null}, ${record.secondsToExpiry || null},
        ${record.verdict}, ${record.confidence}, ${record.ev || 0}, ${record.kelly || 0},
        ${reasoningArray}, ${providersArray}, ${votesArray},
        ${record.modelAgreement}, ${record.ensembleConfidence}, ${record.latencyMs},
        ${record.trajectory?.movesNeeded || null}, ${record.trajectory?.velocity || null},
        ${record.trajectory?.projectedOutcome || null}, ${record.trajectory?.momentumDir || null},
        ${record.indicators?.rsi || null}, ${record.indicators?.ema9 || null}, ${record.indicators?.ema21 || null},
        ${record.indicators?.macd?.macd || null}, ${record.indicators?.macd?.signal || null}, ${record.indicators?.macd?.histogram || null},
        ${record.indicators?.bb?.upper || null}, ${record.indicators?.bb?.lower || null}, ${record.indicators?.bb?.pctB || null},
        ${record.indicators?.atr || null}, ${record.indicators?.fundingRate || null},
        ${record.indicators?.fearGreed || null}, ${record.indicators?.marketRegime || null},
        ${record.clientIp || null}, ${record.userAgent || null}
      )
    `;
  } catch (error) {
    console.error('Failed to save prediction:', error);
  }
}

// Update prediction outcome
export async function updatePredictionOutcome(outcome: PredictionOutcome): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDbClient();
  
  try {
    await db.sql`
      INSERT INTO prediction_outcomes 
        (prediction_id, actual_outcome, final_price, was_correct, profit_loss, resolution_source, resolved_at)
      VALUES 
        (${outcome.predictionId}, ${outcome.actualOutcome}, ${outcome.finalPrice || null}, 
         ${outcome.wasCorrect || null}, ${outcome.profitLoss || null}, ${outcome.resolutionSource}, NOW())
      ON CONFLICT (prediction_id) 
      DO UPDATE SET
        actual_outcome = EXCLUDED.actual_outcome,
        final_price = EXCLUDED.final_price,
        was_correct = EXCLUDED.was_correct,
        profit_loss = EXCLUDED.profit_loss,
        resolution_source = EXCLUDED.resolution_source,
        resolved_at = NOW()
    `;
  } catch (error) {
    console.error('Failed to update prediction outcome:', error);
  }
}

// Update provider stats
export async function updateProviderStats(
  provider: string,
  modelId: string,
  wasCorrect: boolean,
  latencyMs: number,
  confidence: number,
  costUsd: number
): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDbClient();
  
  try {
    await db.sql`
      INSERT INTO provider_stats 
        (provider, model_id, total_predictions, correct_predictions, avg_latency_ms, avg_confidence, total_cost_usd, last_updated)
      VALUES 
        (${provider}, ${modelId}, 1, ${wasCorrect ? 1 : 0}, ${latencyMs}, ${confidence}, ${costUsd}, NOW())
      ON CONFLICT (provider, model_id) 
      DO UPDATE SET
        total_predictions = provider_stats.total_predictions + 1,
        correct_predictions = provider_stats.correct_predictions + ${wasCorrect ? 1 : 0},
        accuracy_rate = ROUND(100.0 * (provider_stats.correct_predictions + ${wasCorrect ? 1 : 0}) / (provider_stats.total_predictions + 1), 2),
        avg_latency_ms = (provider_stats.avg_latency_ms * provider_stats.total_predictions + ${latencyMs}) / (provider_stats.total_predictions + 1),
        avg_confidence = (provider_stats.avg_confidence * provider_stats.total_predictions + ${confidence}) / (provider_stats.total_predictions + 1),
        total_cost_usd = provider_stats.total_cost_usd + ${costUsd},
        last_updated = NOW()
    `;
  } catch (error) {
    console.error('Failed to update provider stats:', error);
  }
}

// Get provider performance stats
export async function getProviderPerformance(): Promise<{
  provider: string;
  modelId: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracyRate: number;
  avgLatencyMs: number;
  avgConfidence: number;
  totalCostUsd: number;
}[]> {
  if (!isDbConfigured()) return [];

  const db = getDbClient();
  
  try {
    const result = await db.sql`SELECT * FROM provider_performance`;
    return result.rows.map(row => ({
      provider: row.provider,
      modelId: row.model_id,
      totalPredictions: row.total_predictions,
      correctPredictions: row.correct_predictions,
      accuracyRate: row.accuracy_rate,
      avgLatencyMs: row.avg_latency_ms,
      avgConfidence: row.avg_confidence,
      totalCostUsd: row.total_cost_usd,
    }));
  } catch (error) {
    console.error('Failed to get provider performance:', error);
    return [];
  }
}

// Get recent predictions with outcomes
export async function getRecentPredictions(
  symbol: string,
  limit: number = 50
): Promise<(PredictionRecord & { wasCorrect?: boolean; finalPrice?: number })[]> {
  if (!isDbConfigured()) return [];

  const db = getDbClient();
  
  try {
    const result = await db.sql`
      SELECT 
        p.*, po.was_correct, po.final_price
      FROM predictions p
      LEFT JOIN prediction_outcomes po ON p.prediction_id = po.prediction_id
      WHERE p.symbol = ${symbol}
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `;
    
    return result.rows.map(row => ({
      predictionId: row.prediction_id,
      symbol: row.symbol,
      strikePrice: row.strike_price,
      currentPrice: row.current_price,
      expiryLabel: row.expiry_label,
      secondsToExpiry: row.seconds_to_expiry,
      verdict: row.verdict,
      confidence: row.confidence,
      ev: row.ev,
      kelly: row.kelly,
      reasoning: row.reasoning,
      providersUsed: row.providers_used,
      modelVotes: row.model_votes,
      modelAgreement: row.model_agreement,
      ensembleConfidence: row.ensemble_confidence,
      latencyMs: row.latency_ms,
      wasCorrect: row.was_correct,
      finalPrice: row.final_price,
    }));
  } catch (error) {
    console.error('Failed to get recent predictions:', error);
    return [];
  }
}

interface AccuracyStats {
  verdict: string;
  total: number;
  resolved: number;
  correct: number;
  accuracyPct: number;
  avgConfidence: number;
}

// Get accuracy stats
export async function getAccuracyStats(symbol?: string): Promise<AccuracyStats[]> {
  if (!isDbConfigured()) return [];

  const db = getDbClient();
  
  try {
    const result = symbol 
      ? await db.sql`SELECT * FROM prediction_accuracy WHERE symbol = ${symbol}`
      : await db.sql`SELECT * FROM prediction_accuracy`;
    
    return result.rows.map(row => ({
      verdict: row.verdict,
      total: row.total,
      resolved: row.resolved,
      correct: row.correct,
      accuracyPct: row.accuracy_pct,
      avgConfidence: row.avg_confidence,
    }));
  } catch (error) {
    console.error('Failed to get accuracy stats:', error);
    return [];
  }
}  
