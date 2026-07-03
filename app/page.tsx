"use client";

import { useState } from "react";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import TradesTable from "@/components/TradesTable";
import QueryBuilder from "@/components/QueryBuilder";
import StaticModeBanner from "@/components/StaticModeBanner";
import { IS_STATIC_MODE } from "@/lib/config";
import type { QueryParams } from "@/lib/types";

const DEFAULT_PARAMS: QueryParams = {
  sort: "date",
  order: "desc",
  limit: "50",
  offset: "0",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"trades" | "explorer">("trades");
  const [params, setParams] = useState<QueryParams>(DEFAULT_PARAMS);

  function handleParamsChange(updates: Partial<QueryParams>) {
    setParams((prev) => ({ ...prev, ...updates }));
  }

  const tab = IS_STATIC_MODE ? "trades" : activeTab;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-zinc-200">
      <Header activeTab={tab} onTabChange={setActiveTab} />
      {IS_STATIC_MODE && <StaticModeBanner />}

      {tab === "trades" && (
        <>
          <FilterBar params={params} onChange={setParams} />
          <TradesTable params={params} onParamsChange={handleParamsChange} />
        </>
      )}

      {tab === "explorer" && <QueryBuilder />}
    </div>
  );
}
