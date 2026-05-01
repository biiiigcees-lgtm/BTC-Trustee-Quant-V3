'use client';

import { useState, useEffect, useRef } from 'react';
import { priceAggregator } from './exchange-websockets';
import { getKalshiWebSocket, type KalshiMarketUpdate } from './kalshi-websocket';

export interface ExchangeData {
  binancePrice: number | null;
  krakenPrice: number | null;
  aggregatedPrice: number | null;
  lastUpdate: number | null;
  isConnected: boolean;
  kalshiMarkets: Map<string, KalshiMarketUpdate>;
  kalshiConnected: boolean;
  reconnect?: () => void;
}

export function useExchangeData(symbol: string = 'BTC/USD', kalshiMarkets: string[] = ['KXBTC15M']) {
  const [data, setData] = useState<ExchangeData>({
    binancePrice: null,
    krakenPrice: null,
    aggregatedPrice: null,
    lastUpdate: null,
    isConnected: false,
    kalshiMarkets: new Map(),
    kalshiConnected: false,
  });

  const restFallbackInterval = useRef<NodeJS.Timeout | null>(null);
  const wsConnectedRef = useRef(false);
  const mountedRef = useRef(true);
  const reconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;
    wsConnectedRef.current = false;

    // REST fallback: fetch from /api/btc when WebSockets are down
    const fetchRestFallback = async () => {
      try {
        const res = await fetch('/api/btc');
        if (!res.ok) throw new Error('REST fallback failed');
        const btcData = await res.json();

        if (btcData.price && mountedRef.current) {
          setData((prev) => ({
            ...prev,
            aggregatedPrice: btcData.price,
            lastUpdate: Date.now(),
            isConnected: false, // Using REST, not WS
          }));
        }
      } catch (error) {
        console.error('REST fallback error:', error);
      }
    };

    const handleBinanceUpdate = (update: any) => {
      if (!mounted) return;
      wsConnectedRef.current = true;
      setData((prev) => ({
        ...prev,
        binancePrice: update.price,
        lastUpdate: update.timestamp,
        isConnected: true,
      }));
    };

    const handleKrakenUpdate = (update: any) => {
      if (!mounted) return;
      wsConnectedRef.current = true;
      setData((prev) => ({
        ...prev,
        krakenPrice: update.price,
        lastUpdate: update.timestamp,
        isConnected: true,
      }));
    };

    const handleAggregatedUpdate = (update: any) => {
      if (!mounted) return;
      wsConnectedRef.current = true;
      setData((prev) => ({
        ...prev,
        aggregatedPrice: update.price,
        lastUpdate: update.timestamp,
      }));
    };

    const handleKalshiUpdate = (update: KalshiMarketUpdate) => {
      if (!mounted) return;
      setData((prev) => {
        const newMarkets = new Map(prev.kalshiMarkets);
        newMarkets.set(update.ticker, update);
        return {
          ...prev,
          kalshiMarkets: newMarkets,
          kalshiConnected: true,
        };
      });
    };

    // Reconnect function
    const reconnect = () => {
      if (!mounted) return;
      wsConnectedRef.current = false;
      priceAggregator.disconnectExchange('binance', 'BTCUSDT');
      priceAggregator.disconnectExchange('kraken', symbol);
      kalshiWS.disconnect();

      // Reconnect after short delay
      setTimeout(() => {
        if (!mounted) return;
        priceAggregator.connectExchange('binance', 'BTCUSDT', {
          onPriceUpdate: handleBinanceUpdate,
          onError: (error) => console.error('Binance error:', error),
        });
        priceAggregator.connectExchange('kraken', symbol, {
          onPriceUpdate: handleKrakenUpdate,
          onError: (error) => console.error('Kraken error:', error),
        });
        priceAggregator.subscribe(symbol, handleAggregatedUpdate);
        kalshiWS.connect();
      }, 1000);
    };

    reconnectRef.current = reconnect;

    // Connect to Binance and Kraken
    priceAggregator.connectExchange('binance', 'BTCUSDT', {
      onPriceUpdate: handleBinanceUpdate,
      onError: (error) => console.error('Binance error:', error),
    });

    priceAggregator.connectExchange('kraken', symbol, {
      onPriceUpdate: handleKrakenUpdate,
      onError: (error) => console.error('Kraken error:', error),
    });

    priceAggregator.subscribe(symbol, handleAggregatedUpdate);

    // Connect to Kalshi WebSocket
    const kalshiWS = getKalshiWebSocket({
      onMarketUpdate: handleKalshiUpdate,
      onConnect: () => {
        if (mounted) {
          wsConnectedRef.current = true;
          setData((prev) => ({ ...prev, kalshiConnected: true }));
        }
      },
      onDisconnect: () => {
        if (mounted) {
          wsConnectedRef.current = false;
          setData((prev) => ({ ...prev, kalshiConnected: false }));
        }
      },
      onError: (error) => console.error('Kalshi error:', error),
      markets: kalshiMarkets,
    });

    kalshiWS.connect();

    // Start REST fallback polling (every 5 seconds if WS not connected)
    restFallbackInterval.current = setInterval(() => {
      if (!wsConnectedRef.current && mounted) {
        fetchRestFallback();
      }
    }, 5000);

    // Auto-reconnect every 30 seconds if disconnected
    const autoReconnectInterval = setInterval(() => {
      if (!wsConnectedRef.current && mounted) {
        reconnect();
      }
    }, 30000);

    // Initial REST fetch if no WS data after 3 seconds
    const initialFallbackTimeout = setTimeout(() => {
      if (!wsConnectedRef.current && mounted && !data.aggregatedPrice) {
        fetchRestFallback();
      }
    }, 3000);

    return () => {
      mounted = false;
      if (restFallbackInterval.current) clearInterval(restFallbackInterval.current);
      clearInterval(autoReconnectInterval);
      clearTimeout(initialFallbackTimeout);
      priceAggregator.disconnectExchange('binance', 'BTCUSDT');
      priceAggregator.disconnectExchange('kraken', symbol);
      kalshiWS.disconnect();
    };
  }, [symbol, kalshiMarkets]);

  return { ...data, reconnect: reconnectRef.current };
}
