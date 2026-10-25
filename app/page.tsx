"use client";

import { useState } from "react";
import Header, { type AppTab } from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import TradesTable from "@/components/TradesTable";
import QueryBuilder from "@/components/QueryBuilder";
import StaticModeBanner from "@/components/StaticModeBanner";
import Insights from "@/components/Insights";
import { IS_STATIC_MODE } from "@/lib/config";
import type { QueryParams } from "@/lib/types";

const DEFAULT_PARAMS: QueryParams = {
  sort: "date",
  order: "desc",
  limit: "50",
  offset: "0",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("insights");
  const [params, setParams] = useState<QueryParams>(DEFAULT_PARAMS);

  function handleParamsChange(updates: Partial<QueryParams>) {
    setParams((prev) => ({ ...prev, ...updates }));
  }

  function exploreTrades(updates: Partial<QueryParams>) {
    setParams((prev) => ({ ...prev, ...updates, offset: "0" }));
    setActiveTab("trades");
  }

  const tab = IS_STATIC_MODE && activeTab === "explorer" ? "insights" : activeTab;

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-[#0a0a0a] text-zinc-200">
      <Header activeTab={tab} onTabChange={setActiveTab} />
      {IS_STATIC_MODE && <StaticModeBanner />}

      {tab !== "explorer" && <div className="shrink-0 max-h-[35dvh] overflow-y-auto"><FilterBar params={params} onChange={setParams} showPageSize={tab === "trades"} /></div>}

      {tab === "insights" && <div className="flex-1 min-h-0 overflow-y-auto"><Insights params={params} onExplore={exploreTrades} onReset={() => setParams(DEFAULT_PARAMS)} /></div>}

      {tab === "trades" && <TradesTable params={params} onParamsChange={handleParamsChange} />}

      {tab === "explorer" && <QueryBuilder />}
    </div>
  );
}
