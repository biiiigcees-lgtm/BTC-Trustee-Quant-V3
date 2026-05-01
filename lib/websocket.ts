import { Server } from 'socket.io';
import { createServer } from 'http';

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET REAL-TIME LAYER — Live Price Updates & Predictions
// ═══════════════════════════════════════════════════════════════════════════

interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  ema9?: number;
  ema21?: number;
  rsi?: number;
  volume24h?: number;
  change24h?: number;
}

interface PredictionData {
  symbol: string;
  strikePrice: number;
  expiryLabel: string;
  verdict: 'ABOVE' | 'BELOW' | 'PASS';
  confidence: number;
  ev: number;
  kelly: number;
  latency: number;
  providersUsed: string[];
  timestamp: number;
}

// In-memory Socket.io server (for local dev, use Redis adapter for production)
let io: Server | null = null;

export function initWebSocketServer(httpServer?: ReturnType<typeof createServer>): Server | null {
  if (io) return io;
  
  if (!httpServer && typeof window !== 'undefined') {
    // Client-side, no server needed
    return null;
  }
  
  if (httpServer) {
    io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });
    
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Subscribe to symbol
      socket.on('subscribe', (symbol: string) => {
        socket.join(`symbol:${symbol}`);
        console.log(`Client ${socket.id} subscribed to ${symbol}`);
      });
      
      // Unsubscribe
      socket.on('unsubscribe', (symbol: string) => {
        socket.leave(`symbol:${symbol}`);
        console.log(`Client ${socket.id} unsubscribed from ${symbol}`);
      });
      
      // Request prediction
      socket.on('predict', async (data: {
        symbol: string;
        strike: number;
        expiry: string;
      }) => {
        // This would trigger a prediction and broadcast result
        // Implementation would call the prediction API
        socket.emit('prediction:requested', {
          requestId: `${Date.now()}-${Math.random()}`,
          ...data,
        });
      });
      
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
    
    return io;
  }
  
  return null;
}

// Broadcast price update to all subscribers
export function broadcastPrice(data: PriceData): void {
  if (!io) return;
  
  io.to(`symbol:${data.symbol}`).emit('price:update', data);
}

// Broadcast prediction result
export function broadcastPrediction(symbol: string, data: PredictionData): void {
  if (!io) return;
  
  io.to(`symbol:${symbol}`).emit('prediction:result', data);
}

// Broadcast trade signal
export function broadcastSignal(symbol: string, signal: {
  type: 'ENTRY' | 'EXIT';
  direction: 'LONG' | 'SHORT';
  price: number;
  confidence: number;
  reason: string;
  timestamp: number;
}): void {
  if (!io) return;
  
  io.to(`symbol:${symbol}`).emit('signal', signal);
}

// Client-side WebSocket hook (for React components)
interface WebSocketHook {
  isConnected: boolean;
  prices: Record<string, PriceData>;
  predictions: Record<string, PredictionData>;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  requestPrediction: (symbol: string, strike: number, expiry: string) => void;
}

// This would be used in a React hook on the client
export function createWebSocketClient(url: string): {
  socket: any;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  onPrice: (callback: (data: PriceData) => void) => void;
  onPrediction: (callback: (data: PredictionData) => void) => void;
  onSignal: (callback: (data: { type: string; direction: string; price: number }) => void) => void;
  disconnect: () => void;
} | null {
  if (typeof window === 'undefined') return null;
  
  // Dynamic import for client-side only
  const socket = require('socket.io-client')(url, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  
  return {
    socket,
    subscribe: (symbol: string) => socket.emit('subscribe', symbol),
    unsubscribe: (symbol: string) => socket.emit('unsubscribe', symbol),
    onPrice: (callback: (data: PriceData) => void) => socket.on('price:update', callback),
    onPrediction: (callback: (data: PredictionData) => void) => socket.on('prediction:result', callback),
    onSignal: (callback: (data: { type: string; direction: string; price: number }) => void) => 
      socket.on('signal', callback),
    disconnect: () => socket.disconnect(),
  };
}

// Real-time price feed simulator (for testing without WebSocket)
export class PriceFeedSimulator {
  private interval: NodeJS.Timeout | null = null;
  private subscribers: Map<string, ((data: PriceData) => void)[]> = new Map();
  
  subscribe(symbol: string, callback: (data: PriceData) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    this.subscribers.get(symbol)!.push(callback);
    
    return () => {
      const cbs = this.subscribers.get(symbol);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx > -1) cbs.splice(idx, 1);
      }
    };
  }
  
  start(basePrice: number = 0, intervalMs: number = 1000): void {
    if (this.interval) return;

    let price = basePrice;
    
    this.interval = setInterval(() => {
      // Simulate random price movement
      const change = (Math.random() - 0.5) * 100;
      price += change;
      
      const data: PriceData = {
        symbol: 'BTC',
        price,
        timestamp: Date.now(),
        change24h: (price - basePrice) / basePrice * 100,
      };
      
      // Notify subscribers
      this.subscribers.get('BTC')?.forEach(cb => cb(data));
      
      // Also broadcast via WebSocket if available
      broadcastPrice(data);
    }, intervalMs);
  }
  
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}  
