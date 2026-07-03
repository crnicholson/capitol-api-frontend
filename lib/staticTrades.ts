import type { Trade, TradesResponse, StatusResponse, QueryParams } from "./types";

interface TradesFile {
  metadata: {
    years: number[];
    status: string;
    lastUpdated: string;
  };
  trades: Trade[];
}

let dataPromise: Promise<TradesFile> | null = null;

function loadTradesFile(): Promise<TradesFile> {
  if (!dataPromise) {
    dataPromise = fetch("/trades.json").then((res) => {
      if (!res.ok) throw new Error(`Failed to load cached trades: HTTP ${res.status}`);
      return res.json();
    });
  }
  return dataPromise;
}

function matchesParams(trade: Trade, params: QueryParams): boolean {
  if (params.person && !trade.person?.name?.toLowerCase().includes(params.person.toLowerCase())) return false;
  if (params.ticker && (trade.asset?.ticker ?? "").toLowerCase() !== params.ticker.toLowerCase()) return false;
  if (params.state && (trade.person?.state ?? "").toLowerCase() !== params.state.toLowerCase()) return false;
  if (params.party && (trade.person?.party ?? "").toLowerCase() !== params.party.toLowerCase()) return false;
  if (params.type && (trade.transaction?.type ?? "").toLowerCase() !== params.type.toLowerCase()) return false;
  if (params.category && (trade.transaction?.category ?? "").toLowerCase() !== params.category.toLowerCase()) return false;
  if (params.from && trade.transaction?.tradeDate < params.from) return false;
  if (params.to && trade.transaction?.tradeDate > params.to) return false;
  return true;
}

type SortValue = string | number;

const SORT_FIELDS: Record<string, { get: (t: Trade) => SortValue; defaultOrder: "asc" | "desc" }> = {
  date: { get: (t) => t.transaction.tradeDate, defaultOrder: "desc" },
  newest: { get: (t) => t.transaction.tradeDate, defaultOrder: "desc" },
  oldest: { get: (t) => t.transaction.tradeDate, defaultOrder: "asc" },
  filingdate: { get: (t) => t.transaction.filingDate, defaultOrder: "desc" },
  name: { get: (t) => t.person?.name ?? "", defaultOrder: "asc" },
  ticker: { get: (t) => t.asset?.ticker ?? "", defaultOrder: "asc" },
  amount: { get: (t) => t.transaction.amountMax ?? t.transaction.amountMin ?? 0, defaultOrder: "desc" },
  largest: { get: (t) => t.transaction.amountMax ?? t.transaction.amountMin ?? 0, defaultOrder: "desc" },
};

function sortTrades(trades: Trade[], sortKey: string, order?: string): Trade[] {
  const field = SORT_FIELDS[sortKey] ?? SORT_FIELDS.date;
  const dir = order === "asc" ? 1 : order === "desc" ? -1 : field.defaultOrder === "asc" ? 1 : -1;
  return [...trades].sort((a, b) => {
    const av = field.get(a);
    const bv = field.get(b);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return cmp * dir;
  });
}

export async function queryStaticTrades(params: QueryParams): Promise<TradesResponse> {
  const { trades } = await loadTradesFile();
  const filtered = trades.filter((t) => matchesParams(t, params));

  if (params.recent) {
    const n = parseInt(params.recent, 10) || 25;
    const recent = sortTrades(filtered, "date", "desc").slice(0, n);
    return { total: filtered.length, offset: 0, limit: n, returned: recent.length, trades: recent };
  }

  const sorted = sortTrades(filtered, params.sort ?? "date", params.order);

  const total = sorted.length;
  const offset = parseInt(params.offset ?? "0", 10) || 0;
  const limit = params.limit ? parseInt(params.limit, 10) : null;
  const page = limit != null ? sorted.slice(offset, offset + limit) : sorted.slice(offset);

  return { total, offset, limit, returned: page.length, trades: page };
}

export async function getStaticStatus(): Promise<StatusResponse> {
  const { metadata, trades } = await loadTradesFile();
  const years = metadata.years ?? [];

  return {
    fetchRunning: false,
    fetchProgress: "",
    fetchError: null,
    fetchStartedAt: null,
    cacheStatus: "complete",
    cacheLastUpdated: metadata.lastUpdated ?? null,
    cacheYears: years,
    totalTrades: trades.length,
    config: {
      yearsStart: years.length ? Math.min(...years) : 0,
      yearsEnd: years.length ? Math.max(...years) : 0,
      cacheRefreshHours: 0,
    },
  };
}
