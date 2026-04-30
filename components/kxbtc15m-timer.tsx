'use client';

import { useState, useEffect } from 'react';
import { BRTISettlementCalculator } from '@/lib/brti-settlement';

interface KXBTC15MTimerProps {
  className?: string;
  expirySeconds?: number;
  currentWindow?: number;
}

export function KXBTC15MTimer({ 
  className = '',
  expirySeconds: propExpirySeconds,
  currentWindow: propCurrentWindow
}: KXBTC15MTimerProps) {
  const [nextExpiry, setNextExpiry] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentWindow, setCurrentWindow] = useState<number>(0);

  useEffect(() => {
    // If props provided, use them (synchronized)
    if (propExpirySeconds !== undefined) {
      setTimeRemaining(propExpirySeconds * 1000);
    }
    if (propCurrentWindow !== undefined) {
      setCurrentWindow(propCurrentWindow);
      return;
    }
    
    // Otherwise calculate locally
    const updateTimer = () => {
      const now = Date.now();
      const expiry = BRTISettlementCalculator.getNextKXBTC15MExpiry(now);
      setNextExpiry(expiry);
      setTimeRemaining(Math.max(0, expiry - now));
      
      // Current 15-minute window (0-3 for the 4 windows in an hour)
      const minutes = new Date(now).getMinutes();
      setCurrentWindow(Math.floor(minutes / 15));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [propExpirySeconds, propCurrentWindow]);

  // Use prop values if available, otherwise use local state
  const displayTimeRemaining = propExpirySeconds !== undefined ? propExpirySeconds * 1000 : timeRemaining;
  const displayWindow = propCurrentWindow !== undefined ? propCurrentWindow : currentWindow;
  
  const minutes = Math.floor(displayTimeRemaining / 60000);
  const seconds = Math.floor((displayTimeRemaining % 60000) / 1000);
  const milliseconds = displayTimeRemaining % 1000;

  const progress = displayTimeRemaining / (15 * 60 * 1000); // 15 minutes in ms

  return (
    <div className={`font-mono ${className}`}>
      <div className="text-xs text-gray-500 mb-1">KXBTC15M CONTRACT EXPIRY</div>
      <div className="flex items-baseline gap-2">
        <div className="text-4xl font-bold text-green-400 tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <div className="text-xl text-gray-600 tabular-nums">
          .{String(Math.floor(milliseconds / 10)).padStart(2, '0')}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-2 h-1 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Window indicator */}
      <div className="mt-2 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${
              i === currentWindow ? 'bg-green-500' : 'bg-gray-800'
            }`}
          />
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-600">
        Next expiry: {new Date(nextExpiry).toLocaleTimeString()}
      </div>
    </div>
  );
}
