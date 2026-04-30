import { useMarketStore, type FeedSource } from './market-store';

const STALE_THRESHOLD = 5000; // 5 seconds
const HEALTH_CHECK_INTERVAL = 2000; // 2 seconds

export class FeedArbitrator {
  private primarySource: FeedSource = 'binance';
  private backupSource: FeedSource = 'kraken';
  private fallbackSource: FeedSource = 'coinbase';
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.startHealthCheck();
  }

  /**
   * Check if a data source is healthy (not stale)
   */
  private checkHealth(source: FeedSource): boolean {
    const state = useMarketStore.getState();
    if (!state.updatedAt) return false;
    
    const age = Date.now() - state.updatedAt;
    return age < STALE_THRESHOLD;
  }

  /**
   * Get the current active source
   */
  getCurrentSource(): FeedSource {
    return this.primarySource;
  }

  /**
   * Manually switch to a specific source
   */
  switchSource(source: FeedSource): void {
    console.log(`[FeedArbitrator] Switching to ${source}`);
    useMarketStore.getState().switchSource(source);
    
    // Update primary source if switching to backup or fallback
    if (source === this.backupSource) {
      this.primarySource = this.backupSource;
    } else if (source === this.fallbackSource) {
      this.primarySource = this.fallbackSource;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health check and auto-switch if needed
   */
  private performHealthCheck(): void {
    const state = useMarketStore.getState();
    const currentSource = state.source;
    
    // Check if current source is stale
    if (!this.checkHealth(currentSource)) {
      console.warn(`[FeedArbitrator] Source ${currentSource} is stale, switching...`);
      
      // Determine next source
      let nextSource: FeedSource;
      if (currentSource === 'binance') {
        nextSource = 'kraken';
      } else if (currentSource === 'kraken') {
        nextSource = 'coinbase';
      } else {
        nextSource = 'binance'; // Cycle back
      }
      
      this.switchSource(nextSource);
    }
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Get health status for UI display
   */
  getHealthStatus(): {
    status: 'live' | 'stale' | 'offline';
    source: FeedSource;
    latency: number;
  } {
    const state = useMarketStore.getState();
    const isHealthy = this.checkHealth(state.source);
    
    return {
      status: isHealthy ? 'live' : 'stale',
      source: state.source,
      latency: state.latency,
    };
  }
}

// Singleton instance
let arbitratorInstance: FeedArbitrator | null = null;

export function getFeedArbitrator(): FeedArbitrator {
  if (!arbitratorInstance) {
    arbitratorInstance = new FeedArbitrator();
  }
  return arbitratorInstance;
}
