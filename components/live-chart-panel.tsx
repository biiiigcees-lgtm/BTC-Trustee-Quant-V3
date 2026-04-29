"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi, type LineData, type Time } from "lightweight-charts";

interface LiveChartPanelProps {
  closes: number[];
  ema9: number | null;
  ema21: number | null;
  bb: { upper: number; middle: number; lower: number; pctB: number } | null;
  price: number | null;
  height?: number;
}

export function LiveChartPanel({ closes, ema9, ema21, bb, price, height = 300 }: LiveChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<any>(null);
  const ema9SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.4)",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      width: containerRef.current.clientWidth,
      height,
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
      crosshair: {
        vertLine: { color: "rgba(0,255,231,0.3)", labelBackgroundColor: "rgba(0,255,231,0.15)" },
        horzLine: { color: "rgba(0,255,231,0.3)", labelBackgroundColor: "rgba(0,255,231,0.15)" },
      },
    });

    // Price line
    const priceSeries = chart.addLineSeries({
      color: "var(--cyan)" as unknown as string,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: "var(--cyan)" as unknown as string,
    });
    priceSeriesRef.current = priceSeries;

    // EMA 9
    const ema9Series = chart.addLineSeries({
      color: "#22c55e",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema9SeriesRef.current = ema9Series;

    // EMA 21
    const ema21Series = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema21SeriesRef.current = ema21Series;

    // BB Upper
    const bbUpper = chart.addLineSeries({
      color: "rgba(255,170,0,0.4)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbUpperRef.current = bbUpper;

    // BB Lower
    const bbLower = chart.addLineSeries({
      color: "rgba(255,170,0,0.4)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbLowerRef.current = bbLower;

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      initializedRef.current = false;
    };
  }, [height]);

  // Update data
  useEffect(() => {
    if (!chartRef.current || closes.length < 2) return;

    const now = Math.floor(Date.now() / 1000);
    const interval = 2; // 2s between closes

    const priceData: LineData<Time>[] = closes.map((c, i) => ({
      time: (now - (closes.length - i) * interval) as Time,
      value: c,
    }));

    priceSeriesRef.current?.setData(priceData);

    // EMA overlays - approximate by mapping over closes
    if (ema9 != null && closes.length > 9) {
      const ema9Data: LineData<Time>[] = [];
      // Generate EMA9 series from closes
      const k9 = 2 / 10;
      let e9 = closes.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
      for (let i = 9; i < closes.length; i++) {
        e9 = closes[i] * k9 + e9 * (1 - k9);
        ema9Data.push({ time: (now - (closes.length - i) * interval) as Time, value: e9 });
      }
      ema9SeriesRef.current?.setData(ema9Data);
    }

    if (ema21 != null && closes.length > 21) {
      const ema21Data: LineData<Time>[] = [];
      const k21 = 2 / 22;
      let e21 = closes.slice(0, 21).reduce((a, b) => a + b, 0) / 21;
      for (let i = 21; i < closes.length; i++) {
        e21 = closes[i] * k21 + e21 * (1 - k21);
        ema21Data.push({ time: (now - (closes.length - i) * interval) as Time, value: e21 });
      }
      ema21SeriesRef.current?.setData(ema21Data);
    }

    // BB bands
    if (bb && closes.length > 20) {
      const bbUpperData: LineData<Time>[] = [];
      const bbLowerData: LineData<Time>[] = [];
      const period = 20;
      for (let i = period; i < closes.length; i++) {
        const slice = closes.slice(i - period, i);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        const t = (now - (closes.length - i) * interval) as Time;
        bbUpperData.push({ time: t, value: mean + 2 * std });
        bbLowerData.push({ time: t, value: mean - 2 * std });
      }
      bbUpperRef.current?.setData(bbUpperData);
      bbLowerRef.current?.setData(bbLowerData);
    }

    // Scroll to latest
    chartRef.current.timeScale().scrollToRealTime();
  }, [closes, ema9, ema21, bb]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="uppercase tracking-widest font-bold" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>LIVE CHART</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" style={{ fontSize: "8px" }}>
            <span className="w-2 h-0.5 rounded" style={{ background: "var(--cyan)" }} /> Price
          </span>
          <span className="flex items-center gap-1" style={{ fontSize: "8px" }}>
            <span className="w-2 h-0.5 rounded" style={{ background: "#22c55e" }} /> EMA9
          </span>
          <span className="flex items-center gap-1" style={{ fontSize: "8px" }}>
            <span className="w-2 h-0.5 rounded" style={{ background: "#f59e0b" }} /> EMA21
          </span>
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
