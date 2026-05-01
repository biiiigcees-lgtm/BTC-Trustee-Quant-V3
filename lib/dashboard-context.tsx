'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useExchangeData } from './use-exchange-data';
import { BRTISettlementCalculator } from './brti-settlement';

// Types
export interface TimeSync {
  expirySeconds: number;
  expiryLabel: string;
  currentWindow: number;
  progress: number;
  isExpiringSoon: boolean;
}

export interface PriceSync {
  price: number | null;
  priceDir: 'up' | 'down' | '';
  binancePrice: number | null;
  krakenPrice: number | null;
  aggregatedPrice: number | null;
  lastUpdate: number | null;
  isStale: boolean;
}

export interface DashboardState {
  time: TimeSync;
  price: PriceSync;
  kalshiConnected: boolean;
}

// Context
const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // Get real-time price data from WebSockets
  const exchangeData = useExchangeData('BTC/USD');
  
  // Price state
  const [price, setPrice] = useState<number | null>(null);
  const [priceDir, setPriceDir] = useState<'up' | 'down' | ''>('');
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  
  // Time state
  const [expirySeconds, setExpirySeconds] = useState<number>(() => {
    const now = Date.now();
    const expiry = BRTISettlementCalculator.getNextKXBTC15MExpiry(now);
    return Math.max(0, Math.floor((expiry - now) / 1000));
  });
  const [expiryLabel, setExpiryLabel] = useState<string>(() => {
    const now = Date.now();
    const expiry = BRTISettlementCalculator.getNextKXBTC15MExpiry(now);
    const date = new Date(expiry);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const [currentWindow, setCurrentWindow] = useState<number>(0);
  
  // Update price from exchange data
  useEffect(() => {
    if (exchangeData.aggregatedPrice && exchangeData.aggregatedPrice > 0) {
      const newPrice = exchangeData.aggregatedPrice;
      
      // Determine direction
      if (prevPrice !== null && prevPrice !== 0) {
        if (newPrice > prevPrice) setPriceDir('up');
        else if (newPrice < prevPrice) setPriceDir('down');
      }
      
      setPrevPrice(newPrice);
      setPrice(newPrice);
    }
  }, [exchangeData.aggregatedPrice, prevPrice]);
  
  // Synchronized timer effect
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiry = BRTISettlementCalculator.getNextKXBTC15MExpiry(now);
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      
      setExpirySeconds(remaining);
      setExpiryLabel(new Date(expiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      
      // Calculate current window (0-3 for 15-minute windows)
      const minutes = new Date(now).getMinutes();
      setCurrentWindow(Math.floor(minutes / 15));
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Memoized state
  const timeSync: TimeSync = useMemo(() => ({
    expirySeconds,
    expiryLabel,
    currentWindow,
    progress: expirySeconds / (15 * 60),
    isExpiringSoon: expirySeconds < 60,
  }), [expirySeconds, expiryLabel, currentWindow]);
  
  const priceSync: PriceSync = useMemo(() => {
    const isStale = exchangeData.lastUpdate
      ? (Date.now() - exchangeData.lastUpdate) > 10000 // 10 seconds threshold
      : true;

    return {
      price,
      priceDir,
      binancePrice: exchangeData.binancePrice,
      krakenPrice: exchangeData.krakenPrice,
      aggregatedPrice: exchangeData.aggregatedPrice,
      lastUpdate: exchangeData.lastUpdate,
      isStale,
    };
  }, [price, priceDir, exchangeData]);
  
  const value: DashboardState = useMemo(() => ({
    time: timeSync,
    price: priceSync,
    kalshiConnected: exchangeData.kalshiConnected,
  }), [timeSync, priceSync, exchangeData.kalshiConnected]);
  
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
