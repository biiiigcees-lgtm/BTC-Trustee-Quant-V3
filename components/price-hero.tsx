"use client";
import { motion } from "framer-motion";

export function PriceHero({ asset, price, priceDir, change24h, verdict }: {
  asset: string; price: number | null; priceDir: "up" | "down" | "";
  change24h: number | null; verdict: string | null;
}) {
  const pc = priceDir === "up" ? "var(--neon-green)" : priceDir === "down" ? "var(--neon-red)" : "var(--cyan)";
  const cc = change24h != null ? (change24h >= 0 ? "var(--neon-green)" : "var(--neon-red)") : "var(--muted-foreground)";
  const vc = verdict === "ABOVE" ? "var(--neon-green)" : verdict === "BELOW" ? "var(--neon-red)" : "var(--amber)";

  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--cyan), transparent)" }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "10px" }}>{asset} / USD</p>
          <motion.div key={price} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className="font-bold tabular-nums mt-1" style={{ color: pc, fontSize: "32px", lineHeight: 1, textShadow: `0 0 30px ${pc}44` }}>
            {price != null ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "---"}
          </motion.div>
          {change24h != null && (
            <span className="font-semibold tabular-nums mt-1" style={{ color: cc, fontSize: "12px" }}>
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          )}
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
