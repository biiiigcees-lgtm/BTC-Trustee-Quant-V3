"use client";

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/market-store';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

export function PremiumBTCChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const strikeLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const { currentPrice } = useMarketStore();
  const [strikePrice, setStrikePrice] = useState<number>(76500);
  const [activeIndicator, setActiveIndicator] = useState<'none' | 'rsi' | 'volume'>('volume');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('15m');

  useEffect(() => {
    if (currentPrice) {
      const roundedStrike = Math.round(currentPrice / 500) * 500;
      setStrikePrice(roundedStrike);
    }
  }, [currentPrice]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#22C55E',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: '#22C55E',
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#22C55E',
      topColor: 'rgba(34, 197, 94, 0.4)',
      bottomColor: 'rgba(34, 197, 94, 0.0)',
      lineWidth: 2,
    });
    seriesRef.current = areaSeries;

    const ema9Series = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      lineStyle: 2,
    });
    ema9SeriesRef.current = ema9Series;

    const ema21Series = chart.addLineSeries({
      color: '#8B5CF6',
      lineWidth: 1,
      lineStyle: 2,
    });
    ema21SeriesRef.current = ema21Series;

    const strikeLine = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 2,
      lineStyle: 3,
    });
    strikeLineRef.current = strikeLine;

    const volumeSeries = chart.addHistogramSeries({
      color: '#22C55E',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });
    volumeSeriesRef.current = volumeSeries;

    const rsiSeries = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 1,
      priceScaleId: 'rsi',
    });
    rsiSeriesRef.current = rsiSeries;

    chart.priceScale('rsi').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.8,
      },
    });

    const generateMockData = () => {
      const data: { time: Time; value: number }[] = [];
      const ema9Data: { time: Time; value: number }[] = [];
      const ema21Data: { time: Time; value: number }[] = [];
      const strikeData: { time: Time; value: number }[] = [];
      const volumeData: { time: Time; value: number; color: string }[] = [];
      const rsiData: { time: Time; value: number }[] = [];
      
      const basePrice = currentPrice || 76500;
      const now = Math.floor(Date.now() / 1000);
      const interval = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600;
      
      let price = basePrice;
      let ema9 = basePrice;
      let ema21 = basePrice;
      let rsi = 50;
      
      for (let i = 100; i >= 0; i--) {
        const time = (now - (i * interval)) as Time;
        
        const change = (Math.random() - 0.5) * 200;
        const isUp = change > 0;
        price = Math.max(price + change, basePrice - 1000);
        
        const k9 = 2 / 10;
        const k21 = 2 / 22;
        ema9 = price * k9 + ema9 * (1 - k9);
        ema21 = price * k21 + ema21 * (1 - k21);
        
        rsi = Math.max(0, Math.min(100, rsi + (isUp ? 5 : -5) + (Math.random() - 0.5) * 10));
        
        const volume = Math.random() * 1000000 + 500000;
        
        data.push({ time, value: price });
        ema9Data.push({ time, value: ema9 });
        ema21Data.push({ time, value: ema21 });
        strikeData.push({ time, value: strikePrice });
        volumeData.push({ 
          time, 
          value: volume, 
          color: isUp ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' 
        });
        rsiData.push({ time, value: rsi });
      }
      
      return { data, ema9Data, ema21Data, strikeData, volumeData, rsiData };
    };

    const { data, ema9Data, ema21Data, strikeData, volumeData, rsiData } = generateMockData();

    areaSeries.setData(data);
    ema9Series.setData(ema9Data);
    ema21Series.setData(ema21Data);
    strikeLine.setData(strikeData);
    volumeSeries.setData(volumeData);
    
    if (activeIndicator === 'rsi') {
      rsiSeries.setData(rsiData);
      rsiSeries.applyOptions({ visible: true });
      volumeSeries.applyOptions({ visible: false });
    } else if (activeIndicator === 'volume') {
      volumeSeries.applyOptions({ visible: true });
      rsiSeries.applyOptions({ visible: false });
    } else {
      volumeSeries.applyOptions({ visible: false });
      rsiSeries.applyOptions({ visible: false });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [currentPrice, strikePrice, activeIndicator, timeframe]);

  return (
    <div className="glass-card rounded-xl p-4 border border-subtle">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider">
            BTC/USD Live Chart
          </div>
          <div className="flex items-center gap-1">
            {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeframe === tf 
                    ? 'bg-accent-cyan/20 text-accent-cyan' 
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-cyan-500" />
            <span>EMA 9</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-purple-500" />
            <span>EMA 21</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-amber-500" />
            <span>Strike</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveIndicator('none')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            activeIndicator === 'none' 
              ? 'bg-card border border-subtle text-primary' 
              : 'text-muted hover:text-primary'
          }`}
        >
          <Activity className="w-3 h-3" />
          Price
        </button>
        <button
          onClick={() => setActiveIndicator('volume')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            activeIndicator === 'volume' 
              ? 'bg-card border border-subtle text-primary' 
              : 'text-muted hover:text-primary'
          }`}
        >
          <BarChart3 className="w-3 h-3" />
          Volume
        </button>
        <button
          onClick={() => setActiveIndicator('rsi')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            activeIndicator === 'rsi' 
              ? 'bg-card border border-subtle text-primary' 
              : 'text-muted hover:text-primary'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          RSI
        </button>
      </div>
      
      <div ref={chartContainerRef} className="w-full h-[400px]" />
    </div>
  );
}
