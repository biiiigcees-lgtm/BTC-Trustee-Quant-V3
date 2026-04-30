'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    let mounted = true;

    const handleBinanceUpdate = (update: any) => {
      if (!mounted) return;
      setData((prev) => ({
        ...prev,
        binancePrice: update.price,
        lastUpdate: update.timestamp,
        isConnected: true,
      }));
    };

    const handleKrakenUpdate = (update: any) => {
      if (!mounted) return;
      setData((prev) => ({
        ...prev,
        krakenPrice: update.price,
        lastUpdate: update.timestamp,
        isConnected: true,
      }));
    };

    const handleAggregatedUpdate = (update: any) => {
      if (!mounted) return;
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
          setData((prev) => ({ ...prev, kalshiConnected: true }));
        }
      },
      onDisconnect: () => {
        if (mounted) {
          setData((prev) => ({ ...prev, kalshiConnected: false }));
        }
      },
      onError: (error) => console.error('Kalshi error:', error),
      markets: kalshiMarkets,
    });

    kalshiWS.connect();

    return () => {
      mounted = false;
      priceAggregator.disconnectExchange('binance', 'BTCUSDT');
      priceAggregator.disconnectExchange('kraken', symbol);
      kalshiWS.disconnect();
    };
  }, [symbol, kalshiMarkets]);

  return data;
}
