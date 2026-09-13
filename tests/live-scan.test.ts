import test from "node:test";
import assert from "node:assert/strict";
import { confirmedCandles, runLiveScan } from "../src/lib/live-scan.ts";
import type { Candle } from "../src/lib/types.ts";

const candle = (time: string, price = 100): Candle => ({ time, open: price, high: price + 1, low: price - 1, close: price + 0.5 });

test("removes the currently forming candle", () => {
  const now = new Date("2026-09-13T12:17:00Z");
  assert.deepEqual(confirmedCandles([
    candle("2026-09-13T12:05:00Z"),
    candle("2026-09-13T12:15:00Z"),
  ], "5m", now).map((item) => item.time), ["2026-09-13T12:05:00Z"]);
});

test("runs a live ranked-asset slice without hardcoding its id", async () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const requested: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url.toString());
    if (url.pathname.endsWith("/assets")) return new Response(JSON.stringify({ data: [{
      id: 349,
      name: "GSMI",
      code: "OTC_GSMI",
      enabled: true,
      profitability: { binary: { current: 0.89, enabled: true } },
    }] }));
    const minutes = url.searchParams.get("detalization") === "5m" ? 5 : url.searchParams.get("detalization") === "30m" ? 30 : 60;
    const data = Array.from({ length: 80 }, (_, index) => {
      const time = new Date(now.getTime() - (80 - index) * minutes * 60_000).toISOString();
      return candle(time, 100 + index);
    });
    return new Response(JSON.stringify({ data }));
  };
  const result = await runLiveScan("BULL", { now, fetcher });
  assert.equal(result.source, "bubinga");
  assert.equal(result.targetCount, 1);
  assert.ok(requested.some((url) => url.includes("assets/349/candles")));
  assert.deepEqual(requested.filter((url) => url.includes("candles")).map((url) => new URL(url).searchParams.get("detalization")).sort(), ["1h", "30m", "5m"]);
});
