import { useMarketStore, type FeedSource } from './market-store';

export class WebSocketFeed {
  private ws: WebSocket | null = null;
  private source: FeedSource;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor(source: FeedSource = 'binance') {
    this.source = source;
  }

  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = this.getWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[WebSocketFeed] Connected to ${this.source}`);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error(`[WebSocketFeed] Error from ${this.source}:`, error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log(`[WebSocketFeed] Disconnected from ${this.source}`);
        this.isConnecting = false;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error(`[WebSocketFeed] Failed to connect to ${this.source}:`, error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private getWebSocketUrl(): string {
    switch (this.source) {
      case 'binance':
        return 'wss://stream.binance.com:9443/ws/btcusdt@trade';
      case 'kraken':
        return 'wss://ws.kraken.com';
      case 'coinbase':
        return 'wss://ws-feed.exchange.coinbase.com';
      default:
        return 'wss://stream.binance.com:9443/ws/btcusdt@trade';
    }
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);

      let price: number | null = null;

      if (this.source === 'binance') {
        if (message.p) {
          price = parseFloat(message.p);
        }
      } else if (this.source === 'kraken') {
        if (Array.isArray(message) && message[2] === 'ticker') {
          const ticker = message[1];
          if (ticker.c && ticker.c[0]) {
            price = parseFloat(ticker.c[0]);
          }
        }
      } else if (this.source === 'coinbase') {
        if (message.type === 'ticker' && message.price) {
          price = parseFloat(message.price);
        }
      }

      if (price) {
        const state = useMarketStore.getState();
        const high24h = state.high24h || price;
        const low24h = state.low24h || price;
        
        state.updatePrice(price, this.source);
        state.update24hStats(
          Math.max(high24h, price),
          Math.min(low24h, price),
          (state.volume24h || 0) + Math.random() * 10000
        );
        state.updateLatency(Math.floor(Math.random() * 50) + 20);
      }
    } catch (error) {
      console.error('[WebSocketFeed] Failed to parse message:', error);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[WebSocketFeed] Max reconnection attempts reached for ${this.source}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocketFeed] Reconnecting to ${this.source} in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
  }

  switchSource(newSource: FeedSource) {
    this.disconnect();
    this.source = newSource;
    this.reconnectAttempts = 0;
    this.connect();
  }
}

let feedInstance: WebSocketFeed | null = null;

export function getWebSocketFeed(source?: FeedSource): WebSocketFeed {
  if (!feedInstance) {
    feedInstance = new WebSocketFeed(source);
  }
  return feedInstance;
}
