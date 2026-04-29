import { NextResponse } from 'next/server';
import { getMetrics, checkHealth } from '../../../lib/observability';
import { getCircuitStatus } from '../../../lib/resilience';
import { getCacheStats } from '../../../lib/cache';
import { isDbConfigured, getProviderPerformance, getAccuracyStats } from '../../../lib/db/client';

// ═══════════════════════════════════════════════════════════════════════════
// METRICS & HEALTH API — System Monitoring Dashboard
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: Request) {
  // Check authentication (optional, can add API key check here)
  const authHeader = req.headers.get('authorization');
  const apiKey = process.env.METRICS_API_KEY;
  
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Gather all metrics in parallel
    const [
      metrics,
      health,
      circuits,
      cache,
      providerPerf,
      accuracy,
    ] = await Promise.all([
      Promise.resolve(getMetrics()),
      Promise.resolve(checkHealth()),
      Promise.resolve(getCircuitStatus()),
      getCacheStats(),
      isDbConfigured() ? getProviderPerformance() : Promise.resolve([]),
      isDbConfigured() ? getAccuracyStats() : Promise.resolve([]),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      system: {
        healthy: health.healthy,
        checks: health.checks,
      },
      predictions: metrics.predictions,
      providers: metrics.providers,
      circuits: circuits.map(c => ({
        provider: c.provider,
        state: c.state,
        failures: c.failures,
        successes: c.successes,
        lastFailure: c.lastFailure ? new Date(c.lastFailure).toISOString() : null,
      })),
      cache: {
        ...metrics.cache,
        ...cache,
        hitRate: metrics.cache.hitRate,
      },
      rateLimits: metrics.rateLimits,
      database: {
        configured: isDbConfigured(),
        providerPerformance: providerPerf,
        accuracyStats: accuracy,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        region: process.env.VERCEL_REGION || 'unknown',
        hasGroq: !!process.env.GROQ_API_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
        hasGemini: !!process.env.GEMINI_API_KEY,
        hasTogether: !!process.env.TOGETHER_API_KEY,
        hasPostgres: isDbConfigured(),
        hasRedis: !!process.env.REDIS_URL,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to gather metrics', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// Health check endpoint (simpler, faster)
export async function HEAD() {
  const health = checkHealth();
  
  return new NextResponse(null, {
    status: health.healthy ? 200 : 503,
    headers: {
      'X-Health-Status': health.healthy ? 'healthy' : 'unhealthy',
      'X-Health-Checks': JSON.stringify(health.checks),
    },
  });
}  
