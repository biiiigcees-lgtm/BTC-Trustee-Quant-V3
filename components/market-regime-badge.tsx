"use client";

interface MarketRegimeBadgeProps {
  readonly regime: string | null;
  readonly size?: "sm" | "md" | "lg";
}

const REGIME_CONFIG: Record<string, { readonly color: string; readonly bg: string; readonly border: string; readonly icon: string }> = {
  "TRENDING UP": {
    color: "#00ff88",
    bg: "rgba(0, 255, 136, 0.1)",
    border: "rgba(0, 255, 136, 0.3)",
    icon: "▲",
  },
  "TRENDING DOWN": {
    color: "#ff4466",
    bg: "rgba(255, 68, 102, 0.1)",
    border: "rgba(255, 68, 102, 0.3)",
    icon: "▼",
  },
  RANGING: {
    color: "#8888aa",
    bg: "rgba(136, 136, 170, 0.1)",
    border: "rgba(136, 136, 170, 0.3)",
    icon: "◌",
  },
  SQUEEZE: {
    color: "#ffaa00",
    bg: "rgba(255, 170, 0, 0.1)",
    border: "rgba(255, 170, 0, 0.3)",
    icon: "◆",
  },
  VOLATILE: {
    color: "#ff66cc",
    bg: "rgba(255, 102, 204, 0.1)",
    border: "rgba(255, 102, 204, 0.3)",
    icon: "⚡",
  },
};

const DEFAULT_CONFIG = {
  color: "#555570",
  bg: "rgba(85, 85, 112, 0.1)",
  border: "rgba(85, 85, 112, 0.3)",
  icon: "○",
};

const SIZE_CONFIG = {
  sm: { fontSize: "8px", padding: "1px 4px", iconSize: "6px" },
  md: { fontSize: "10px", padding: "2px 6px", iconSize: "8px" },
  lg: { fontSize: "12px", padding: "3px 8px", iconSize: "10px" },
} as const;

export function MarketRegimeBadge({ regime, size = "sm" }: MarketRegimeBadgeProps) {
  if (!regime) return null;

  const config = REGIME_CONFIG[regime] ?? DEFAULT_CONFIG;
  const s = SIZE_CONFIG[size];

  return (
    <span
      className="inline-flex items-center gap-1 rounded font-mono font-bold uppercase"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: s.fontSize,
        letterSpacing: "0.08em",
        padding: s.padding,
      }}
    >
      <span style={{ fontSize: s.iconSize }}>{config.icon}</span>
      {regime}
    </span>
  );
}
