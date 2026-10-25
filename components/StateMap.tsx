"use client";

import { useMemo, useState } from "react";
import { stateMetricValue, summarizeFilingLag, summarizeTrades, type StateMetric, type TradeGroup } from "@/lib/analytics";
import type { QueryParams, Trade } from "@/lib/types";
import states from "@/lib/us-states.json";
import styles from "./Insights.module.css";

interface Props {
  groups: TradeGroup[];
  trades: Trade[];
  today: string;
  onExplore: (updates: Partial<QueryParams>) => void;
}

const names = new Map(states.map((state) => [state.code, state.name]));
const number = (value: number, digits = 0) => value.toLocaleString("en-US", { maximumFractionDigits: digits });
const METRICS: { key: StateMetric; label: string }[] = [
  { key: "total", label: "Transactions" },
  { key: "perMember", label: "Per reporting member" },
  { key: "balance", label: "Buy / sell balance" },
];

function metricLabel(group: TradeGroup | undefined, metric: StateMetric) {
  const value = stateMetricValue(group, metric);
  if (value === null) return metric === "balance" && group?.total ? "No purchases or sales" : "No matching records";
  if (metric === "perMember") return `${number(value, 1)} transactions per reporting member`;
  if (metric === "balance") return value === 0 ? "Equal buys and sells" : `${number(Math.abs(value) * 100, 1)}% net ${value > 0 ? "buying" : "selling"} by count`;
  return `${number(value)} reported transactions`;
}

function StateRanking({ title, description, groups, kind, code, onExplore }: { title: string; description: string; groups: TradeGroup[]; kind: "person" | "ticker"; code: string; onExplore: Props["onExplore"] }) {
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><h2>{title}</h2><p>{description}</p></div></div>
    <div className={styles.ranking}>
      {groups.length ? groups.slice(0, 5).map((group, index) => <button key={group.key} className={styles.rankRow} aria-label={`Explore ${group.name} in ${code}, ${number(group.total)} transactions`} onClick={() => onExplore({ state: code, [kind]: kind === "person" ? group.name : group.key })}>
        <span className={styles.rankNumber}>{index + 1}</span>
        <span className={styles.rankIdentity}><strong>{group.name}</strong><small>{group.detail}</small></span>
        <span className={styles.segments} aria-hidden="true"><span style={{ width: `${group.buy / groups[0].total * 100}%`, background: "#34d399" }} /><span style={{ width: `${group.sell / groups[0].total * 100}%`, background: "#f87171" }} /><span style={{ width: `${group.other / groups[0].total * 100}%`, background: "#a1a1aa" }} /></span>
        <span className={styles.rankValue}>{number(group.total)} <span aria-hidden="true">↗</span></span>
      </button>) : <p className={styles.stateEmpty}>No matching {kind === "person" ? "members" : "tickers"} in this state.</p>}
    </div>
  </section>;
}

