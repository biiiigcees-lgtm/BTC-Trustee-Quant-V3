import { createClient, RedisClientType } from 'redis';

// ═══════════════════════════════════════════════════════════════════════════
// REDIS CACHE LAYER — Prediction Caching with TTL
// ═══════════════════════════════════════════════════════════════════════════

let redisClient: RedisClientType | null = null;

export function getRedisClient(): RedisClientType | null {
  if (!process.env.REDIS_URL) return null;
  
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    redisClient.connect().catch(console.error);
  }
  
  return redisClient;
}

export function isCacheConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

// Cache TTL in seconds (30 seconds for predictions — market moves fast)
const DEFAULT_TTL = 30;

interface CachedPrediction {
  verdict: 'ABOVE' | 'BELOW' | 'PASS';
  confidence: number;
  ev: number;
  kelly: number;
  reasoning: string[];
  providersUsed: string[];
  modelVotes: string[];
  modelAgreement: number;
  ensembleConfidence: number;
  latency: number;
  trajectory: {
    movesNeeded: number | null;
    velocity: number | null;
    projectedOutcome: string | null;
    momentumDir: string | null;
  };
  cachedAt: number;
}

export async function getCachedPrediction(key: string): Promise<CachedPrediction | null> {
  if (!isCacheConfigured()) return null;
  
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const cached = await client.get(key);
    if (!cached) return null;
    
    const parsed: CachedPrediction = JSON.parse(cached);
    
    // Check if cache is expired (double-check TTL)
    const age = Date.now() - parsed.cachedAt;
    if (age > DEFAULT_TTL * 1000) {
      await client.del(key);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

export async function setCachedPrediction(
  key: string, 
  prediction: Omit<CachedPrediction, 'cachedAt'>
): Promise<void> {
  if (!isCacheConfigured()) return;
  
  const client = getRedisClient();
  if (!client) return;
  
  try {
    const toCache: CachedPrediction = {
      ...prediction,
      cachedAt: Date.now(),
    };
    
    await client.setEx(key, DEFAULT_TTL, JSON.stringify(toCache));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

// Cache warming (pre-populate for common symbols)
export async function warmCache(
  symbol: string,
  fetchPrediction: () => Promise<CachedPrediction>
): Promise<void> {
  if (!isCacheConfigured()) return;
  
  const warmupKey = `warmup:${symbol}`;
  const client = getRedisClient();
  if (!client) return;
  
  try {
    const alreadyWarmed = await client.get(warmupKey);
    if (alreadyWarmed) return;
    
    // Mark as warmed for 5 minutes
    await client.setEx(warmupKey, 300, '1');
    
    // Fetch and cache
    const prediction = await fetchPrediction();
    const cacheKey = `pred:${symbol}:warmup`;
    await setCachedPrediction(cacheKey, prediction);
  } catch (error) {
    console.error('Cache warming error:', error);
  }
}

// Cache stats for monitoring
export async function getCacheStats(): Promise<{
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
}> {
  if (!isCacheConfigured()) {
    return { hits: 0, misses: 0, hitRate: 0, keys: 0 };
  }
  
  const client = getRedisClient();
  if (!client) {
    return { hits: 0, misses: 0, hitRate: 0, keys: 0 };
  }
  
  try {
    const info = await client.info('stats');
    const keyspace = await client.info('keyspace');
    
    // Parse key count from keyspace info
    const keyMatch = keyspace.match(/keys=(\d+)/);
    const keys = keyMatch ? parseInt(keyMatch[1], 10) : 0;
    
    return {
      hits: 0, // Would need to track manually
      misses: 0,
      hitRate: 0,
      keys,
    };
  } catch (error) {
    console.error('Cache stats error:', error);
    return { hits: 0, misses: 0, hitRate: 0, keys: 0 };
  }
}

// Rate limiting cache (for API protection)
export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  if (!isCacheConfigured()) {
    // Fallback: allow if no cache
    return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 };
  }
  
  const client = getRedisClient();
  if (!client) {
    return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 };
  }
  
  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  try {
    // Use Redis sorted set for sliding window
    // Remove old entries
    await client.zRemRangeByScore(key, 0, windowStart);
    
    // Count current requests
    const currentCount = await client.zCard(key);
    
    if (currentCount >= maxRequests) {
      // Get oldest entry to calculate reset time
      const oldest = await (client as any).zRangeWithScores(key, 0, 0);
      const oldestScore = oldest?.[0]?.score || now;
      const resetTime = (oldestScore + windowSeconds) * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }
    
    // Add current request
    await client.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
    await client.expire(key, windowSeconds);
    
    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetTime: Date.now() + windowSeconds * 1000,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 };
  }
}  
