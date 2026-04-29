import { MarketRegime } from './god-tier-prediction';
import { updateProviderStats, getProviderPerformance, isDbConfigured } from './db/client';

// ═══════════════════════════════════════════════════════════════════════════
// REINFORCEMENT LEARNING ENGINE — Q-Learning for Prediction Optimization
// ═══════════════════════════════════════════════════════════════════════════

// Q-Table: State (Regime + Provider) -> Action (Weight) -> Value
interface QState {
  regime: MarketRegime;
  provider: string;
  recentAccuracy: number; // Bucket: low (<60), medium (60-75), high (>75)
}

type QAction = 'increase_weight' | 'decrease_weight' | 'maintain';

interface QEntry {
  state: QState;
  action: QAction;
  value: number;
  visitCount: number;
  lastUpdated: number;
}

// In-memory Q-table (persist to DB in production)
const qTable: Map<string, QEntry> = new Map();

// Q-Learning parameters
const ALPHA = 0.1; // Learning rate
const GAMMA = 0.9; // Discount factor
const EPSILON = 0.1; // Exploration rate

// Accuracy buckets
function getAccuracyBucket(accuracy: number): 'low' | 'medium' | 'high' {
  if (accuracy < 60) return 'low';
  if (accuracy <= 75) return 'medium';
  return 'high';
}

// Generate state key
function getStateKey(state: QState): string {
  return `${state.regime}:${state.provider}:${state.recentAccuracy}`;
}

// Initialize Q-table entry
function initQEntry(state: QState, action: QAction): QEntry {
  return {
    state,
    action,
    value: 0,
    visitCount: 0,
    lastUpdated: Date.now(),
  };
}

// Get Q-value for state-action pair
function getQValue(state: QState, action: QAction): number {
  const key = `${getStateKey(state)}:${action}`;
  const entry = qTable.get(key);
  return entry?.value || 0;
}

// Update Q-value using Bellman equation
function updateQValue(
  state: QState,
  action: QAction,
  reward: number,
  nextState: QState
): void {
  const key = `${getStateKey(state)}:${action}`;
  
  let entry = qTable.get(key);
  if (!entry) {
    entry = initQEntry(state, action);
    qTable.set(key, entry);
  }
  
  // Get max Q-value for next state
  const nextActions: QAction[] = ['increase_weight', 'decrease_weight', 'maintain'];
  const maxNextQ = Math.max(...nextActions.map(a => getQValue(nextState, a)));
  
  // Q-learning update rule
  // Q(s,a) = Q(s,a) + α * (r + γ * max(Q(s',a')) - Q(s,a))
  const oldValue = entry.value;
  entry.value = oldValue + ALPHA * (reward + GAMMA * maxNextQ - oldValue);
  entry.visitCount++;
  entry.lastUpdated = Date.now();
  
  console.log(`[RL] Updated Q(${key}): ${oldValue.toFixed(4)} → ${entry.value.toFixed(4)} (reward: ${reward.toFixed(2)})`);
}

// Choose action using epsilon-greedy policy
function chooseAction(state: QState): QAction {
  // Exploration: random action
  if (Math.random() < EPSILON) {
    const actions: QAction[] = ['increase_weight', 'decrease_weight', 'maintain'];
    return actions[Math.floor(Math.random() * actions.length)];
  }
  
  // Exploitation: best known action
  const actions: QAction[] = ['increase_weight', 'decrease_weight', 'maintain'];
  let bestAction: QAction = 'maintain';
  let bestValue = -Infinity;
  
  for (const action of actions) {
    const value = getQValue(state, action);
    if (value > bestValue) {
      bestValue = value;
      bestAction = action;
    }
  }
  
  return bestAction;
}

// Calculate reward based on prediction outcome
function calculateReward(
  wasCorrect: boolean,
  confidence: number,
  actualReturn: number, // Profit/loss as percentage
  timeToPrediction: number // How long until outcome known
): number {
  let reward = 0;
  
  // Base reward for correctness
  if (wasCorrect) {
    reward += 1;
    // Bonus for high confidence correct predictions
    reward += (confidence - 50) / 100;
  } else {
    reward -= 1;
    // Penalty for high confidence wrong predictions
    reward -= (confidence - 50) / 100;
  }
  
  // Reward based on actual returns
  reward += actualReturn * 0.1;
  
  // Time discount (faster feedback is better)
  const timeDiscount = Math.exp(-timeToPrediction / 3600); // Decay over hours
  reward *= timeDiscount;
  
  return reward;
}

