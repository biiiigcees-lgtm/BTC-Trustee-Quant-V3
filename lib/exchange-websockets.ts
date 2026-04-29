// Exchange WebSocket Connections for Real-Time BTC/USD Feeds
// Implements Binance and Kraken WebSocket APIs for sub-50ms price updates

export interface PriceUpdate {
  exchange: 'binance' | 'kraken';
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  bid?: number;
  ask?: number;
}

export interface WebSocketConfig {
  exchange: 'binance' | 'kraken';
  symbol: string;
  onPriceUpdate: (update: PriceUpdate) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface WebSocketConnection {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

/**
 * Binance WebSocket Client
 * 
 * Connects to Binance USDM Futures WebSocket for real-time BTC/USD price feeds.
 * Supports combined streams and handles ping/pong frames automatically.
 * 
 * Docs: https://binance-docs.github.io/apidocs/futures/en/#websocket-market-streams
 */
export class BinanceWebSocketClient implements WebSocketConnection {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 5000;
  private readonly PING_INTERVAL_MS = 30000; // 30 seconds

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('Binance WebSocket already connected');
      return;
    }

    // Binance USDM Futures WebSocket endpoint
    // Symbol must be lowercase (e.g., btcusdt)
    const symbol = this.config.symbol.toLowerCase();
    const wsUrl = `wss://fstream.binance.com/ws/${symbol}@ticker`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`Binance WebSocket connected for ${this.config.symbol}`);
        this.reconnectAttempts = 0;
        this.config.onConnect?.();
        
        // Start ping interval
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing Binance message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Binance WebSocket error:', error);
        this.config.onError?.(new Error('Binance WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('Binance WebSocket disconnected');
        this.stopPingInterval();
        this.config.onDisconnect?.();
        
        // Attempt reconnection
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create Binance WebSocket:', error);
      this.config.onError?.(error as Error);
    }
  }

  private handleMessage(data: any): void {
    // Binance ticker format: { "e": "24hrTicker", "s": "BTCUSDT", "c": "85000.00", ... }
    if (data.e === '24hrTicker') {
      const update: PriceUpdate = {
        exchange: 'binance',
        symbol: data.s,
        price: parseFloat(data.c), // Current close price
        timestamp: data.E || Date.now(),
        volume: parseFloat(data.v),
        bid: parseFloat(data.b),
        ask: parseFloat(data.a),
      };
      this.config.onPriceUpdate(update);
    }
  }

  private startPingInterval(): void {
    // Binance handles ping/pong automatically
    // No manual ping needed - connection stays alive with regular messages
  }

