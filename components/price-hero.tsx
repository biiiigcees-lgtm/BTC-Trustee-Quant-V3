"use client";
import { motion } from "framer-motion";

export function PriceHero({ asset, price, priceDir, change24h, verdict, lastUpdate, isStale }: {
  asset: string; price: number | null; priceDir: "up" | "down" | "";
  change24h: number | null; verdict: string | null;
  lastUpdate: number | null; isStale: boolean;
}) {
  const pc = priceDir === "up" ? "var(--neon-green)" : priceDir === "down" ? "var(--neon-red)" : "var(--cyan)";
  const cc = change24h != null ? (change24h >= 0 ? "var(--neon-green)" : "var(--neon-red)") : "var(--muted-foreground)";
  const vc = verdict === "ABOVE" ? "var(--neon-green)" : verdict === "BELOW" ? "var(--neon-red)" : "var(--amber)";

  const formatLastUpdate = (timestamp: number | null) => {
    if (!timestamp) return "---";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--cyan), transparent)" }} />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>{asset} / USD</p>
            {isStale && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: "var(--neon-red)22", color: "var(--neon-red)", border: "1px solid var(--neon-red)55" }}>
                STALE
              </span>
            )}
          </div>
          <motion.div key={price} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className="font-bold tabular-nums mt-1" style={{ color: pc, fontSize: "32px", lineHeight: 1, textShadow: `0 0 30px ${pc}44` }}>
            {price != null ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "---"}
          </motion.div>
          <div className="flex items-center gap-3 mt-1">
            {change24h != null && (
              <span className="font-semibold tabular-nums" style={{ color: cc, fontSize: "12px" }}>
                {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
              </span>
            )}
            <span className="font-medium tabular-nums" style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>
              Last Updated: {formatLastUpdate(lastUpdate)}
            </span>
          </div>
        </div>
        {verdict && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: `${vc}12`, border: `1px solid ${vc}55` }}>
            <span style={{ color: vc, fontSize: "18px", lineHeight: 1 }}>{verdict === "ABOVE" ? "▲" : verdict === "BELOW" ? "▼" : "—"}</span>
            <span className="font-bold" style={{ color: vc, fontSize: "13px", letterSpacing: "0.1em" }}>{verdict}</span>
          </div>
        )}
      </div>
    </div>
  );
}