// ═══════════════════════════════════════════════════════════════════════════
// ONLINE LEARNING INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface LearningUpdate {
  predictionId: string;
  provider: string;
  modelId: string;
  regime: MarketRegime;
  verdict: 'ABOVE' | 'BELOW' | 'PASS';
  confidence: number;
  wasCorrect: boolean;
  actualOutcome: 'ABOVE' | 'BELOW' | 'EXPIRED';
  profitLoss: number;
  timeToResolution: number; // seconds
  timestamp: number;
}

export async function processLearningUpdate(update: LearningUpdate): Promise<void> {
  if (!isDbConfigured()) {
    console.warn('[RL] Database not configured, skipping learning update');
    return;
  }
  
  try {
    // Get current accuracy bucket
    const performance = await getProviderPerformance();
    const providerPerf = performance.find(p => p.provider === update.provider);
    const currentAccuracy = providerPerf?.accuracyRate || 60;
    const accuracyBucket = getAccuracyBucket(currentAccuracy);
    
    // Create state
    const state: QState = {
      regime: update.regime,
      provider: update.provider,
      recentAccuracy: accuracyBucket as any,
    };
    
    // Choose and apply action
    const action = chooseAction(state);
    
    // Calculate reward
    const reward = calculateReward(
      update.wasCorrect,
      update.confidence,
      update.profitLoss,
      update.timeToResolution
    );
    
    // Determine next state (after update)
    const newAccuracy = providerPerf 
      ? (providerPerf.correctPredictions + (update.wasCorrect ? 1 : 0)) / 
        (providerPerf.totalPredictions + 1) * 100
      : (update.wasCorrect ? 100 : 0);
    const nextAccuracyBucket = getAccuracyBucket(newAccuracy);
    
    const nextState: QState = {
      regime: update.regime,
      provider: update.provider,
      recentAccuracy: nextAccuracyBucket as any,
    };
    
    // Update Q-table
    updateQValue(state, action, reward, nextState);
    
    // Update provider stats in DB
    await updateProviderStats(
      update.provider,
      update.modelId,
      update.wasCorrect,
      0, // latency not tracked here
      update.confidence,
      0 // cost not tracked here
    );
    
    console.log(`[RL] Processed update for ${update.provider} in ${update.regime}: action=${action}, reward=${reward.toFixed(2)}`);
    
  } catch (error) {
    console.error('[RL] Failed to process learning update:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEIGHT OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════

export interface OptimizedWeights {
  weights: Map<string, number>;
  explorationRate: number;
  reasoning: string[];
}

export async function getOptimizedWeights(
  regime: MarketRegime,
  providers: string[]
): Promise<OptimizedWeights> {
  const weights = new Map<string, number>();
  const reasoning: string[] = [];
  
  // Base weights
  const baseWeights: Record<string, number> = {
    'groq': 3,
    'openai': 3,
    'anthropic': 3,
    'gemini': 2,
    'together': 2,
  };
  
  // Get Q-table recommendations
  for (const provider of providers) {
    const baseWeight = baseWeights[provider] || 2;
    
    // Try to get accuracy for this provider
    let accuracy = 70;
    try {
      const perf = await getProviderPerformance();
      const p = perf.find(x => x.provider === provider);
      accuracy = p?.accuracyRate || 70;
    } catch {
      // Use default
    }
    
    const accuracyBucket = getAccuracyBucket(accuracy);
    const state: QState = {
      regime,
      provider,
      recentAccuracy: accuracyBucket as any,
    };
    
    // Get best action from Q-table
    const action = chooseAction(state);
    
    // Apply weight adjustment based on action
    let adjustedWeight = baseWeight;
    if (action === 'increase_weight') {
      adjustedWeight *= 1.2;
      reasoning.push(`${provider}: +20% weight (RL recommends increase)`);
    } else if (action === 'decrease_weight') {
      adjustedWeight *= 0.8;
      reasoning.push(`${provider}: -20% weight (RL recommends decrease)`);
    } else {
      reasoning.push(`${provider}: base weight (RL says maintain)`);
    }
    
    // Additional accuracy adjustment
    const accuracyFactor = (accuracy - 50) / 50; // Normalize to -1 to 1
    adjustedWeight *= (1 + accuracyFactor * 0.3);
    
    weights.set(provider, adjustedWeight);
  }
  
  // Normalize
  const total = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  for (const [provider, weight] of weights) {
    weights.set(provider, weight / total);
  }
  
  return {
    weights,
    explorationRate: EPSILON,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REGIME TRANSITION LEARNING
// ═══════════════════════════════════════════════════════════════════════════

interface RegimeTransition {
  from: MarketRegime;
  to: MarketRegime;
  successRate: number;
  count: number;
}

const regimeTransitions: Map<string, RegimeTransition> = new Map();

export function recordRegimeTransition(from: MarketRegime, to: MarketRegime, success: boolean): void {
  const key = `${from}->${to}`;
  let transition = regimeTransitions.get(key);
  
  if (!transition) {
    transition = { from, to, successRate: 0, count: 0 };
    regimeTransitions.set(key, transition);
  }
  
  // Update success rate with exponential moving average
  transition.count++;
  const alpha = 0.1;
  transition.successRate = transition.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
}

export function getRegimeTransitionProbability(from: MarketRegime, to: MarketRegime): number {
  const key = `${from}->${to}`;
  const transition = regimeTransitions.get(key);
  return transition?.successRate || 0.5; // Default 50%
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALIBRATION
// ═══════════════════════════════════════════════════════════════════════════

// Track calibration: how well confidence matches actual accuracy
interface CalibrationData {
  confidenceBin: number; // 50-55, 55-60, etc.
  predictions: number;
  correct: number;
  calibrationError: number; // Difference between confidence and actual accuracy
}

const calibrationBins: Map<number, CalibrationData> = new Map();

export function updateCalibration(confidence: number, wasCorrect: boolean): void {
  const bin = Math.floor(confidence / 5) * 5; // Round to nearest 5
  
  let data = calibrationBins.get(bin);
  if (!data) {
    data = { confidenceBin: bin, predictions: 0, correct: 0, calibrationError: 0 };
    calibrationBins.set(bin, data);
  }
  
  data.predictions++;
  if (wasCorrect) data.correct++;
  
  const actualAccuracy = data.correct / data.predictions;
  data.calibrationError = (bin + 2.5) / 100 - actualAccuracy; // Midpoint of bin
}

export function getCalibrationAdjustment(confidence: number): number {
  const bin = Math.floor(confidence / 5) * 5;
  const data = calibrationBins.get(bin);
  
  if (!data || data.predictions < 10) {
    return 0; // Not enough data
  }
  
  // Adjust confidence to match actual accuracy
  return -data.calibrationError * 100; // Convert to percentage points
}

export function getCalibrationReport(): CalibrationData[] {
  return Array.from(calibrationBins.values()).sort((a, b) => a.confidenceBin - b.confidenceBin);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT LEARNING STATS
// ═══════════════════════════════════════════════════════════════════════════

export interface LearningStats {
  qTableSize: number;
  totalUpdates: number;
  regimeTransitions: number;
  calibrationBins: number;
  providerWeights: Map<string, number>;
  recentRewards: number[];
}

export function getLearningStats(): LearningStats {
  const recentRewards: number[] = [];
  // Get last 100 rewards from Q-table
  for (const entry of qTable.values()) {
    if (entry.value !== 0) {
      recentRewards.push(entry.value);
    }
  }
  
  return {
    qTableSize: qTable.size,
    totalUpdates: Array.from(qTable.values()).reduce((sum, e) => sum + e.visitCount, 0),
    regimeTransitions: regimeTransitions.size,
    calibrationBins: calibrationBins.size,
    providerWeights: new Map(), // Would be populated from actual weights
    recentRewards: recentRewards.slice(-100),
  };
}  