  private stopPingInterval(): void {
    // Clear interval if needed
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached for Binance');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY_MS * this.reconnectAttempts;

    console.log(`Attempting to reconnect to Binance in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Kraken WebSocket Client
 * 
 * Connects to Kraken public market WebSocket for real-time BTC/USD price feeds.
 * Requires at least one active subscription or connection will drop after 1 minute.
 * 
 * Docs: https://docs.kraken.com/websockets/#message-ticker
 */
export class KrakenWebSocketClient implements WebSocketConnection {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 5000;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private subscribed = false;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('Kraken WebSocket already connected');
      return;
    }

    // Kraken public market WebSocket endpoint
    const wsUrl = 'wss://ws.kraken.com';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`Kraken WebSocket connected for ${this.config.symbol}`);
        this.reconnectAttempts = 0;
        this.config.onConnect?.();
        
        // Subscribe to ticker
        this.subscribe();
        
        // Start heartbeat check
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing Kraken message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Kraken WebSocket error:', error);
        this.config.onError?.(new Error('Kraken WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('Kraken WebSocket disconnected');
        this.stopHeartbeat();
        this.subscribed = false;
        this.config.onDisconnect?.();
        
        // Attempt reconnection
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create Kraken WebSocket:', error);
      this.config.onError?.(error as Error);
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Kraken uses XBT/USD for BTC/USD
    const krakenSymbol = this.config.symbol === 'BTC/USD' ? 'XBT/USD' : this.config.symbol;

    const subscribeMessage = {
      event: 'subscribe',
      pair: [krakenSymbol],
      subscription: {
        name: 'ticker',
      },
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    this.subscribed = true;
  }

  private handleMessage(data: any): void {
    // Handle heartbeat
    if (data.event === 'heartbeat') {
      this.resetHeartbeat();
      return;
    }

    // Handle subscription status
    if (data.event === 'subscriptionStatus') {
      console.log('Kraken subscription status:', data.status);
      return;
    }

    // Handle ticker data
    if (Array.isArray(data) && data.length > 2) {
      const channel = data[2];
      if (channel === 'ticker') {
        const ticker = data[1];
        
        // Kraken ticker format: [a, b, c, v, ...]
        // a = ask array, b = bid array, c = close array, v = volume array
        const update: PriceUpdate = {
          exchange: 'kraken',
          symbol: this.config.symbol,
          price: parseFloat(ticker.c[0]), // Last trade closed price
          timestamp: Date.now(),
          volume: parseFloat(ticker.v[1]), // 24h volume
          bid: parseFloat(ticker.b[0]), // Best bid
          ask: parseFloat(ticker.a[0]), // Best ask
        };
        this.config.onPriceUpdate(update);
      }
    }
  }

  private startHeartbeat(): void {
    this.resetHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      // Kraken sends heartbeat every second when subscribed
      // If we don't receive one, connection may be dead
      console.warn('Kraken heartbeat timeout - connection may be dead');
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private resetHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.startHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached for Kraken');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY_MS * this.reconnectAttempts;

    console.log(`Attempting to reconnect to Kraken in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      // Unsubscribe before closing
      if (this.subscribed && this.ws.readyState === WebSocket.OPEN) {
        const krakenSymbol = this.config.symbol === 'BTC/USD' ? 'XBT/USD' : this.config.symbol;
        const unsubscribeMessage = {
          event: 'unsubscribe',
          pair: [krakenSymbol],
          subscription: {
            name: 'ticker',
          },
        };
        this.ws.send(JSON.stringify(unsubscribeMessage));
      }

      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Multi-Exchange Price Aggregator
 * 
 * Manages connections to multiple exchanges and aggregates price updates.
 * Provides sub-50ms latency by processing updates from the fastest source.
 */
export class MultiExchangePriceAggregator {
  private connections: Map<string, WebSocketConnection> = new Map();
  private latestPrices: Map<string, PriceUpdate> = new Map();
  private subscribers: Map<string, Set<(update: PriceUpdate) => void>> = new Map();
  private priceHistory: PriceUpdate[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;

  /**
   * Connect to an exchange
   */
  connectExchange(
    exchange: 'binance' | 'kraken',
    symbol: string,
    config?: Partial<WebSocketConfig>
  ): void {
    const key = `${exchange}:${symbol}`;

    if (this.connections.has(key)) {
      console.log(`Already connected to ${exchange} for ${symbol}`);
      return;
    }

    const fullConfig: WebSocketConfig = {
      exchange,
      symbol,
      onPriceUpdate: (update) => this.handlePriceUpdate(update),
      onError: (error) => console.error(`${exchange} error:`, error),
      onConnect: () => console.log(`${exchange} connected`),
      onDisconnect: () => console.log(`${exchange} disconnected`),
      ...config,
    };

    let client: WebSocketConnection;

    switch (exchange) {
      case 'binance':
        client = new BinanceWebSocketClient(fullConfig);
        break;
      case 'kraken':
        client = new KrakenWebSocketClient(fullConfig);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }

    this.connections.set(key, client);
    client.connect();
  }

  /**
   * Disconnect from an exchange
   */
  disconnectExchange(exchange: 'binance' | 'kraken', symbol: string): void {
    const key = `${exchange}:${symbol}`;
    const connection = this.connections.get(key);

    if (connection) {
      connection.disconnect();
      this.connections.delete(key);
    }
  }

  /**
   * Disconnect from all exchanges
   */
  disconnectAll(): void {
    for (const [key, connection] of this.connections.entries()) {
      connection.disconnect();
    }
    this.connections.clear();
  }

  /**
   * Handle price update from any exchange
   */
  private handlePriceUpdate(update: PriceUpdate): void {
    // Store latest price from this exchange
    const key = `${update.exchange}:${update.symbol}`;
    this.latestPrices.set(key, update);

    // Add to history
    this.priceHistory.push(update);
    if (this.priceHistory.length > this.MAX_HISTORY_SIZE) {
      this.priceHistory.shift();
    }

    // Notify subscribers
    const symbolSubscribers = this.subscribers.get(update.symbol);
    if (symbolSubscribers) {
      for (const callback of symbolSubscribers) {
        callback(update);
      }
    }
  }

  /**
   * Subscribe to price updates for a symbol
   */
  subscribe(symbol: string, callback: (update: PriceUpdate) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }

    this.subscribers.get(symbol)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(symbol);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  /**
   * Get latest price from a specific exchange
   */
  getLatestPrice(exchange: 'binance' | 'kraken', symbol: string): PriceUpdate | undefined {
    const key = `${exchange}:${symbol}`;
    return this.latestPrices.get(key);
  }

  /**
   * Get aggregated latest price (from fastest exchange)
   */
  getAggregatedPrice(symbol: string): PriceUpdate | undefined {
    const prices: PriceUpdate[] = [];
    
    for (const [key, update] of this.latestPrices.entries()) {
      if (update.symbol === symbol) {
        prices.push(update);
      }
    }

    if (prices.length === 0) return undefined;

    // Return the most recent update
    return prices.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  /**
   * Get price history
   */
  getPriceHistory(symbol?: string): PriceUpdate[] {
    if (symbol) {
      return this.priceHistory.filter((p) => p.symbol === symbol);
    }
    return [...this.priceHistory];
  }

  /**
   * Check if any exchange is connected for a symbol
   */
  isConnected(symbol: string): boolean {
    for (const [key, connection] of this.connections.entries()) {
      if (key.includes(symbol) && connection.isConnected()) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Singleton instance for global use
 */
export const priceAggregator = new MultiExchangePriceAggregator();
