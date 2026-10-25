"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { triggerRefresh } from "@/lib/api";
import { IS_STATIC_MODE } from "@/lib/config";

export type AppTab = "insights" | "trades" | "explorer";

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await triggerRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 1500);
    }
  }

  return (
    <header className="border-b border-zinc-800 px-4 sm:px-6 min-h-12 py-2 flex flex-wrap gap-3 items-center justify-between shrink-0">
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm tracking-tight">Capitol Trades</span>
          <span className="hidden sm:inline text-zinc-700 text-xs">·</span>
          <span className="hidden sm:inline text-zinc-500 text-xs font-mono">US House PTR</span>
        </div>
        <nav className="flex gap-0.5" aria-label="Main navigation">
          <button
            onClick={() => onTabChange("insights")}
            aria-current={activeTab === "insights" ? "page" : undefined}
            className={`px-3 py-1 text-xs rounded cursor-pointer ${activeTab === "insights" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
          >
            Insights
          </button>
          <button
            onClick={() => onTabChange("trades")}
            aria-current={activeTab === "trades" ? "page" : undefined}
            className={`px-3 py-1 text-xs rounded cursor-pointer ${
              activeTab === "trades" ? "bg-zinc-800 text-white" : "text-zinc-500"
            }`}
          >
            Trades
          </button>
          {!IS_STATIC_MODE && (
            <button
              onClick={() => onTabChange("explorer")}
              aria-current={activeTab === "explorer" ? "page" : undefined}
              className={`px-3 py-1 text-xs rounded cursor-pointer ${
                activeTab === "explorer" ? "bg-zinc-800 text-white" : "text-zinc-500"
              }`}
            >
              API Explorer
            </button>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <StatusBadge />
        {!IS_STATIC_MODE && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1 text-xs border border-zinc-800 text-zinc-500 rounded cursor-pointer disabled:text-zinc-700 disabled:border-zinc-900 disabled:cursor-default"
          >
            {refreshing ? "Starting..." : "Fetch Data"}
          </button>
        )}
      </div>
    </header>
  );
}
