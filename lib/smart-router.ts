import { getProviderPerformance } from './db/client';

// ═══════════════════════════════════════════════════════════════════════════
// SMART MODEL ROUTER — Cost-Optimized Multi-AI Selection
// ═══════════════════════════════════════════════════════════════════════════

// Cost per 1K tokens (input + output average estimate)
const PROVIDER_COSTS: Record<string, number> = {
  'groq:llama-3.3-70b-versatile': 0.0009,
  'groq:llama-3.1-8b-instant': 0.0002,
  'groq:gemma2-9b-it': 0.0003,
  'openai:gpt-4o': 0.005,
  'anthropic:claude-3-5-sonnet-20241022': 0.003,
  'gemini:gemini-1.5-pro': 0.001,
  'together:meta-llama/Llama-3.3-70B-Instruct-Turbo': 0.001,
};

// Complexity scoring
interface ComplexityFactors {
  timeToExpiry: number; // seconds
  distanceFromStrike: number; // percentage
  volatility: number; // ATR-based
  indicators: number; // how many indicators are present
}

export enum ComplexityTier {
  SIMPLE = 'simple',    // Easy prediction, high confidence
  MODERATE = 'moderate', // Normal case
  COMPLEX = 'complex',  // Uncertain, needs best models
}

// Determine complexity tier based on market conditions
export function assessComplexity(factors: ComplexityFactors): ComplexityTier {
  let score = 0;
  
  // Short time = more complex
  if (factors.timeToExpiry < 300) score += 2; // < 5 min
  else if (factors.timeToExpiry < 900) score += 1; // < 15 min
  
  // Close to strike = more complex
  if (factors.distanceFromStrike < 0.05) score += 2; // < 0.5%
  else if (factors.distanceFromStrike < 0.15) score += 1; // < 1.5%
  
  // High volatility = more complex
  if (factors.volatility > 0.003) score += 2;
  else if (factors.volatility > 0.001) score += 1;
  
  // Many indicators = moderate complexity (but helpful)
  if (factors.indicators > 8) score += 1;
  
  if (score >= 4) return ComplexityTier.COMPLEX;
  if (score >= 2) return ComplexityTier.MODERATE;
  return ComplexityTier.SIMPLE;
}

// Provider selection strategy
interface RoutingDecision {
  providers: string[];
  strategy: 'cost-optimized' | 'accuracy-optimized' | 'ensemble' | 'single-best';
  expectedCost: number;
  reasoning: string;
}

export async function selectProviders(
  complexity: ComplexityTier,
  useEnsemble: boolean = true
): Promise<RoutingDecision> {
  const performance = await getProviderPerformance();
  
  // Build scored provider list
  const scoredProviders = performance.map(p => {
    const cost = PROVIDER_COSTS[`${p.provider}:${p.modelId}`] || 0.001;
    const accuracy = p.accuracyRate || 70; // Default if no data
    const latency = p.avgLatencyMs || 2000;
    
    // Efficiency score: accuracy per dollar
    const efficiency = accuracy / (cost * 1000);
    
    return {
      provider: p.provider,
      modelId: p.modelId,
      cost,
      accuracy,
      latency,
      efficiency,
    };
  });
  
  switch (complexity) {
    case ComplexityTier.SIMPLE:
      // Use cheapest provider with decent accuracy (>65%)
      const cheapProviders = scoredProviders
        .filter(p => p.accuracy >= 65)
        .sort((a, b) => a.cost - b.cost);
      
      const selected = cheapProviders[0] || scoredProviders[0];
      return {
        providers: [selected.provider],
        strategy: 'cost-optimized',
        expectedCost: selected.cost,
        reasoning: `Simple case: using cheapest provider (${selected.provider}) with adequate accuracy`,
      };
      
    case ComplexityTier.MODERATE:
      // Use 2 providers: cheap + accurate
      if (useEnsemble) {
        const cheap = scoredProviders.sort((a, b) => a.cost - b.cost)[0];
        const accurate = scoredProviders.sort((a, b) => b.accuracy - a.accuracy)[0];
        const providers = [...new Set([cheap.provider, accurate.provider])];
        
        return {
          providers,
          strategy: 'accuracy-optimized',
          expectedCost: providers.reduce((sum, p) => {
            const cost = scoredProviders.find(sp => sp.provider === p)?.cost || 0.001;
            return sum + cost;
          }, 0),
          reasoning: `Moderate case: balancing cost and accuracy with ${providers.length} providers`,
        };
      } else {
        // Single best efficiency provider
        const best = scoredProviders.sort((a, b) => b.efficiency - a.efficiency)[0];
        return {
          providers: [best.provider],
          strategy: 'single-best',
          expectedCost: best.cost,
          reasoning: `Moderate case: using most efficient provider (${best.provider})`,
        };
      }
      
    case ComplexityTier.COMPLEX:
      // Full ensemble for difficult predictions
      if (useEnsemble) {
        // Top 3 by accuracy
        const top3 = scoredProviders
          .sort((a, b) => b.accuracy - a.accuracy)
          .slice(0, 3);
        
        return {
          providers: top3.map(p => p.provider),
          strategy: 'ensemble',
          expectedCost: top3.reduce((sum, p) => sum + p.cost, 0),
          reasoning: `Complex case: using top ${top3.length} providers for consensus`,
        };
      } else {
        // Single best accuracy
        const best = scoredProviders.sort((a, b) => b.accuracy - a.accuracy)[0];
        return {
          providers: [best.provider],
          strategy: 'single-best',
          expectedCost: best.cost,
          reasoning: `Complex case: using highest accuracy provider (${best.provider})`,
        };
      }
  }
}

// A/B testing variants
export enum ABVariant {
  ALWAYS_ENSEMBLE = 'always_ensemble',
  SMART_ROUTING = 'smart_routing',
  COST_FIRST = 'cost_first',
  ACCURACY_FIRST = 'accuracy_first',
}

export function selectABVariant(): ABVariant {
  // Simple random assignment (50/50 split)
  const variants = Object.values(ABVariant);
  return variants[Math.floor(Math.random() * variants.length)];
}

export async function getRoutingForVariant(
  variant: ABVariant,
  complexity: ComplexityTier
): Promise<RoutingDecision> {
  switch (variant) {
    case ABVariant.ALWAYS_ENSEMBLE:
      return {
        providers: ['groq', 'openai', 'anthropic', 'gemini', 'together'],
        strategy: 'ensemble',
        expectedCost: 0.01,
        reasoning: 'A/B test: Always use full ensemble',
      };
      
    case ABVariant.SMART_ROUTING:
      return selectProviders(complexity, true);
      
    case ABVariant.COST_FIRST:
      return selectProviders(ComplexityTier.SIMPLE, false);
      
    case ABVariant.ACCURACY_FIRST:
      const perf = await getProviderPerformance();
      const best = perf.sort((a, b) => (b.accuracyRate || 0) - (a.accuracyRate || 0))[0];
      return {
        providers: [best?.provider || 'groq'],
        strategy: 'single-best',
        expectedCost: 0.005,
        reasoning: 'A/B test: Always use highest accuracy provider',
      };
  }
}

// Cache key generation
export function generateCacheKey(
  symbol: string,
  price: number,
  strike: number,
  indicators: Record<string, number | undefined>
): string {
  // Round price to reduce cache fragmentation
  const roundedPrice = Math.round(price / 10) * 10;
  const indicatorHash = Object.entries(indicators)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}:${Math.round((v || 0) * 100)}`)
    .join(',');
  
  return `pred:${symbol}:${roundedPrice}:${strike}:${indicatorHash}`;
}  
