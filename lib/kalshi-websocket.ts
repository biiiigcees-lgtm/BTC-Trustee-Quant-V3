// Kalshi Trade API WebSocket Implementation
// Connects to wss://api.elections.kalshi.com/trade-api/ws/v2 for real-time market data

import { getKalshiJWT } from './kalshi-jwt';

export interface KalshiMarketUpdate {
  market_id: string;
  ticker: string;
  title: string;
  subtitle?: string;
  yes_price: number;
  no_price: number;
  volume: number;
  open_interest: number;
  last_trade_price: number;
  last_trade_time: number;
  min_yes_price: number;
  max_yes_price: number;
  timestamp: number;
}

export interface KalshiOrderBookUpdate {
  market_id: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  yes_volume: number;
  no_volume: number;
  timestamp: number;
}

export interface KalshiWebSocketConfig {
  onMarketUpdate: (update: KalshiMarketUpdate) => void;
  onOrderBookUpdate?: (update: KalshiOrderBookUpdate) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  markets?: string[]; // Market tickers to subscribe (e.g., ['KXBTC15M'])
}

export interface KalshiWebSocketConnection {
  connect: () => void;
  disconnect: () => void;
  subscribe: (ticker: string) => void;
  unsubscribe: (ticker: string) => void;
  isConnected: () => boolean;
}

/**
 * Kalshi Trade API WebSocket Client
 * 
 * Connects to Kalshi's trade API WebSocket for real-time market data on event contracts.
 * Requires JWT authentication using RSA private key.
 * 
 * Docs: https://docs.kalshi.com/trade-api/websocket
 */
export class KalshiWebSocketClient implements KalshiWebSocketConnection {
  private ws: WebSocket | null = null;
  private config: KalshiWebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 5000;
  private readonly WS_URL = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
  private subscribedMarkets: Set<string> = new Set();
  private authTimer: NodeJS.Timeout | null = null;
  private readonly TOKEN_REFRESH_INTERVAL_MS = 30000; // 30 seconds

  constructor(config: KalshiWebSocketConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('Kalshi WebSocket already connected');
      return;
    }

    const kalshiJWT = getKalshiJWT();
    if (!kalshiJWT) {
      console.error('Kalshi JWT not configured - cannot connect to WebSocket');
      this.config.onError?.(new Error('Kalshi JWT not configured'));
      return;
    }

    try {
      // Connect with JWT token in URL
      const token = kalshiJWT.generateToken();
      const wsUrl = `${this.WS_URL}?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Kalshi WebSocket connected');
        this.reconnectAttempts = 0;
        this.config.onConnect?.();
        
        // Start token refresh interval
        this.startTokenRefresh();
        
        // Subscribe to markets if configured
        if (this.config.markets) {
          for (const ticker of this.config.markets) {
            this.subscribe(ticker);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing Kalshi message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Kalshi WebSocket error:', error);
        this.config.onError?.(new Error('Kalshi WebSocket error'));
      };

      this.ws.onclose = (event) => {
        console.log('Kalshi WebSocket disconnected', event.code, event.reason);
        this.stopTokenRefresh();
        this.config.onDisconnect?.();
        
        // Attempt reconnection
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create Kalshi WebSocket:', error);
      this.config.onError?.(error as Error);
    }
  }

  private handleMessage(data: any): void {
    // Handle authentication success
    if (data.type === 'connection_ack' || data.msg === 'connected') {
      console.log('Kalshi WebSocket authenticated successfully');
      return;
    }

    // Handle market data updates
    if (data.type === 'market_update' || data.msg === 'market_update') {
      const update: KalshiMarketUpdate = {
        market_id: data.market_id || data.market?.market_id,
        ticker: data.ticker || data.market?.ticker,
        title: data.title || data.market?.title,
        subtitle: data.subtitle || data.market?.subtitle,
        yes_price: data.yes_price || data.market?.yes_price || 0,
        no_price: data.no_price || data.market?.no_price || 0,
        volume: data.volume || data.market?.volume || 0,
        open_interest: data.open_interest || data.market?.open_interest || 0,
        last_trade_price: data.last_trade_price || data.market?.last_trade_price || 0,
        last_trade_time: data.last_trade_time || data.market?.last_trade_time || Date.now(),
        min_yes_price: data.min_yes_price || data.market?.min_yes_price || 0,
        max_yes_price: data.max_yes_price || data.market?.max_yes_price || 0,
        timestamp: data.timestamp || Date.now(),
      };
      this.config.onMarketUpdate(update);
    }

    // Handle order book updates
    if (data.type === 'orderbook_update' || data.msg === 'orderbook_update') {
      const update: KalshiOrderBookUpdate = {
        market_id: data.market_id,
        yes_bid: data.yes_bid || 0,
        yes_ask: data.yes_ask || 0,
        no_bid: data.no_bid || 0,
        no_ask: data.no_ask || 0,
        yes_volume: data.yes_volume || 0,
        no_volume: data.no_volume || 0,
        timestamp: data.timestamp || Date.now(),
      };
      this.config.onOrderBookUpdate?.(update);
    }

    // Handle subscription confirmation
    if (data.type === 'subscription' || data.msg === 'subscription') {
      console.log('Kalshi subscription confirmed:', data);
    }

    // Handle errors
    if (data.type === 'error' || data.msg === 'error') {
      console.error('Kalshi WebSocket error message:', data);
      this.config.onError?.(new Error(data.error || data.message || 'Kalshi WebSocket error'));
    }
  }

  subscribe(ticker: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe - WebSocket not connected');
      return;
    }

    if (this.subscribedMarkets.has(ticker)) {
      console.log(`Already subscribed to ${ticker}`);
      return;
    }

    const subscribeMessage = {
      type: 'subscribe',
      msg: 'subscribe',
      ticker: ticker,
    };

    try {
      this.ws.send(JSON.stringify(subscribeMessage));
      this.subscribedMarkets.add(ticker);
      console.log(`Subscribed to Kalshi market: ${ticker}`);
    } catch (error) {
      console.error('Failed to send subscription message:', error);
    }
  }

  unsubscribe(ticker: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.subscribedMarkets.has(ticker)) {
      return;
    }

    const unsubscribeMessage = {
      type: 'unsubscribe',
      msg: 'unsubscribe',
      ticker: ticker,
    };

    try {
      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.subscribedMarkets.delete(ticker);
      console.log(`Unsubscribed from Kalshi market: ${ticker}`);
    } catch (error) {
      console.error('Failed to send unsubscribe message:', error);
    }
  }

  private startTokenRefresh(): void {
    // Refresh JWT token periodically to maintain connection
    this.authTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('Refreshing Kalshi JWT token');
        // Reconnect with new token
        this.disconnect();
        this.connect();
      }
    }, this.TOKEN_REFRESH_INTERVAL_MS);
  }

  private stopTokenRefresh(): void {
    if (this.authTimer) {
      clearInterval(this.authTimer);
      this.authTimer = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached for Kalshi');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY_MS * this.reconnectAttempts;

    console.log(`Attempting to reconnect to Kalshi in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopTokenRefresh();

    // Unsubscribe from all markets before closing
    for (const ticker of this.subscribedMarkets) {
      this.unsubscribe(ticker);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribedMarkets.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Singleton instance for global use
 */
let kalshiWS: KalshiWebSocketClient | null = null;

export function getKalshiWebSocket(config?: KalshiWebSocketConfig): KalshiWebSocketClient {
  if (!kalshiWS && config) {
    kalshiWS = new KalshiWebSocketClient(config);
  }
  return kalshiWS!;
}
