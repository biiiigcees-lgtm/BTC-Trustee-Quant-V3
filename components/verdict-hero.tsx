"use client";
import { motion, AnimatePresence } from "framer-motion";

export function VerdictHero({ verdict, confidence, ev, kelly, reasoning, modelVotes, modelAgreement }: {
  verdict: "ABOVE" | "BELOW" | "PASS"; confidence: number; ev: number; kelly: number;
  reasoning?: string[]; modelVotes?: string[]; modelAgreement?: number;
}) {
  const vc = verdict === "ABOVE" ? "var(--neon-green)" : verdict === "BELOW" ? "var(--neon-red)" : "var(--amber)";
  const bg = verdict === "ABOVE" ? "rgba(0,230,118,0.06)" : verdict === "BELOW" ? "rgba(255,77,106,0.06)" : "rgba(255,179,0,0.06)";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={verdict + confidence}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.4 }}
        className="glass-card overflow-hidden relative"
        style={{ border: `1px solid ${vc}33` }}
      >
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${vc}, transparent)` }} />

        {/* Hero verdict */}
        <div className="p-5 flex items-center gap-4" style={{ background: bg }}>
          <div className="flex flex-col items-center" style={{ minWidth: "70px" }}>
            <span style={{ fontSize: "36px", lineHeight: 1, fontWeight: 900, color: vc }}>
              {verdict === "ABOVE" ? "▲" : verdict === "BELOW" ? "▼" : "—"}
            </span>
            <span className="font-black mt-1" style={{ color: vc, fontSize: "16px", letterSpacing: "0.1em" }}>{verdict}</span>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-3">
              <div>
                <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "8px" }}>CONF</span>
                <div className="font-black tabular-nums" style={{ color: confidence >= 75 ? "var(--neon-green)" : confidence >= 60 ? "var(--amber)" : "var(--muted-foreground)", fontSize: "22px" }}>{confidence}%</div>
              </div>
              <div>
                <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "8px" }}>EV</span>
                <div className="font-black tabular-nums" style={{ color: ev >= 0 ? "var(--neon-green)" : "var(--neon-red)", fontSize: "16px" }}>{ev >= 0 ? "+" : ""}{ev}%</div>
              </div>
              <div>
                <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "8px" }}>KELLY</span>
                <div className="font-black tabular-nums" style={{ color: kelly > 0 ? "var(--cyan)" : "var(--muted-foreground)", fontSize: "16px" }}>{kelly > 0 ? `${kelly.toFixed(1)}%` : "—"} </div>
              </div>
            </div>
            {modelAgreement != null && (
              <div className="flex items-center gap-2 mt-1">
                <span style={{ color: "var(--muted-foreground)", fontSize: "8px" }}>MODEL AGREEMENT</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${modelAgreement}%`, background: vc }} />
                </div>
                <span className="font-bold tabular-nums" style={{ color: vc, fontSize: "10px" }}>{modelAgreement}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Reasoning */}
        {reasoning && reasoning.length > 0 && (
          <div className="px-5 py-3 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
            {reasoning.slice(0, 4).map((r, i) => (
              <div key={i} className="flex items-start gap-2" style={{ fontSize: "11px", lineHeight: 1.5 }}>
                <span style={{ color: vc, fontWeight: 800, fontSize: "8px", marginTop: "3px" }}>{i + 1}.</span>
                <span style={{ color: "var(--foreground)" }}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Model votes */}
        {modelVotes && modelVotes.length > 0 && (
          <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontSize: "8px" }}>VOTES</span>
            {modelVotes.map((v, i) => {
              const c = v === "ABOVE" ? "var(--neon-green)" : v === "BELOW" ? "var(--neon-red)" : "var(--amber)";
              return <span key={i} className="px-1.5 py-0.5 rounded font-bold" style={{ background: `${c}15`, border: `1px solid ${c}33`, color: c, fontSize: "8px" }}>{v}</span>;
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
