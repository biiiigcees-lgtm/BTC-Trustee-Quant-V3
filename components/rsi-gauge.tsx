"use client";

interface RsiGaugeProps {
  value: number | null;
}

export function RsiGauge({ value }: RsiGaugeProps) {
  if (value === null) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span>RSI(14)</span>
          <span>--</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }} />
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, value));
  let color = "var(--cyan)";
  let label = "NEUTRAL";

  if (value >= 70) {
    color = "var(--neon-red)";
    label = "OVERBOUGHT";
  } else if (value <= 30) {
    color = "var(--neon-green)";
    label = "OVERSOLD";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>RSI(14)</span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color, fontSize: "10px", letterSpacing: "0.05em" }}>{label}</span>
          <span className="text-sm font-bold" style={{ color }}>{value.toFixed(1)}</span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        {/* Overbought zone */}
        <div
          className="absolute top-0 right-0 h-full opacity-20"
          style={{ width: "30%", background: "var(--neon-red)" }}
        />
        {/* Oversold zone */}
        <div
          className="absolute top-0 left-0 h-full opacity-20"
          style={{ width: "30%", background: "var(--neon-green)" }}
        />
        {/* Fill bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>
        <span>0</span>
        <span>30</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}
