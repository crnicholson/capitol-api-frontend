import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/analytics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { analyticsParams, constrainTradeDates, currentTradeDate, dateIsValid, isFutureTrade, monthRange, stateMetricValue, summarizeFilingLag, summarizeTrades } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function trade(id, date, category, state = "CA", ticker = "AAPL", member = "Jane Smith") {
  return { id, transaction: { tradeDate: date, category }, person: { name: member, state, party: "Democrat", bioguideId: member }, asset: { ticker, name: ticker } };
}

test("charts include every matching record and are independent of table pagination", () => {
  assert.deepEqual(analyticsParams({ ticker: "AAPL", state: "CA", from: "2026-01-01", limit: "25", offset: "50", recent: "10", sort: "amount", order: "asc", person: "" }), { ticker: "AAPL", state: "CA", from: "2026-01-01" });
  const records = Array.from({ length: 150 }, (_, index) => trade(String(index), "2026-01-01", index % 2 ? "buy" : "sell"));
  const result = summarizeTrades(records, "2026-10-24");
  assert.equal(result.totals.total, 150);
  assert.equal(result.totals.buy, 75);
  assert.equal(result.totals.sell, 75);
  assert.equal(result.stocks[0].total, 150);
  assert.equal(result.memberCount, 1);
});

test("future trades are excluded from all aggregates while invalid dates stay out of the timeline", () => {
  const result = summarizeTrades([
    trade("1", "2026-01-15", "buy"),
    trade("2", "2026-03-01", "sell"),
    trade("3", "2026-12-26", "buy", "NY", "FUTU", "Future Member"),
    trade("4", "2026-02-30", "exchange"),
    trade("5", "", "gift"),
  ], "2026-10-24");
  assert.deepEqual(result.timeline.map(({ key, total }) => [key, total]), [["2026-01", 1], ["2026-02", 0], ["2026-03", 1]]);
  assert.equal(result.undated, 2);
  assert.equal(result.totals.total, 4);
  assert.equal(result.totals.buy, 1);
  assert.equal(result.states.some((group) => group.key === "NY"), false);
  assert.equal(result.stocks.some((group) => group.key === "FUTU"), false);
  assert.equal(result.members.some((group) => group.name === "Future Member"), false);
  assert.equal(result.parties.reduce((sum, [, count]) => sum + count, 0), 4);
  assert.equal(result.totals.other, 2);
});

test("future dates are capped using the Eastern calendar day, including around UTC midnight", () => {
  assert.equal(currentTradeDate(new Date("2026-10-25T03:59:59Z")), "2026-10-24");
  assert.equal(currentTradeDate(new Date("2026-10-25T04:00:00Z")), "2026-10-25");
  assert.equal(currentTradeDate(new Date("2026-01-01T04:59:59Z")), "2025-12-31");
  assert.equal(isFutureTrade(trade("future", "2026-12-26", "buy"), "2026-10-24"), true);
  assert.equal(isFutureTrade(trade("today", "2026-10-24", "buy"), "2026-10-24"), false);
  assert.equal(isFutureTrade(trade("past", "2026-10-23", "buy"), "2026-10-24"), false);
  assert.deepEqual(constrainTradeDates({ to: "2026-12-26" }, "2026-10-24"), { to: "2026-10-24" });
  assert.deepEqual(constrainTradeDates({ to: "2026-01-01" }, "2026-10-24"), { to: "2026-01-01" });
});

test("rankings preserve missing data counts and distinct members and tickers", () => {
  const result = summarizeTrades([
    trade("1", "2026-01-15", "buy", "CA", "AAPL"),
    trade("2", "2026-01-15", "sell", "CA", "MSFT"),
    trade("3", "2026-01-15", "exchange", "CA", "AAPL", "John Smith"),
    { id: "4", transaction: { tradeDate: "2026-01-15", category: "gift" } },
  ], "2026-10-24");
  assert.equal(result.states[0].total, 3);
  assert.equal(result.states[0].members.size, 2);
  assert.equal(result.states[0].tickers.size, 2);
  assert.equal(result.stocks[0].key, "AAPL");
  assert.equal(result.missingState, 1);
  assert.equal(result.missingTicker, 1);
  assert.equal(result.parties.reduce((sum, [, count]) => sum + count, 0), 4);
  assert.equal(result.states[0].buy + result.states[0].sell + result.states[0].other, 3);
});

test("month drilldown respects leap years and intersects existing date filters", () => {
  assert.deepEqual(monthRange("2024-02", {}), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(monthRange("2026-12", {}), { from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(monthRange("2026-03", { from: "2026-03-05", to: "2026-03-21" }), { from: "2026-03-05", to: "2026-03-21" });
  assert.equal(dateIsValid("2025-02-29", "2026-10-24"), false);
  assert.equal(dateIsValid("2024-02-29", "2026-10-24"), true);
});

test("empty datasets produce safe empty aggregates", () => {
  const result = summarizeTrades([], "2026-10-24");
  assert.equal(result.totals.total, 0);
  assert.deepEqual(result.timeline, []);
  assert.deepEqual(result.states, []);
  assert.deepEqual(result.stocks, []);
  assert.deepEqual(result.members, []);
});

test("state comparisons normalize by reporting members and exclude other transactions from buy/sell balance", () => {
  const result = summarizeTrades([
    trade("1", "2026-01-15", "buy", "CA", "AAPL", "Jane Smith"),
    trade("2", "2026-01-15", "buy", "CA", "MSFT", "Jane Smith"),
    trade("3", "2026-01-15", "sell", "CA", "AAPL", "John Smith"),
    trade("4", "2026-01-15", "exchange", "CA", "AAPL", "John Smith"),
  ], "2026-10-24");
  const ca = result.states[0];
  assert.equal(stateMetricValue(ca, "total"), 4);
  assert.equal(stateMetricValue(ca, "perMember"), 2);
  assert.equal(stateMetricValue(ca, "balance"), 1 / 3);
  assert.equal(stateMetricValue({ ...ca, buy: 0, sell: 0 }, "balance"), null);
  assert.equal(stateMetricValue(undefined, "total"), null);
  assert.equal(stateMetricValue({ ...ca, members: new Set() }, "perMember"), null);
});

test("filing lag uses calendar days and excludes missing, future, and reversed dates", () => {
  const withDates = (id, from, to) => ({ ...trade(id, from, "buy"), transaction: { tradeDate: from, filingDate: to } });
  const result = summarizeFilingLag([
    withDates("1", "2026-01-01", "2026-01-11"),
    withDates("2", "2026-01-01", "2026-01-21"),
    withDates("3", "2026-02-02", "2026-02-01"),
    withDates("4", "2026-02-30", "2026-03-10"),
    withDates("5", "2026-12-01", "2026-12-05"),
    withDates("6", "2026-01-01", ""),
  ], "2026-10-24");
  assert.deepEqual(result, { median: 15, included: 2, excluded: 4 });
  assert.equal(summarizeFilingLag([withDates("1", "2024-02-28", "2024-03-01")], "2026-10-24").median, 2);
  assert.deepEqual(summarizeFilingLag([], "2026-10-24"), { median: null, included: 0, excluded: 0 });
});
