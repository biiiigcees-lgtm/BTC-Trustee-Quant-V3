"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface IndicatorCardProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  icon?: LucideIcon;
  accentColor?: string;
  compact?: boolean;
  sparkData?: number[];
}

export function IndicatorCard({
  label,
  value,
  sub,
  valueColor = "var(--foreground)",
  icon: Icon,
  accentColor = "var(--cyan)",
  compact = false,
}: IndicatorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card group relative overflow-hidden"
      style={compact ? { padding: "8px 10px" } : { padding: "12px 14px" }}
    >
      {/* Accent line */}
      <div
        className="absolute top-0 left-0 w-full h-px opacity-60"
        style={{ background: accentColor }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <Icon
                size={compact ? 10 : 12}
                style={{ color: accentColor, flexShrink: 0 }}
              />
            )}
            <span
              className="uppercase tracking-widest truncate"
              style={{
                color: "var(--muted-foreground)",
                fontSize: compact ? "8px" : "9px",
                letterSpacing: "0.1em",
              }}
            >
              {label}
            </span>
          </div>
          <span
            className="font-bold tabular-nums leading-tight"
            style={{
              color: valueColor,
              fontSize: compact ? "13px" : "16px",
            }}
          >
            {value}
          </span>
          {sub && (
            <span
              style={{
                color: "var(--muted-foreground)",
                fontSize: compact ? "7px" : "8px",
                letterSpacing: "0.04em",
              }}
            >
              {sub}
            </span>
          )}
        </div>
      </div>

      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${accentColor}10 0%, transparent 70%)`,
        }}
      />
    </motion.div>
  );
}
