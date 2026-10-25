"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchTrades } from "@/lib/api";
import { analyticsParams, currentTradeDate, monthRange, summarizeTrades, type Breakdown, type MonthGroup, type TradeGroup } from "@/lib/analytics";
import type { QueryParams, Trade } from "@/lib/types";
import styles from "./Insights.module.css";
import StateMap from "./StateMap";

type View = "activity" | "map" | "stocks" | "members";

interface Props {
  params: QueryParams;
  onExplore: (updates: Partial<QueryParams>) => void;
  onReset: () => void;
}

const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: "activity", label: "Activity", icon: "▥" },
  { key: "map", label: "Map", icon: "◎" },
  { key: "stocks", label: "Stocks", icon: "↗" },
  { key: "members", label: "Members", icon: "♙" },
];
const COLORS = { buy: "#34d399", sell: "#f87171", other: "#a1a1aa" };
const format = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function Legend() {
  return <div className={styles.legend}>{(["buy", "sell", "other"] as const).map((key) => <span key={key}><i style={{ background: COLORS[key] }} />{key === "buy" ? "Buys" : key === "sell" ? "Sells" : "Other"}</span>)}</div>;
}

function Segments({ group, max }: { group: Breakdown; max: number }) {
  return <span className={styles.segments} aria-hidden="true">{(["buy", "sell", "other"] as const).map((key) => <span key={key} style={{ width: `${max ? group[key] / max * 100 : 0}%`, background: COLORS[key] }} />)}</span>;
}

function Ranking({ groups, onSelect, limit = 10 }: { groups: TradeGroup[]; kind: "stocks" | "members"; onSelect: (group: TradeGroup) => void; limit?: number }) {
  const max = groups[0]?.total || 1;
  return <div className={styles.ranking}>{groups.slice(0, limit).map((group, i) => <button key={group.key} className={styles.rankRow} onClick={() => onSelect(group)} aria-label={`Explore ${group.name}, ${format(group.total)} transactions`}>
    <span className={styles.rankNumber}>{i + 1}</span>
    <span className={styles.rankIdentity}><strong>{group.name}</strong>{group.detail && <small>{group.detail}</small>}</span>
    <Segments group={group} max={max} />
    <span className={styles.rankValue}>{format(group.total)}<span aria-hidden="true"> ↗</span></span>
  </button>)}</div>;
}

function monthLabel(key: string, long = false) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" });
}

function Timeline({ months, onSelect }: { months: MonthGroup[]; onSelect: (key: string) => void }) {
  const [span, setSpan] = useState("24");
  const [hovered, setHovered] = useState<string | null>(null);
  const visible = span === "all" ? months : months.slice(-Number(span));
  const max = Math.max(1, ...visible.map((month) => month.total));
  const tickStep = Math.max(1, 10 ** Math.floor(Math.log10(max / 4)));
  const ceiling = Math.ceil(max / 4 / tickStep) * tickStep * 4;
  const active = visible.find((month) => month.key === hovered);
  const peak = visible.reduce<MonthGroup | null>((best, month) => !best || month.total > best.total ? month : best, null);
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><h2>When are members trading?</h2><p>Reported transactions by trade month</p></div><select aria-label="Activity time window" value={span} onChange={(event) => setSpan(event.target.value)}><option value="12">12-month view</option><option value="24">24-month view</option><option value="all">All months</option></select></div>
    <div className={styles.chartReadout} aria-live="polite">{active ? <><strong>{monthLabel(active.key, true)}</strong><span>{format(active.total)} transactions</span><span className={styles.buyText}>{format(active.buy)} buys</span><span className={styles.sellText}>{format(active.sell)} sells</span></> : peak ? <><strong>{monthLabel(peak.key, true)}</strong><span>was the busiest month in this view, with {format(peak.total)} transactions.</span></> : <span>No valid trade dates in these results.</span>}</div>
    {visible.length > 0 && <div className={styles.timelineScroll}><div className={styles.timeline} style={{ minWidth: Math.max(500, visible.length * 24) }}>
      <div className={styles.axis}>{[1, .75, .5, .25, 0].map((part) => <span key={part}>{compact(Math.round(ceiling * part))}</span>)}</div>
      <div className={styles.plot}><div className={styles.gridLines} aria-hidden="true">{[0, 1, 2, 3, 4].map((line) => <i key={line} />)}</div>
        <div className={styles.columns}>{visible.map((month, i) => <button key={month.key} className={styles.month} onClick={() => onSelect(month.key)} onMouseEnter={() => setHovered(month.key)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(month.key)} onBlur={() => setHovered(null)} aria-label={`${monthLabel(month.key, true)}: ${format(month.total)} transactions, ${format(month.buy)} buys, ${format(month.sell)} sells, ${format(month.other)} other. View trades.`}>
          <span className={styles.column}>{(["other", "sell", "buy"] as const).map((key) => <span key={key} style={{ height: `${month[key] / ceiling * 100}%`, background: COLORS[key] }} />)}</span>
          <span className={styles.monthLabel}>{visible.length <= 24 || i % Math.ceil(visible.length / 12) === 0 ? monthLabel(month.key) : ""}</span>
        </button>)}</div>
      </div>
    </div></div>}
    <div className={styles.panelFooter}><Legend /><span>Select a month to see its trades</span></div>
  </section>;
}

