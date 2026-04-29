import { AllocatorDashboard } from "@/components/allocator-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vaultex — AI Capital Allocator",
  description:
    "AI-powered autonomous capital allocation. Risk-managed growth through institutional-grade portfolio intelligence.",
};

export default function AllocatorPage() {
  return <AllocatorDashboard />;
}
