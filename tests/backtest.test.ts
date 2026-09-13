import test from "node:test";
import assert from "node:assert/strict";
import { candlesThrough, evaluateOutcome, summarizeBacktest, type BacktestSignal } from "../src/lib/backtest.ts";
import type { Candidate, Candle } from "../src/lib/types.ts";

const candle = (time: string, close: number): Candle => ({ time, open: close, high: close, low: close, close });

test("candlesThrough never includes a future candle", () => {
  const candles = [
    candle("2026-09-13T00:00:00Z", 100),
    candle("2026-09-13T00:05:00Z", 101),
    candle("2026-09-13T00:10:00Z", 999),
  ];
  const visible = candlesThrough(candles, Date.parse("2026-09-13T00:05:00Z"));
  assert.deepEqual(visible.map((item) => item.close), [100, 101]);
});

test("evaluates bull and bear outcomes symmetrically", () => {
  assert.equal(evaluateOutcome(100, 101, "BULL"), "WIN");
  assert.equal(evaluateOutcome(100, 99, "BULL"), "LOSS");
  assert.equal(evaluateOutcome(100, 99, "BEAR"), "WIN");
  assert.equal(evaluateOutcome(100, 101, "BEAR"), "LOSS");
  assert.equal(evaluateOutcome(100, 100, "BEAR"), "PUSH");
  assert.equal(evaluateOutcome(100, null, "BULL"), "NO_EXIT");
});

const candidate: Candidate = {
  assetId: 1, name: "GSMI", payout: 90, direction: "BULL", score: 80, score5m: 80, score30m: 80,
  ma1h: true, ma30m: true, rsi: 58, rsi30m: 58,
  phases: { ao: "optimal", rsi: "optimal", stochastic: "optimal" },
  phases30m: { ao: "optimal", rsi: "optimal", stochastic: "optimal" },
};

function signal(opportunity: "NOW" | "SOON", outcome: BacktestSignal["outcome"], pnlPerUnit: number, becameNowWithinWindow = false): BacktestSignal {
  return {
    assetId: 1, assetName: "GSMI", evaluatedAt: "2026-09-13T00:00:00Z", direction: "BULL",
    opportunity, candidate, entry: 100, exit: outcome === "NO_EXIT" ? null : 101,
    outcome, pnlPerUnit, becameNowWithinWindow,
  };
}

test("summarizes win rate, expected value and SOON conversion separately", () => {
  const summary = summarizeBacktest([
    signal("NOW", "WIN", 0.9),
    signal("NOW", "LOSS", -1),
    signal("SOON", "WIN", 0.9, true),
    signal("SOON", "PUSH", 0),
    signal("SOON", "NO_EXIT", 0),
  ]);
  assert.equal(summary.totalSignals, 5);
  assert.equal(summary.settledSignals, 4);
  assert.equal(summary.winRate, 2 / 3);
  assert.ok(Math.abs(summary.pnlPerUnit - 0.8) < 1e-12);
  assert.ok(Math.abs(summary.expectedValuePerSignal! - 0.2) < 1e-12);
  assert.equal(summary.soonToNowRate, 1 / 3);
});