export default function Insights({ params, onExplore, onReset }: Props) {
  const [view, setView] = useState<View>("activity");
  const [result, setResult] = useState<{ key: string; trades: Trade[]; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const queryKey = JSON.stringify(analyticsParams(params));

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    async function load() {
      try {
        const query: QueryParams = JSON.parse(queryKey);
        const first = await fetchTrades(query, controller.signal);
        if (!active) return;
        const trades = [...first.trades];
        while (trades.length < first.total) {
          const page = await fetchTrades({ ...query, offset: String(trades.length), limit: "1000" }, controller.signal);
          if (!active) return;
          if (!page.trades.length) throw new Error("The data source returned incomplete results. Please try again.");
          trades.push(...page.trades);
        }
        if (active) setResult({ key: queryKey, trades });
      } catch (error) {
        if (active) setResult({ key: queryKey, trades: [], error: controller.signal.aborted ? "The data source took too long to respond. Please try again." : error instanceof Error ? error.message : "Could not load disclosure data." });
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [queryKey, attempt]);

  const current = result?.key === queryKey ? result : null;
  const today = currentTradeDate();
  const data = useMemo(() => current && !current.error ? summarizeTrades(current.trades, today) : null, [current, today]);
  const loading = !current;
  const filtered = Object.keys(JSON.parse(queryKey)).length > 0;

  return <main className={styles.insights}>
    <div className={styles.intro}><div><h1>Follow the disclosures.</h1><p>Explore what House members and their households report trading.</p></div><button className={styles.textButton} onClick={() => onExplore({})}>Browse underlying trades <span aria-hidden="true">↗</span></button></div>
    <nav className={styles.views} aria-label="Data views">{VIEWS.map((item) => <button key={item.key} aria-current={view === item.key ? "page" : undefined} className={view === item.key ? styles.activeView : ""} onClick={() => setView(item.key)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
    {loading ? <div className={styles.message} role="status"><span className={styles.loader} /><h2>Loading disclosure data</h2><p>Gathering all matching transactions for the charts.</p></div> : current?.error ? <div className={styles.message} role="alert"><h2>Couldn&apos;t load the charts</h2><p>{current.error}</p><button className={styles.primaryButton} onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Try again</button></div> : data && !data.totals.total ? <div className={styles.message}><h2>No transactions match these filters</h2><p>Try a different member, ticker, state, or date range.</p><button className={styles.primaryButton} onClick={onReset}>Clear filters</button></div> : data ? <>
      <div className={styles.summary} aria-label="Summary of all matching transactions">{[{ label: "Reported transactions", value: format(data.totals.total) }, { label: "Buys", value: format(data.totals.buy), color: COLORS.buy }, { label: "Sells", value: format(data.totals.sell), color: COLORS.sell }, { label: "Reporting members", value: format(data.memberCount) }, { label: "Distinct tickers", value: format(data.tickerCount) }].map((item) => <div key={item.label}><span>{item.label}</span><strong style={{ color: item.color }}>{item.value}</strong></div>)}<span className={styles.scope}>{filtered ? "Filtered results" : "All available records"}<small>All pages included</small></span></div>
      {view === "activity" && <>
        <Timeline months={data.timeline} onSelect={(key) => onExplore(monthRange(key, params))} />
        <div className={styles.twoColumns}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Buying or selling?</h2><p>Transaction mix across the current results</p></div></div><div className={styles.mix}><div className={styles.donut} role="img" aria-label={`${data.totals.buy} buys, ${data.totals.sell} sells, ${data.totals.other} other transactions`} style={{ "--buy-end": `${data.totals.buy / data.totals.total * 100}%`, "--sell-end": `${(data.totals.buy + data.totals.sell) / data.totals.total * 100}%` } as CSSProperties}><div><strong>{Math.round(data.totals.buy / data.totals.total * 100)}%</strong><span>purchases</span></div></div><div className={styles.mixRows}>{(["buy", "sell", "other"] as const).map((key) => <button key={key} disabled={key === "other"} onClick={() => onExplore({ category: key })}><i style={{ background: COLORS[key] }} /><span>{key === "buy" ? "Buys" : key === "sell" ? "Sells" : "Other transactions"}</span><strong>{format(data.totals[key])}</strong><small>{(data.totals[key] / data.totals.total * 100).toFixed(1)}%</small></button>)}</div></div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Most traded tickers</h2><p>Tickers with the most reported transactions</p></div><button className={styles.textButton} onClick={() => setView("stocks")}>Explore tickers <span aria-hidden="true">↗</span></button></div><Ranking groups={data.stocks} kind="stocks" limit={5} onSelect={(group) => onExplore({ ticker: group.key })} /></section></div>
      </>}
      {view === "map" && <StateMap groups={data.states} trades={current?.trades || []} today={today} onExplore={onExplore} />}
      {view === "stocks" && <><section className={styles.panel}><div className={styles.panelHeader}><div><h2>What are members trading?</h2><p>The 15 most active tickers, ranked by transaction count</p></div><Legend /></div><Ranking groups={data.stocks} kind="stocks" limit={15} onSelect={(group) => onExplore({ ticker: group.key })} /><div className={styles.panelFooter}><span>Select a ticker to inspect its transactions and source filings.</span><span>{format(data.missingTicker)} records without tickers excluded</span></div></section><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Activity by party</h2><p>Raw transaction counts in the current results</p></div></div><div className={styles.partyRows}>{data.parties.map(([party, count]) => <button key={party} className={styles.partyRow} disabled={party === "Unknown"} onClick={() => onExplore({ party })}><span><i style={{ background: party.toLowerCase().startsWith("d") ? "#60a5fa" : party.toLowerCase().startsWith("r") ? "#f87171" : "#a1a1aa" }} />{party}</span><span className={styles.partyTrack}><i style={{ width: `${count / data.totals.total * 100}%` }} /></span><strong>{format(count)}</strong><small>{(count / data.totals.total * 100).toFixed(1)}%</small></button>)}</div><div className={styles.panelFooter}><span>Counts are not adjusted for party size or number of reporting members.</span></div></section></>}
      {view === "members" && <><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Who is reporting the most trades?</h2><p>The 20 most active reporting members and their households</p></div><Legend /></div><Ranking groups={data.members} kind="members" limit={20} onSelect={(group) => onExplore({ person: group.name })} /><div className={styles.panelFooter}><span>Select a member to explore the original disclosures.</span><span>Ranked by transaction count</span></div></section></>}
      <footer className={styles.notes}><span>U.S. House periodic transaction reports. Charts count reported transactions, including spouse and dependent holdings.</span>{data.undated > 0 && <span>{format(data.undated)} {data.undated === 1 ? "record with a missing or invalid trade date is" : "records with missing or invalid trade dates are"} excluded from the timeline only.</span>}<span>Future-dated trades are excluded. Disclosures report amount ranges and do not establish investment returns.</span></footer>
    </> : null}
  </main>;
}
