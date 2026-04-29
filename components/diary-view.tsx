'use client';

import { useState, useEffect } from 'react';

interface DiaryEntry {
  entry_id: string;
  user_id: string;
  ticker: string;
  decision: 'HOLD' | 'PASS';
  shadow_prediction: 'ABOVE' | 'BELOW' | null;
  confidence: number;
  reason_text: string;
  strike_price: number | null;
  current_price: number | null;
  expiry_time: string | null;
  created_at: string;
  market_regime: string | null;
  volatility_level: string | null;
  risk_warnings: string[] | null;
}

interface DiaryViewProps {
  userId?: string;
  className?: string;
}

export function DiaryView({ userId = 'default', className = '' }: DiaryViewProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiary = async () => {
      try {
        const response = await fetch(`/api/diary?userId=${userId}`);
        const data = await response.json();
        setEntries(data.entries || []);
      } catch (error) {
        console.error('Failed to fetch diary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiary();
  }, [userId]);

  const totalEntries = entries.length;
  const holdCount = entries.filter((e) => e.decision === 'HOLD').length;
  const passCount = entries.filter((e) => e.decision === 'PASS').length;
  const avgConfidence = entries.length > 0 
    ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length 
    : 0;

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white font-mono">SECRET DIARY</h2>
        <div className="flex gap-4 text-xs font-mono">
          <div className="text-gray-400">
            HOLDS: <span className="text-yellow-400">{holdCount}</span>
          </div>
          <div className="text-gray-400">
            PASSES: <span className="text-gray-500">{passCount}</span>
          </div>
          <div className="text-gray-400">
            AVG CONF: <span className="text-cyan-400">{avgConfidence.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading diary...</div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-white font-mono">{totalEntries}</div>
              <div className="text-xs text-gray-500">TOTAL</div>
            </div>
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400 font-mono">{holdCount}</div>
              <div className="text-xs text-gray-500">HOLDS</div>
            </div>
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-gray-500 font-mono">{passCount}</div>
              <div className="text-xs text-gray-500">PASSES</div>
            </div>
          </div>

          {/* Diary entries */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.entry_id}
                className="bg-gray-800/30 border border-gray-700/50 rounded p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        entry.decision === 'HOLD'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {entry.decision}
                    </span>
                    {entry.shadow_prediction && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-mono ${
                          entry.shadow_prediction === 'ABOVE'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {entry.shadow_prediction}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">
                      {entry.confidence}%
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-gray-300 mb-2">{entry.reason_text}</div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {entry.market_regime && (
                    <span>Regime: {entry.market_regime}</span>
                  )}
                  {entry.volatility_level && (
                    <span>Vol: {entry.volatility_level}</span>
                  )}
                  {entry.current_price && (
                    <span>Price: ${entry.current_price.toLocaleString()}</span>
                  )}
                </div>

                {entry.risk_warnings && entry.risk_warnings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.risk_warnings.map((warning, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs"
                      >
                        {warning}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {entries.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No diary entries yet
            </div>
          )}
        </>
      )}
    </div>
  );
}