export default function StateMap({ groups, trades, today, onExplore }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [metric, setMetric] = useState<StateMetric>("total");
  const selection = useMemo(() => {
    const code = selected || groups.find((group) => names.has(group.key))?.key || "CA";
    const records = trades.filter((trade) => trade.person?.state === code);
    return { code, detail: summarizeTrades(records, today), lag: summarizeFilingLag(records, today) };
  }, [groups, trades, selected, today]);
  const byCode = new Map(groups.map((group) => [group.key, group]));
  const mapped = groups.filter((group) => names.has(group.key));
  const activeCode = selection.code;
  const active = byCode.get(activeCode);
  const activeName = names.get(activeCode) || activeCode;
  const hoveredGroup = hovered ? byCode.get(hovered) : undefined;
  const max = Math.max(1, ...mapped.map((group) => stateMetricValue(group, metric) || 0));
  const mappedTotal = mapped.reduce((sum, group) => sum + group.total, 0);
  const reportingMembers = mapped.reduce((sum, group) => sum + group.members.size, 0);
  const overallPerMember = reportingMembers ? mappedTotal / reportingMembers : 0;
  const activePerMember = stateMetricValue(active, "perMember");
  const { detail, lag } = selection;
  const buySell = (active?.buy || 0) + (active?.sell || 0);
  const unmapped = trades.length - mappedTotal;

  function stateColor(group: TradeGroup | undefined) {
    const value = stateMetricValue(group, metric);
    if (value === null) return "#181818";
    if (metric === "balance") return `color-mix(in srgb, #e5e5e5 ${(value + 1) / 2 * 100}%, #404040)`;
    return `color-mix(in srgb, #d4d4d4 ${Math.sqrt(value / max) * 100}%, #404040)`;
  }

  return <>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>How does trading differ by state?</h2><p>Compare activity, reporting members, and the balance of buys and sells.</p></div></div>
      <div className={styles.mapControls} role="group" aria-label="Map comparison">{METRICS.map((option) => <button key={option.key} aria-pressed={metric === option.key} className={metric === option.key ? styles.selectedMetric : ""} onClick={() => setMetric(option.key)}>{option.label}</button>)}</div>
      <p className={styles.mapExplanation}>{metric === "total" ? "Lighter states have more reported transactions. Select a state to see who and what is behind it." : metric === "perMember" ? "Lighter states have more transactions per reporting member. Averages use only members with matching disclosures." : "Lighter states report more buys; darker states report more sells. Shade measures (buys − sells) ÷ (buys + sells), using transaction counts."}</p>
      <div className={styles.mapLayout}>
        <div className={styles.mapCanvas}>
          <svg viewBox="-65 0 1040 640" role="group" aria-label={`U.S. map: ${METRICS.find((option) => option.key === metric)?.label}`}>
            {states.map((state) => {
              const group = byCode.get(state.code);
              const label = `${state.name}: ${metricLabel(group, metric)}`;
              return <path key={state.code} d={state.path} role="button" tabIndex={0} aria-label={label} aria-pressed={activeCode === state.code} className={`${styles.state} ${activeCode === state.code ? styles.selectedState : ""}`} style={{ fill: stateColor(group) }} onPointerEnter={() => setHovered(state.code)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(state.code)} onBlur={() => setHovered(null)} onClick={() => setSelected(state.code)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(state.code); } }}><title>{label}</title></path>;
            })}
          </svg>
          {hovered && <div className={styles.mapTooltip} role="status"><strong>{names.get(hovered)}</strong><span>{metricLabel(hoveredGroup, metric)}</span>{hoveredGroup && <small>{number(hoveredGroup.total)} transactions from {hoveredGroup.members.size} reporting members</small>}</div>}
          <div className={styles.mapLegend}>{metric === "balance" ? <><span>100% sells</span><i className={styles.balanceLegend} /><span>100% buys</span></> : <><span>0</span><i /><span>{number(max, metric === "perMember" ? 1 : 0)} {metric === "perMember" ? "per reporting member" : "transactions"}</span></>}</div>
          <p className={styles.mapNoData}><i /> Dark states have no matching records{metric === "balance" ? " or no purchases or sales" : ""}.</p>
        </div>
        <aside className={styles.stateDetail}>
          <label htmlFor="map-state">Explore a state</label><select id="map-state" value={activeCode} onChange={(event) => setSelected(event.target.value)}>{[...states].sort((a, b) => a.name.localeCompare(b.name)).map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}</select>
          <div className={styles.stateHeading}><span>{activeCode}</span><h3>{activeName}</h3></div>
          <strong className={styles.stateTotal}>{metric === "balance" ? buySell ? `${number((active?.buy || 0) / buySell * 100, 1)}%` : "N/A" : metric === "perMember" ? activePerMember === null ? "N/A" : number(activePerMember, 1) : number(active?.total || 0)}</strong>
          <p>{metric === "balance" ? "purchases among buys and sells" : metric === "perMember" ? "transactions per reporting member" : "reported transactions"}</p>
          <dl>
            <div><dt>Reporting members</dt><dd>{active?.members.size || 0}</dd></div>
            <div><dt>Distinct tickers</dt><dd>{active?.tickers.size || 0}</dd></div>
            <div><dt>Buys / sells</dt><dd><span className={styles.buyText}>{number(active?.buy || 0)}</span> / <span className={styles.sellText}>{number(active?.sell || 0)}</span></dd></div>
            <div><dt>Transactions per member</dt><dd>{activePerMember === null ? "N/A" : number(activePerMember, 1)}</dd></div>
            <div><dt>Median days to filing</dt><dd>{lag.median === null ? "N/A" : number(lag.median, 1)}</dd></div>
          </dl>
          {activePerMember !== null && overallPerMember > 0 && <p className={styles.stateComparison}>{number(activePerMember / overallPerMember, 1)}× the average transactions per reporting member across the mapped results.</p>}
          <button className={styles.primaryButton} disabled={!active?.total} onClick={() => onExplore({ state: activeCode })}>View {activeCode} trades <span aria-hidden="true">↗</span></button>
        </aside>
      </div>
      <div className={styles.panelFooter}><span>Per-member averages use only members in the filtered records. Balance measures counts, not dollars.</span><a href="https://github.com/topojson/us-atlas" target="_blank" rel="noreferrer">Map: U.S. Census / us-atlas</a></div>
    </section>
    <div className={styles.twoColumns}>
      <StateRanking title={`${activeName}: reporting members`} description="Who accounts for the state's reported activity" groups={detail.members} kind="person" code={activeCode} onExplore={onExplore} />
      <StateRanking title={`${activeName}: most traded tickers`} description="What is being bought and sold in these disclosures" groups={detail.stocks} kind="ticker" code={activeCode} onExplore={onExplore} />
    </div>
    <p className={styles.note}>Filing lag is elapsed calendar days from trade to filing, using {number(lag.included)} valid dated transactions in {activeName}.{lag.excluded > 0 ? ` ${number(lag.excluded)} records with missing or inconsistent dates excluded.` : ""}{unmapped > 0 ? ` ${number(unmapped)} transactions without a mapped state are omitted from the map.` : ""}</p>
  </>;
}
