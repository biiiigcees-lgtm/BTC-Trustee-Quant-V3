import { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// OBSERVABILITY & LOGGING — Structured Logging with Metrics
// ═══════════════════════════════════════════════════════════════════════════

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  context?: Record<string, unknown>;
  duration?: number;
  error?: Error;
}

// In-memory metrics store (in production, use Prometheus/Datadog/etc)
const metrics: {
  predictions: {
    total: number;
    byVerdict: Record<string, number>;
    byProvider: Record<string, number>;
    errors: number;
    avgLatency: number;
  };
  providers: Record<string, {
    calls: number;
    errors: number;
    avgLatency: number;
    lastError?: string;
    circuitOpen: boolean;
  }>;
  cache: {
    hits: number;
    misses: number;
  };
  rateLimits: {
    hits: number;
    blocked: number;
  };
} = {
  predictions: {
    total: 0,
    byVerdict: {},
    byProvider: {},
    errors: 0,
    avgLatency: 0,
  },
  providers: {},
  cache: {
    hits: 0,
    misses: 0,
  },
  rateLimits: {
    hits: 0,
    blocked: 0,
  },
};

// Structured logger
export function log(
  level: LogLevel,
  message: string,
  component: string,
  context?: Record<string, unknown>,
  duration?: number,
  error?: Error
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    context,
    duration,
    error,
  };

  // In production, send to logging service (Datadog, Splunk, etc)
  // For now, console output with JSON for easy parsing
  const logFn = level === LogLevel.ERROR ? console.error :
                level === LogLevel.WARN ? console.warn :
                level === LogLevel.DEBUG ? console.debug :
                console.log;

  logFn(JSON.stringify(entry));
}

// Logger factory for components
export function createLogger(component: string) {
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => 
      log(LogLevel.DEBUG, msg, component, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => 
      log(LogLevel.INFO, msg, component, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: Error) => 
      log(LogLevel.WARN, msg, component, ctx, undefined, err),
    error: (msg: string, err: Error, ctx?: Record<string, unknown>) => 
      log(LogLevel.ERROR, msg, component, ctx, undefined, err),
    timed: async <T>(
      msg: string, 
      fn: () => Promise<T>, 
      ctx?: Record<string, unknown>
    ): Promise<T> => {
      const start = Date.now();
      try {
        const result = await fn();
        log(LogLevel.INFO, `${msg} - success`, component, ctx, Date.now() - start);
        return result;
      } catch (error) {
        log(LogLevel.ERROR, `${msg} - failed`, component, ctx, Date.now() - start, error as Error);
        throw error;
      }
    },
  };
}

// Metrics tracking
export function trackPrediction(
  verdict: string,
  providers: string[],
  latency: number,
  success: boolean
): void {
  metrics.predictions.total++;
  metrics.predictions.byVerdict[verdict] = (metrics.predictions.byVerdict[verdict] || 0) + 1;
  
  providers.forEach(p => {
    metrics.predictions.byProvider[p] = (metrics.predictions.byProvider[p] || 0) + 1;
  });

  if (!success) {
    metrics.predictions.errors++;
  }

  // Update rolling average latency
  metrics.predictions.avgLatency = 
    (metrics.predictions.avgLatency * (metrics.predictions.total - 1) + latency) / 
    metrics.predictions.total;
}

export function trackProviderCall(
  provider: string,
  latency: number,
  success: boolean,
  error?: string
): void {
  if (!metrics.providers[provider]) {
    metrics.providers[provider] = {
      calls: 0,
      errors: 0,
      avgLatency: 0,
      circuitOpen: false,
    };
  }

  const p = metrics.providers[provider];
  p.calls++;
  
  if (!success) {
    p.errors++;
    p.lastError = error;
  }

  p.avgLatency = (p.avgLatency * (p.calls - 1) + latency) / p.calls;
}

export function trackCacheHit(): void {
  metrics.cache.hits++;
}

export function trackCacheMiss(): void {
  metrics.cache.misses++;
}

export function trackRateLimit(blocked: boolean): void {
  if (blocked) {
    metrics.rateLimits.blocked++;
  } else {
    metrics.rateLimits.hits++;
  }
}

// Get metrics for dashboard
export function getMetrics() {
  return {
    ...metrics,
    cache: {
      ...metrics.cache,
      hitRate: metrics.cache.hits + metrics.cache.misses > 0
        ? metrics.cache.hits / (metrics.cache.hits + metrics.cache.misses)
        : 0,
    },
    providers: Object.entries(metrics.providers).map(([name, stats]) => ({
      name,
      ...stats,
      errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0,
    })),
  };
}

// Request context extraction
export function extractRequestContext(req: NextRequest): Record<string, unknown> {
  return {
    method: req.method,
    url: req.url,
    headers: {
      'user-agent': req.headers.get('user-agent'),
      'x-forwarded-for': req.headers.get('x-forwarded-for'),
    },
    ip: (req as any).ip || req.headers.get('x-forwarded-for') || 'unknown',
  };
}

// Performance monitoring wrapper
export function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  component: string,
  thresholdMs: number = 5000
): Promise<T> {
  const start = Date.now();
  const logger = createLogger(component);
  
  return fn().finally(() => {
    const duration = Date.now() - start;
    
    if (duration > thresholdMs) {
      logger.warn(`${name} exceeded threshold`, { duration, threshold: thresholdMs });
    }
  });
}

// Alerting thresholds
const ALERT_THRESHOLDS = {
  errorRate: 0.1, // 10%
  latency: 5000,  // 5 seconds
  cacheHitRate: 0.5, // 50%
};

// Check health and trigger alerts
export function checkHealth(): {
  healthy: boolean;
  checks: Record<string, { pass: boolean; value: number; threshold: number }>;
} {
  const checks: Record<string, { pass: boolean; value: number; threshold: number }> = {};
  
  // Error rate check
  const errorRate = metrics.predictions.total > 0 
    ? metrics.predictions.errors / metrics.predictions.total 
    : 0;
  checks.errorRate = {
    pass: errorRate < ALERT_THRESHOLDS.errorRate,
    value: errorRate,
    threshold: ALERT_THRESHOLDS.errorRate,
  };
  
  // Latency check
  checks.latency = {
    pass: metrics.predictions.avgLatency < ALERT_THRESHOLDS.latency,
    value: metrics.predictions.avgLatency,
    threshold: ALERT_THRESHOLDS.latency,
  };
  
  // Cache hit rate check
  const totalCache = metrics.cache.hits + metrics.cache.misses;
  const cacheHitRate = totalCache > 0 ? metrics.cache.hits / totalCache : 0;
  checks.cacheHitRate = {
    pass: cacheHitRate > ALERT_THRESHOLDS.cacheHitRate,
    value: cacheHitRate,
    threshold: ALERT_THRESHOLDS.cacheHitRate,
  };
  
  return {
    healthy: Object.values(checks).every(c => c.pass),
    checks,
  };
}  
