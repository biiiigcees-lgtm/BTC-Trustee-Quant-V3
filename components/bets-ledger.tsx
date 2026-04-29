'use client';

import { useState, useEffect } from 'react';

interface Bet {
  id: string;
  ticker: string;
  betType: 'YES' | 'NO';
  contractType: 'ABOVE' | 'BELOW';
  strikePrice: number;
  amount: number;
  entryPrice: number;
  outcome: 'WIN' | 'LOSS' | 'PENDING' | 'CANCELLED';
  payout: number;
  profitLoss: number;
  confidence: number;
  expiryTime: number;
  createdAt: number;
}

interface BetsLedgerProps {
  userId?: string;
  className?: string;
}

export function BetsLedger({ userId = 'default', className = '' }: BetsLedgerProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch from API
    // For now, use mock data
    const mockBets: Bet[] = [
      {
        id: '1',
        ticker: 'KXBTC15M',
        betType: 'YES',
        contractType: 'ABOVE',
        strikePrice: 85000,
        amount: 100,
        entryPrice: 55,
        outcome: 'WIN',
        payout: 181.82,
        profitLoss: 81.82,
        confidence: 87,
        expiryTime: Date.now() - 3600000,
        createdAt: Date.now() - 7200000,
      },
      {
        id: '2',
        ticker: 'KXBTC15M',
        betType: 'NO',
        contractType: 'ABOVE',
        strikePrice: 85200,
        amount: 100,
        entryPrice: 48,
        outcome: 'LOSS',
        payout: 0,
        profitLoss: -100,
        confidence: 72,
        expiryTime: Date.now() - 1800000,
        createdAt: Date.now() - 5400000,
      },
      {
        id: '3',
        ticker: 'KXBTC15M',
        betType: 'YES',
        contractType: 'ABOVE',
        strikePrice: 84800,
        amount: 100,
        entryPrice: 62,
        outcome: 'PENDING',
        payout: 0,
        profitLoss: 0,
        confidence: 91,
        expiryTime: Date.now() + 900000,
        createdAt: Date.now() - 600000,
      },
    ];

    setBets(mockBets);
    setLoading(false);
  }, [userId]);

  const totalBets = bets.length;
  const wins = bets.filter((b) => b.outcome === 'WIN').length;
  const losses = bets.filter((b) => b.outcome === 'LOSS').length;
  const pending = bets.filter((b) => b.outcome === 'PENDING').length;
  const winRate = totalBets > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0';
  const totalPnL = bets.reduce((sum, b) => sum + b.profitLoss, 0);

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white font-mono">BETS LEDGER</h2>
        <div className="flex gap-4 text-xs font-mono">
          <div className="text-gray-400">
            WIN RATE: <span className="text-green-400">{winRate}%</span>
          </div>
          <div className="text-gray-400">
            TOTAL P&L: <span className={totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
              ${totalPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading bets...</div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-white font-mono">{totalBets}</div>
              <div className="text-xs text-gray-500">TOTAL</div>
            </div>
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-green-400 font-mono">{wins}</div>
              <div className="text-xs text-gray-500">WINS</div>
            </div>
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-red-400 font-mono">{losses}</div>
              <div className="text-xs text-gray-500">LOSSES</div>
            </div>
            <div className="bg-gray-800/50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400 font-mono">{pending}</div>
              <div className="text-xs text-gray-500">PENDING</div>
            </div>
          </div>

          {/* Bets table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-2 font-mono">TIME</th>
                  <th className="pb-2 font-mono">TYPE</th>
                  <th className="pb-2 font-mono">STRIKE</th>
                  <th className="pb-2 font-mono">ENTRY</th>
                  <th className="pb-2 font-mono">CONF</th>
                  <th className="pb-2 font-mono">OUTCOME</th>
                  <th className="pb-2 font-mono text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 text-gray-400 font-mono text-xs">
                      {new Date(bet.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${
                        bet.betType === 'YES' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {bet.betType}
                      </span>
                    </td>
                    <td className="py-2 text-white font-mono">${bet.strikePrice.toLocaleString()}</td>
                    <td className="py-2 text-gray-400 font-mono">{bet.entryPrice}¢</td>
                    <td className="py-2 text-gray-400 font-mono">{bet.confidence}%</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${
                        bet.outcome === 'WIN' ? 'bg-green-500/20 text-green-400' :
                        bet.outcome === 'LOSS' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {bet.outcome}
                      </span>
                    </td>
                    <td className={`py-2 text-right font-mono ${
                      bet.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {bet.profitLoss >= 0 ? '+' : ''}${bet.profitLoss.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
