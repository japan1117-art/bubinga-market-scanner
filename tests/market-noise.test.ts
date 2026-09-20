import test from "node:test";
import assert from "node:assert/strict";
import { assessMarketNoise } from "../src/lib/market-noise.ts";
import type { Candle } from "../src/lib/types.ts";

function candles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    time: new Date(index * 300_000).toISOString(),
    open: index ? closes[index - 1] : close,
    high: Math.max(close, index ? closes[index - 1] : close) + 0.1,
    low: Math.min(close, index ? closes[index - 1] : close) - 0.1,
    close,
  }));
}

test("a directional market has low short-term noise", () => {
  const result = assessMarketNoise(candles([100, 101, 102, 103, 104, 105]), "BULL", 6);
  assert.equal(result.reversals, 0);
  assert.equal(result.efficiency, 100);
  assert.ok(result.score < 20);
});

test("a back-and-forth market has high short-term noise", () => {
  const result = assessMarketNoise(candles([100, 103, 100, 104, 99, 103]), "BULL", 6);
  assert.equal(result.reversals, 4);
  assert.ok(result.efficiency < 20);
  assert.ok(result.score >= 70);
});

test("medium-term noise uses twelve five-minute candles", () => {
  const result = assessMarketNoise(candles([100, 102, 100, 103, 99, 102, 100, 103, 99, 102, 100, 101]), "BULL", 12);
  assert.equal(result.bars, 12);
  assert.equal(result.sufficient, true);
  assert.ok(result.rangePercent > 0);
});

test("insufficient history fails closed without inventing noise", () => {
  assert.equal(assessMarketNoise(candles([100, 101, 100]), "BULL", 6).sufficient, false);
});
