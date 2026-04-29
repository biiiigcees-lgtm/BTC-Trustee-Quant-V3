"use client";

import { useEffect, useRef, useCallback } from "react";

interface SparklineProps {
  prices: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ prices, color = "#00ffe7", height = 60 }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear if not enough data
    if (prices.length < 2) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    if (W === 0 || H === 0) return;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padT = 6;
    const padB = 6;

    const toX = (i: number) => (i / (prices.length - 1)) * W;
    const toY = (p: number) => padT + (1 - (p - min) / range) * (H - padT - padB);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, H);
    grad.addColorStop(0, color + "40");
    grad.addColorStop(1, color + "00");

    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = toX(i);
      const y = toY(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    // Close fill path along the bottom
    ctx.lineTo(toX(prices.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = toX(i);
      const y = toY(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();

    // Current price dot
    const lastX = toX(prices.length - 1);
    const lastY = toY(prices[prices.length - 1]);
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }, [prices, color]);

  // Redraw when prices/color change
  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: `${height}px`, display: "block" }}
    />
  );
}
