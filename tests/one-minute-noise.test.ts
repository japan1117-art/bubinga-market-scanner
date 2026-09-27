import test from "node:test";
import assert from "node:assert/strict";
import { assessOneMinuteNoise } from "../src/lib/one-minute-noise.ts";
import type { Candle } from "../src/lib/types.ts";

function candles(choppy = false): Candle[] {
  let close = 100;
  return Array.from({ length: 60 }, (_, index): Candle => {
    const open = close;
    const amplitude = choppy && index >= 50 ? 1 : 0.02;
    close = open + (index % 2 === 0 ? amplitude : -amplitude);
    return { time: new Date(Date.UTC(2026, 8, 27) + index * 60_000).toISOString(), open,
      high: Math.max(open, close) + amplitude * 0.2, low: Math.min(open, close) - amplitude * 0.2, close };
  });
}

test("one-minute noise detects sigma expansion with repeated reversals", () => {
  const result = assessOneMinuteNoise(candles(true));
  assert.equal(result.sufficient, true);
  assert.ok(result.sigmaZ > 2);
  assert.ok(result.sigmaRatio > 10);
  assert.ok(result.reversalRate >= 80);
  assert.ok(result.score >= 70);
});

test("one-minute noise fails closed with fewer than sixty bars", () => {
  const result = assessOneMinuteNoise(candles().slice(0, 59));
  assert.equal(result.sufficient, false);
  assert.equal(result.score, 0);
});
