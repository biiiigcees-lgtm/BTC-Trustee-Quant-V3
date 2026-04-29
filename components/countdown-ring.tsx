"use client";

import { motion } from "framer-motion";

interface CountdownRingProps {
  seconds: number;
  totalSeconds?: number;
  label?: string;
  size?: number;
}

export function CountdownRing({
  seconds,
  totalSeconds = 900,
  label,
  size = 80,
}: CountdownRingProps) {
  const pct = seconds / totalSeconds;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const color =
    pct > 0.5 ? "var(--neon-green)" : pct > 0.25 ? "var(--amber)" : "var(--neon-red)";
  const glowColor =
    pct > 0.5
      ? "var(--neon-green-glow)"
      : pct > 0.25
        ? "var(--amber-glow)"
        : "var(--neon-red-glow)";

  // SVG circle params
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold tabular-nums"
            style={{ color, fontSize: size > 70 ? "16px" : "13px", lineHeight: 1 }}
          >
            {timeStr}
          </span>
        </div>
      </div>
      {label && (
        <span
          className="uppercase tracking-widest"
          style={{ color: "var(--muted-foreground)", fontSize: "8px", letterSpacing: "0.12em" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
