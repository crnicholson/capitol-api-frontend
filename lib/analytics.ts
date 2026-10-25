import type { QueryParams, Trade } from "./types";

export function currentTradeDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isFutureTrade(trade: Trade, today = currentTradeDate()): boolean {
  const date = trade.transaction?.tradeDate;
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today;
}

export function constrainTradeDates(params: QueryParams, today = currentTradeDate()): QueryParams {
  return { ...params, to: params.to && params.to < today ? params.to : today };
}

export interface Breakdown {
  total: number;
  buy: number;
  sell: number;
  other: number;
}

export interface TradeGroup extends Breakdown {
  key: string;
  name: string;
  detail: string;
  tickers: Set<string>;
  members: Set<string>;
}

export interface MonthGroup extends Breakdown {
  key: string;
}

export type StateMetric = "total" | "perMember" | "balance";

export function stateMetricValue(group: TradeGroup | undefined, metric: StateMetric): number | null {
  if (!group?.total) return null;
  if (metric === "perMember") return group.members.size ? group.total / group.members.size : null;
  if (metric === "balance") return group.buy + group.sell ? (group.buy - group.sell) / (group.buy + group.sell) : null;
  return group.total;
}

export function summarizeFilingLag(trades: Trade[], today: string) {
  const days: number[] = [];
  for (const trade of trades) {
    const from = trade.transaction?.tradeDate;
    const to = trade.transaction?.filingDate;
    if (!dateIsValid(from, today) || !dateIsValid(to, today) || to < from) continue;
    days.push((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
  }
  days.sort((a, b) => a - b);
  const middle = Math.floor(days.length / 2);
  return { median: days.length ? days.length % 2 ? days[middle] : (days[middle - 1] + days[middle]) / 2 : null, included: days.length, excluded: trades.length - days.length };
}

function emptyBreakdown(): Breakdown {
  return { total: 0, buy: 0, sell: 0, other: 0 };
}

function addTrade(group: Breakdown, trade: Trade) {
  group.total += 1;
  const category = trade.transaction?.category;
  if (category === "buy") group.buy += 1;
  else if (category === "sell") group.sell += 1;
  else group.other += 1;
}

export function analyticsParams(params: QueryParams): QueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) =>
      !["sort", "order", "limit", "offset", "recent"].includes(key) && value !== "" && value !== undefined,
    ),
  );
}

export function dateIsValid(value: string | undefined, today: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function summarizeTrades(trades: Trade[], today: string) {
  const totals = emptyBreakdown();
  const states = new Map<string, TradeGroup>();
  const stocks = new Map<string, TradeGroup>();
  const members = new Map<string, TradeGroup>();
  const parties = new Map<string, number>();
  const months = new Map<string, MonthGroup>();
  const memberIds = new Set<string>();
  const tickers = new Set<string>();
  let undated = 0;
  let missingState = 0;
  let missingTicker = 0;
  let firstMonth = "";
  let lastMonth = "";

  function accumulate(groups: Map<string, TradeGroup>, key: string, name: string, detail: string, trade: Trade) {
    if (!groups.has(key)) groups.set(key, { key, name, detail, ...emptyBreakdown(), tickers: new Set(), members: new Set() });
    const group = groups.get(key)!;
    addTrade(group, trade);
    if (trade.asset?.ticker) group.tickers.add(trade.asset.ticker);
    if (trade.person?.name) group.members.add(trade.person.bioguideId || trade.person.name);
  }

  for (const trade of trades) {
    if (isFutureTrade(trade, today)) continue;
    addTrade(totals, trade);
    const person = trade.person;
    if (person?.name) {
      const id = person.bioguideId || person.name;
      memberIds.add(id);
      accumulate(members, id, person.name, [person.state, person.party].filter(Boolean).join(" · "), trade);
    }
    if (person?.state) accumulate(states, person.state, person.state, "", trade);
    else missingState += 1;
    const ticker = trade.asset?.ticker;
    if (ticker) {
      tickers.add(ticker);
      accumulate(stocks, ticker, ticker, trade.asset.name, trade);
    } else missingTicker += 1;
    const party = person?.party || "Unknown";
    parties.set(party, (parties.get(party) || 0) + 1);
    const date = trade.transaction?.tradeDate;
    if (!dateIsValid(date, today)) {
      undated += 1;
      continue;
    }
    const month = date.slice(0, 7);
    if (!firstMonth || month < firstMonth) firstMonth = month;
    if (!lastMonth || month > lastMonth) lastMonth = month;
    if (!months.has(month)) months.set(month, { key: month, ...emptyBreakdown() });
    addTrade(months.get(month)!, trade);
  }

  const timeline: MonthGroup[] = [];
  if (firstMonth && lastMonth) {
    const cursor = new Date(`${firstMonth}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= lastMonth) {
      const key = cursor.toISOString().slice(0, 7);
      timeline.push(months.get(key) || { key, ...emptyBreakdown() });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const ranked = (groups: Map<string, TradeGroup>) => [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { totals, states: ranked(states), stocks: ranked(stocks), members: ranked(members), parties: [...parties].sort((a, b) => b[1] - a[1]), timeline, undated, missingState, missingTicker, memberCount: memberIds.size, tickerCount: tickers.size };
}

export function monthRange(key: string, params: QueryParams): QueryParams {
  const date = new Date(`${key}-01T00:00:00Z`);
  const from = `${key}-01`;
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  const to = date.toISOString().slice(0, 10);
  return { from: params.from && params.from > from ? params.from : from, to: params.to && params.to < to ? params.to : to };
}
