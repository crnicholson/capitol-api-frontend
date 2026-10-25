import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function compile(name, dependencies = {}) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [specifier, url] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

test("static queries, API requests, downloads, pagination and status consistently exclude future trades", async (context) => {
  const analyticsUrl = compile("analytics");
  const { currentTradeDate } = await import(analyticsUrl);
  const today = currentTradeDate();
  const record = (id, date) => ({ id, transaction: { tradeDate: date, filingDate: today }, person: { name: "Test Member" }, asset: {} });
  const records = [record("future", "9999-12-26"), record("today", today), record("past", "2000-01-01")];
  const requests = [];
  context.mock.method(globalThis, "fetch", async (url) => {
    requests.push(String(url));
    if (url === "/trades.json") return Response.json({ metadata: { years: [2026] }, trades: records });
    if (new URL(url).pathname === "/api/status") return Response.json({ totalTrades: 3, cacheStatus: "complete" });
    return Response.json({ total: 2, offset: 0, limit: 1, returned: 1, trades: [records[1]] });
  });
  const staticUrl = compile("staticTrades", { "./analytics": analyticsUrl });
  const snapshot = await import(staticUrl);
  const first = await snapshot.queryStaticTrades({ limit: "1" });
  assert.equal(first.total, 2);
  assert.equal(first.returned, 1);
  assert.equal(first.trades[0].id, "today");
  assert.equal((await snapshot.queryStaticTrades({ limit: "1", offset: "1" })).trades[0].id, "past");
  assert.equal((await snapshot.queryStaticTrades({ from: "9999-01-01", to: "9999-12-31" })).total, 0);
  assert.equal((await snapshot.queryStaticTrades({ recent: "100" })).returned, 2);
  assert.equal((await snapshot.getStaticStatus()).totalTrades, 2);

  const configUrl = `data:text/javascript;base64,${Buffer.from("export const IS_STATIC_MODE = false;").toString("base64")}`;
  const api = await import(compile("api", { "./analytics": analyticsUrl, "./staticTrades": staticUrl, "./config": configUrl }));
  assert.equal(new URL(api.buildQueryUrl({ to: "9999-12-26" })).searchParams.get("to"), today);
  assert.equal(new URL(api.buildDownloadUrl({})).searchParams.get("to"), today);
  assert.equal(new URL(api.buildDownloadUrl({ to: "2000-01-01" })).searchParams.get("to"), "2000-01-01");
  await api.fetchTrades({ limit: "50", offset: "50", to: "9999-12-26" });
  assert.equal((await api.fetchStatus()).totalTrades, 2);
  for (const url of requests.filter((url) => url.includes("/api/trades"))) assert.equal(new URL(url).searchParams.get("to"), today);
  assert.equal(records.length, 3);
  assert.equal(records[0].id, "future");
});
