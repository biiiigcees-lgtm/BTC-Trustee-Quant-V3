'use client';

import { useState, useEffect } from 'react';

interface ForecastData {
  verdict: 'ABOVE' | 'BELOW' | 'PASS';
  confidence: number;
  predictedProbability: number;
  currentPrice: number;
  targetPrice: number;
  expiryTime: number;
  reason: string;
  isSafeBet: boolean;
}

interface ForecastDisplayProps {
  className?: string;
}

export function ForecastDisplay({ className = '' }: ForecastDisplayProps) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate real-time forecast updates
    // In production, this would connect to the AI prediction API
    const generateForecast = () => {
      const currentPrice = 85000 + (Math.random() - 0.5) * 1000;
      const predictedProbability = 0.5 + (Math.random() - 0.5) * 0.3;
      const confidence = Math.round(predictedProbability * 100);
      
      const verdict = confidence >= 85 
        ? (predictedProbability > 0.5 ? 'ABOVE' : 'BELOW')
        : 'PASS';

      setForecast({
        verdict,
        confidence,
        predictedProbability,
        currentPrice,
        targetPrice: Math.round(currentPrice / 50) * 50,
        expiryTime: Date.now() + 15 * 60 * 1000,
        reason: confidence >= 85 
          ? 'High confidence based on momentum and market regime'
          : 'Insufficient confidence - waiting for clearer signal',
        isSafeBet: confidence >= 90,
      });
      setLoading(false);
    };

    generateForecast();
    const interval = setInterval(generateForecast, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`bg-gray-900/50 border border-gray-800 rounded-lg p-4 ${className}`}>
        <div className="text-center text-gray-500 py-8">Loading forecast...</div>
      </div>
    );
  }

  if (!forecast) return null;

  const verdictColor = 
    forecast.verdict === 'ABOVE' ? 'text-green-400' :
    forecast.verdict === 'BELOW' ? 'text-red-400' : 'text-yellow-400';

  const confidenceColor = 
    forecast.confidence >= 90 ? 'bg-green-500' :
    forecast.confidence >= 75 ? 'bg-yellow-500' : 'bg-gray-500';

  const timeToExpiry = Math.max(0, forecast.expiryTime - Date.now());
  const minutes = Math.floor(timeToExpiry / 60000);
  const seconds = Math.floor((timeToExpiry % 60000) / 1000);

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white font-mono">AI FORECAST</h2>
        {forecast.isSafeBet && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-mono">
            SAFE BET
          </span>
        )}
      </div>

      {/* Main verdict */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-bold font-mono ${verdictColor} mb-2`}>
          {forecast.verdict}
        </div>
        <div className="text-sm text-gray-400">
          Target: ${forecast.targetPrice.toLocaleString()}
        </div>
      </div>

      {/* Confidence meter */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-400 font-mono">CONFIDENCE</span>
          <span className="text-xs font-bold text-white font-mono">{forecast.confidence}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${confidenceColor}`}
            style={{ width: `${forecast.confidence}%` }}
          />
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400 font-mono">TIME TO EXPIRY</span>
        <span className="text-xl font-bold text-white font-mono tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      {/* Current price */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400 font-mono">CURRENT PRICE</span>
        <span className="text-lg font-bold text-white font-mono tabular-nums">
          ${forecast.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Reason */}
      <div className="bg-gray-800/50 rounded p-3">
        <span className="text-xs text-gray-400 font-mono block mb-1">RATIONALE</span>
        <p className="text-sm text-gray-300">{forecast.reason}</p>
      </div>

      {/* Predicted probability */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-mono">PREDICTED PROBABILITY</span>
        <span className="text-sm font-bold text-white font-mono">
          {(forecast.predictedProbability * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
