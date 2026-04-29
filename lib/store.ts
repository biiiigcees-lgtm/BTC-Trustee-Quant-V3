import { create } from 'zustand';
import { IndicatorConfig } from './types';

interface IndicatorStore {
  config: IndicatorConfig;
  updateConfig: (config: Partial<IndicatorConfig>) => void;
  resetConfig: () => void;
}

const defaultConfig: IndicatorConfig = {
  ema: { enabled: true, period: 20, color: '#00ff88' },
  sma: { enabled: false, period: 50, color: '#4488ff' },
  rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
  bollinger: { enabled: true, period: 20, multiplier: 2 },
  macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
  volume: { enabled: true },
};

export const useIndicatorStore = create<IndicatorStore>((set) => ({
  config: defaultConfig,
  updateConfig: (newConfig) =>
    set((state) => ({
      config: { ...state.config, ...newConfig },
    })),
  resetConfig: () => set({ config: defaultConfig }),
}));
