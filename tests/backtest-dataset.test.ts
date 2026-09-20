import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBacktestDataset } from "../src/lib/backtest-dataset.ts";

const candles = (count: number, minutes: number) => Array.from({ length: count }, (_, index) => ({
  time: new Date(Date.UTC(2026, 8, 1) + index * minutes * 60_000).toISOString(),
  open: 100 + index, high: 101 + index, low: 99 + index, close: 100.5 + index,
}));

function dataset() {
  return {
    version: 1, capturedAt: "2026-09-20T00:00:00Z", from: "2026-09-01T00:00:00Z", to: "2026-09-10T00:00:00Z",
    source: "bubinga-unauthenticated",
    series: [{ asset: { id: 49, name: "GSMI", code: "GSMI", enabled: true, payout: 90 },
      candles5m: candles(50, 5), candles30m: candles(50, 30), candles1h: candles(50, 60) }],
  };
}

test("normalizes a reusable backtest dataset", () => {
  const result = normalizeBacktestDataset(dataset());
  assert.equal(result.series[0].asset.name, "GSMI");
  assert.equal(result.series[0].candles5m.length, 50);
});

test("rejects datasets that cannot warm up EMA50", () => {
  const input = dataset(); input.series[0].candles1h = candles(49, 60);
  assert.throws(() => normalizeBacktestDataset(input), /Insufficient candles/);
});
