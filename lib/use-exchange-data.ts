'use client';

import { useState, useEffect } from 'react';
import { priceAggregator } from './exchange-websockets';

export interface ExchangeData {
  binancePrice: number | null;
  krakenPrice: number | null;
  aggregatedPrice: number | null;
  lastUpdate: number | null;
  isConnected: boolean;
}

export function useExchangeData(symbol: string = 'BTC/USD') {
  const [data, setData] = useState<ExchangeData>({
    binancePrice: null,
    krakenPrice: null,
    aggregatedPrice: null,
    lastUpdate: null,
    isConnected: false,
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

    priceAggregator.connectExchange('binance', 'BTCUSDT', {
      onPriceUpdate: handleBinanceUpdate,
      onError: (error) => console.error('Binance error:', error),
    });

    priceAggregator.connectExchange('kraken', symbol, {
      onPriceUpdate: handleKrakenUpdate,
      onError: (error) => console.error('Kraken error:', error),
    });

    priceAggregator.subscribe(symbol, handleAggregatedUpdate);

    return () => {
      mounted = false;
      priceAggregator.disconnectExchange('binance', 'BTCUSDT');
      priceAggregator.disconnectExchange('kraken', symbol);
    };
  }, [symbol]);

  return data;
}
