"use client";
import { motion } from "framer-motion";
import { BarChart3, Brain, LineChart, Target, Bell } from "lucide-react";

export type TabId = "dashboard" | "analysis" | "optimizer" | "trade" | "alerts";

const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "DASH", icon: BarChart3 },
  { id: "analysis", label: "ANALYSIS", icon: LineChart },
  { id: "optimizer", label: "AI OPT", icon: Brain },
  { id: "trade", label: "TRADE", icon: Target },
  { id: "alerts", label: "ALERTS", icon: Bell },
];

export function DashboardTabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap relative"
            style={{
              background: isActive ? "rgba(0,255,231,0.08)" : "transparent",
              border: `1px solid ${isActive ? "var(--cyan)" : "var(--border)"}`,
              color: isActive ? "var(--cyan)" : "var(--muted-foreground)",
              fontFamily: "inherit",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <Icon size={12} />
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 inset-x-1 h-0.5 rounded-full"
                style={{ background: "var(--cyan)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
