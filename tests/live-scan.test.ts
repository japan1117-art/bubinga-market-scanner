import test from "node:test";
import assert from "node:assert/strict";
import { bullHourTiming, confirmedCandles, runLiveScan, visibleCandles } from "../src/lib/live-scan.ts";
import type { Candle } from "../src/lib/types.ts";

const candle = (time: string, price = 100): Candle => ({ time, open: price, high: price + 1, low: price - 1, close: price + 0.5 });

test("removes the currently forming candle", () => {
  const now = new Date("2026-09-13T12:17:00Z");
  assert.deepEqual(confirmedCandles([
    candle("2026-09-13T12:05:00Z"),
    candle("2026-09-13T12:15:00Z"),
  ], "5m", now).map((item) => item.time), ["2026-09-13T12:05:00Z"]);
});

test("keeps the currently forming candle available for explicitly labeled early signals", () => {
  const now = new Date("2026-09-13T12:17:00Z");
  assert.deepEqual(visibleCandles([
    candle("2026-09-13T12:05:00Z"),
    candle("2026-09-13T12:15:00Z"),
    candle("2026-09-13T12:20:00Z"),
  ], now).map((item) => item.time), ["2026-09-13T12:05:00Z", "2026-09-13T12:15:00Z"]);
});

test("runs a live ranked-asset slice without hardcoding its id", async () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const requested: string[] = [];
  const progress: number[] = [];
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
  const result = await runLiveScan("BULL", { now, fetcher, onProgress: (completed) => progress.push(completed) });
  assert.equal(result.source, "bubinga");
  assert.equal(result.targetCount, 1);
  assert.ok(requested.some((url) => url.includes("assets/349/candles")));
  assert.deepEqual(progress, [0, 1]);
  assert.deepEqual(requested.filter((url) => url.includes("candles")).map((url) => new URL(url).searchParams.get("detalization")).sort(), ["1h", "30m"]);
});

test("a falling trend alone cannot enter either BULL list", async () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/assets")) return new Response(JSON.stringify({ data: [{
      id: 49, name: "LATAM", code: "OTC_LATAM", enabled: true,
      profitability: { binary: { current: 0.88, enabled: true } },
    }] }));
    const minutes = url.searchParams.get("detalization") === "5m" ? 5 : url.searchParams.get("detalization") === "30m" ? 30 : 60;
    const data = Array.from({ length: 80 }, (_, index) => {
      const time = new Date(now.getTime() - (80 - index) * minutes * 60_000).toISOString();
      return candle(time, 200 - index);
    });
    return new Response(JSON.stringify({ data }));
  };
  const result = await runLiveScan("BULL", { now, fetcher });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.watches?.length, 0);
});

test("hourly BULL needs low RSI and convergence or a new upward cross",()=>{
  assert.ok(bullHourTiming(14,17,10,16,30)?.approaching);
  assert.ok(bullHourTiming(16,14,12,13,30)?.justCrossed);
  assert.equal(bullHourTiming(16,14,12,13,30.01),null);
  assert.equal(bullHourTiming(16,14,14,13,29),null);
  assert.equal(bullHourTiming(0,2,0,4,28),null);
});
