import { createLogger, trackProviderCall } from './observability';

// ═══════════════════════════════════════════════════════════════════════════
// ERROR RESILIENCE — Circuit Breaker & Retry Logic
// ═══════════════════════════════════════════════════════════════════════════

const logger = createLogger('Resilience');

// Circuit breaker states
enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, reject requests
  HALF_OPEN = 'half-open', // Testing if service recovered
}

interface CircuitBreakerOptions {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes needed to close
  timeoutMs: number;           // Time before attempting reset
  halfOpenMaxCalls: number;    // Max calls in half-open state
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30000, // 30 seconds
  halfOpenMaxCalls: 2,
};

// Provider circuit breakers
const circuits: Map<string, {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  halfOpenCalls: number;
  options: CircuitBreakerOptions;
}> = new Map();

export function getCircuitState(provider: string): CircuitState {
  return circuits.get(provider)?.state || CircuitState.CLOSED;
}

export function isCircuitOpen(provider: string): boolean {
  const circuit = circuits.get(provider);
  if (!circuit) return false;
  
  // Check if timeout has passed since last failure
  if (circuit.state === CircuitState.OPEN) {
    const timeSinceFailure = Date.now() - circuit.lastFailureTime;
    if (timeSinceFailure > circuit.options.timeoutMs) {
      // Transition to half-open
      circuit.state = CircuitState.HALF_OPEN;
      circuit.halfOpenCalls = 0;
      logger.info(`Circuit for ${provider} entering half-open state`);
    }
  }
  
  return circuit.state === CircuitState.OPEN;
}

function initCircuit(provider: string, options: Partial<CircuitBreakerOptions> = {}): void {
  if (!circuits.has(provider)) {
    circuits.set(provider, {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      halfOpenCalls: 0,
      options: { ...DEFAULT_OPTIONS, ...options },
    });
  }
}

export function recordSuccess(provider: string): void {
  initCircuit(provider);
  const circuit = circuits.get(provider)!;
  
  if (circuit.state === CircuitState.HALF_OPEN) {
    circuit.successes++;
    circuit.halfOpenCalls++;
    
    if (circuit.successes >= circuit.options.successThreshold) {
      // Close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      logger.info(`Circuit for ${provider} closed (recovered)`);
    }
  } else if (circuit.state === CircuitState.CLOSED) {
    // Reset failures on success in closed state
    if (circuit.failures > 0) {
      circuit.failures = 0;
    }
  }
}

export function recordFailure(provider: string, error: string): void {
  initCircuit(provider);
  const circuit = circuits.get(provider)!;
  
  circuit.failures++;
  circuit.lastFailureTime = Date.now();
  
  if (circuit.state === CircuitState.HALF_OPEN) {
    // Even one failure in half-open opens the circuit again
    circuit.state = CircuitState.OPEN;
    circuit.halfOpenCalls = 0;
    logger.warn(`Circuit for ${provider} re-opened after failure in half-open`, { error });
  } else if (circuit.state === CircuitState.CLOSED && 
             circuit.failures >= circuit.options.failureThreshold) {
    // Open the circuit
    circuit.state = CircuitState.OPEN;
    logger.warn(`Circuit for ${provider} opened after ${circuit.failures} failures`, { error });
  }
  
  trackProviderCall(provider, 0, false, error);
}

// Retry configuration
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // Error messages that should trigger retry
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['timeout', 'rate limit', 'connection', 'ECONNRESET', 'ETIMEDOUT'],
};

function shouldRetry(error: Error, options: RetryOptions): boolean {
  const errorMessage = error.message.toLowerCase();
  return options.retryableErrors.some(e => errorMessage.includes(e.toLowerCase()));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute with circuit breaker and retry
export async function executeWithResilience<T>(
  provider: string,
  operation: () => Promise<T>,
  circuitOptions?: Partial<CircuitBreakerOptions>,
  retryOptions?: Partial<RetryOptions>
): Promise<T> {
  const circuit = circuitOptions || {};
  const retry = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  
  // Check circuit state
  if (isCircuitOpen(provider)) {
    throw new Error(`Circuit breaker is OPEN for provider: ${provider}`);
  }
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
    try {
      const start = Date.now();
      const result = await operation();
      const latency = Date.now() - start;
      
      recordSuccess(provider);
      trackProviderCall(provider, latency, true);
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if circuit just opened
      if (isCircuitOpen(provider)) {
        throw new Error(`Circuit opened during operation for provider: ${provider}`);
      }
      
      // Check if we should retry
      if (attempt < retry.maxRetries && shouldRetry(lastError, retry)) {
        const delay = Math.min(
          retry.baseDelayMs * Math.pow(retry.backoffMultiplier, attempt),
          retry.maxDelayMs
        );
        
        logger.warn(`Retry ${attempt + 1}/${retry.maxRetries} for ${provider} after ${delay}ms`, {
          error: lastError.message,
          delay,
        });
        
        await sleep(delay);
        continue;
      }
      
      // Final attempt failed
      break;
    }
  }
  
  // All retries exhausted
  recordFailure(provider, lastError?.message || 'Unknown error');
  throw lastError || new Error(`Operation failed for provider: ${provider}`);
}

// Bulkhead pattern (limit concurrent requests per provider)
const inflightRequests: Map<string, number> = new Map();
const MAX_INFLIGHT = 5;

export async function withBulkhead<T>(
  provider: string,
  operation: () => Promise<T>
): Promise<T> {
  const current = inflightRequests.get(provider) || 0;
  
  if (current >= MAX_INFLIGHT) {
    throw new Error(`Bulkhead full for provider: ${provider} (${current} in-flight)`);
  }
  
  inflightRequests.set(provider, current + 1);
  
  try {
    return await operation();
  } finally {
    const newCount = (inflightRequests.get(provider) || 1) - 1;
    if (newCount <= 0) {
      inflightRequests.delete(provider);
    } else {
      inflightRequests.set(provider, newCount);
    }
  }
}

// Timeout wrapper
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Get circuit breaker status for monitoring
export function getCircuitStatus(): Array<{
  provider: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
}> {
  return Array.from(circuits.entries()).map(([provider, circuit]) => ({
    provider,
    state: circuit.state,
    failures: circuit.failures,
    successes: circuit.successes,
    lastFailure: circuit.lastFailureTime,
  }));
}

// Reset all circuits (for testing or manual recovery)
export function resetCircuits(): void {
  circuits.clear();
  logger.info('All circuit breakers reset');
}  
