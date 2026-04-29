'use client';

import { useState } from 'react';

interface TradeControlsProps {
  currentPrice: number;
  onPlaceBet?: (type: 'YES' | 'NO', amount: number) => void;
  onOverride?: () => void;
  className?: string;
}

export function TradeControls({ 
  currentPrice, 
  onPlaceBet, 
  onOverride,
  className = '' 
}: TradeControlsProps) {
  const [targetPrice, setTargetPrice] = useState<string>(
    (Math.round(currentPrice / 50) * 50).toString()
  );
  const [amount, setAmount] = useState<string>('100');
  const [selectedBet, setSelectedBet] = useState<'YES' | 'NO' | null>(null);

  const handlePlaceBet = () => {
    if (selectedBet && onPlaceBet) {
      onPlaceBet(selectedBet, parseFloat(amount));
      setSelectedBet(null);
    }
  };

  const strikeSuggestions = [
    Math.round(currentPrice / 50) * 50 - 100,
    Math.round(currentPrice / 50) * 50,
    Math.round(currentPrice / 50) * 50 + 100,
  ];

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-lg p-4 ${className}`}>
      <h2 className="text-lg font-bold text-white font-mono mb-4">TRADE CONTROLS</h2>

      {/* Target price input */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 font-mono block mb-2">TARGET PRICE</label>
        <div className="flex gap-2 mb-2">
          {strikeSuggestions.map((price) => (
            <button
              key={price}
              onClick={() => setTargetPrice(price.toString())}
              className={`px-3 py-1 rounded text-xs font-mono ${
                targetPrice === price.toString()
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              ${price.toLocaleString()}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
          placeholder="Enter target price"
        />
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 font-mono block mb-2">AMOUNT ($)</label>
        <div className="flex gap-2 mb-2">
          {['50', '100', '250', '500'].map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt)}
              className={`px-3 py-1 rounded text-xs font-mono ${
                amount === amt
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
          placeholder="Enter amount"
        />
      </div>

      {/* Bet type selection */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 font-mono block mb-2">BET TYPE</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedBet('YES')}
            className={`px-4 py-3 rounded font-mono font-bold transition-all ${
              selectedBet === 'YES'
                ? 'bg-green-500 text-black'
                : 'bg-green-500/20 text-green-400 border border-green-500'
            }`}
          >
            YES
          </button>
          <button
            onClick={() => setSelectedBet('NO')}
            className={`px-4 py-3 rounded font-mono font-bold transition-all ${
              selectedBet === 'NO'
                ? 'bg-red-500 text-black'
                : 'bg-red-500/20 text-red-400 border border-red-500'
            }`}
          >
            NO
          </button>
        </div>
      </div>

      {/* Place bet button */}
      <button
        onClick={handlePlaceBet}
        disabled={!selectedBet}
        className={`w-full py-3 rounded font-mono font-bold transition-all ${
          selectedBet
            ? 'bg-cyan-500 text-black hover:bg-cyan-400'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        PLACE BET
      </button>

      {/* Override button */}
      {onOverride && (
        <button
          onClick={onOverride}
          className="w-full mt-2 py-2 rounded font-mono text-sm border border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 transition-all"
        >
          OVERRIDE AI DECISION
        </button>
      )}

      {/* Current price display */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 font-mono">CURRENT PRICE</span>
          <span className="text-lg font-bold text-white font-mono tabular-nums">
            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400 font-mono">DISTANCE TO TARGET</span>
          <span className={`text-sm font-mono tabular-nums ${
            parseFloat(targetPrice) > currentPrice ? 'text-green-400' : 'text-red-400'
          }`}>
            {parseFloat(targetPrice) > currentPrice ? '+' : ''}${(parseFloat(targetPrice) - currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
