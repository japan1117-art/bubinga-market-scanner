import test from "node:test";
import assert from "node:assert/strict";
import { ema, rsi, stochastic } from "../src/lib/indicators.ts";
import { classifyAo, classifyRsi, classifyStochastic, combineTimeframeScores, DEFAULT_MA_GATE_CONFIG, EARLY_MULTIPLIER, EARLY_TIMING_ADVANCE, maGate, scoreIndicators } from "../src/lib/scoring.ts";
import type { Candle } from "../src/lib/types.ts";

function trend(sign = 1): Candle[] {
  return Array.from({ length: 80 }, (_, i) => {
    const open = 100 + sign * i; const close = open + sign * 0.5;
    return { time: String(i), open, close, high: Math.max(open, close) + 0.2, low: Math.min(open, close) - 0.2 };
  });
}

test("EMA returns one seed plus subsequent values", () => assert.equal(ema([1, 2, 3, 4, 5], 3).length, 3));
test("RSI reaches 100 for a monotonic rise", () => assert.equal(rsi(Array.from({ length: 20 }, (_, i) => i), 14).at(-1), 100));
test("Stochastic values stay within 0..100", () => assert.ok(stochastic(trend(), 14, 3).k.every((value) => value >= 0 && value <= 100)));
test("MA gate is symmetric", () => { assert.equal(maGate(trend(1), "BULL"), true); assert.equal(maGate(trend(-1), "BEAR"), true); });
test("MA gate fails closed with insufficient history", () => assert.equal(maGate(trend().slice(0, 49), "BULL"), false));
test("MA gate rejects the opposite direction", () => { assert.equal(maGate(trend(1), "BEAR"), false); assert.equal(maGate(trend(-1), "BULL"), false); });
test("MA gate can disable the EMA50 confirmation for calibration", () => {
  assert.equal(maGate(trend().slice(0, 25), "BULL"), false);
  assert.equal(maGate(trend().slice(0, 25), "BULL", { requireFastSlowAlignment: false }), true);
});
test("default MA calibration remains EMA20/EMA50 with three slope points", () => {
  assert.deepEqual(DEFAULT_MA_GATE_CONFIG, { fastPeriod: 20, slowPeriod: 50, slopePoints: 3, requirePriceSide: true, requireFastSlowAlignment: true });
});
test("early scoring advances thirty percent of the remaining distance to optimal", () => {
  assert.equal(EARLY_TIMING_ADVANCE, 0.3);
  assert.ok(Math.abs(EARLY_MULTIPLIER - 0.79) < 1e-12);
  assert.equal(Math.round(35 * EARLY_MULTIPLIER + 30 * EARLY_MULTIPLIER + 35 * EARLY_MULTIPLIER), 79);
});
test("combines 1h, 30m and 5m scores at 60/30/10 weights", () => {
  assert.equal(combineTimeframeScores(90, 70, 50), 80);
  assert.equal(combineTimeframeScores(100, 100, 0), 90);
  assert.equal(combineTimeframeScores(0, 100, 100), 40);
});
test("timeframe weighting rounds only the final score", () => {
  assert.equal(combineTimeframeScores(79.5, 80.5, 60.5), 78);
});
test("indicator scoring exposes exact component points", () => {
  const scored = scoreIndicators(trend(1), "BULL");
  assert.equal(scored.score, scored.points.ao + scored.points.rsi + scored.points.stochastic);
});
test("RSI phase boundaries", () => { assert.equal(classifyRsi([48, 58], "BULL"), "optimal"); assert.equal(classifyRsi([61, 55], "BEAR"), "early"); });
test("AO bull early below zero and improving", () => assert.equal(classifyAo([-0.4, -0.3, -0.2, -0.1], "BULL"), "early"));
test("Stochastic bull optimal after cross", () => assert.equal(classifyStochastic([20, 35], [25, 30], "BULL"), "optimal"));

test("AO phases are directionally symmetric", () => {
  assert.equal(classifyAo([-0.4, -0.3, -0.2, -0.1], "BULL"), "early");
  assert.equal(classifyAo([0.4, 0.3, 0.2, 0.1], "BEAR"), "early");
  assert.equal(classifyAo([-0.1, 0.05, 0.15, 0.25], "BULL"), "optimal");
  assert.equal(classifyAo([0.1, -0.05, -0.15, -0.25], "BEAR"), "optimal");
  assert.equal(classifyAo([0.1, 0.25, 0.31, 0.33], "BULL"), "late");
  assert.equal(classifyAo([-0.1, -0.25, -0.31, -0.33], "BEAR"), "late");
});

test("AO returns none when momentum moves against the selected direction", () => {
  assert.equal(classifyAo([0.1, 0.2, 0.3, 0.2], "BULL"), "none");
  assert.equal(classifyAo([-0.1, -0.2, -0.3, -0.2], "BEAR"), "none");
});

test("RSI bull thresholds classify early, optimal, late and overheated", () => {
  assert.equal(classifyRsi([41, 42], "BULL"), "early");
  assert.equal(classifyRsi([49, 50], "BULL"), "optimal");
  assert.equal(classifyRsi([64, 65], "BULL"), "optimal");
  assert.equal(classifyRsi([65, 65.1], "BULL"), "late");
  assert.equal(classifyRsi([71, 72], "BULL"), "late");
  assert.equal(classifyRsi([72, 72.1], "BULL"), "none");
});

test("RSI bear thresholds classify early, optimal, late and oversold", () => {
  assert.equal(classifyRsi([59, 58], "BEAR"), "early");
  assert.equal(classifyRsi([51, 50], "BEAR"), "optimal");
  assert.equal(classifyRsi([36, 35], "BEAR"), "optimal");
  assert.equal(classifyRsi([35, 34.9], "BEAR"), "late");
  assert.equal(classifyRsi([29, 28], "BEAR"), "late");
  assert.equal(classifyRsi([28, 27.9], "BEAR"), "none");
});

test("Stochastic detects pre-cross, post-cross and overextended bull phases", () => {
  assert.equal(classifyStochastic([10, 18], [20, 19], "BULL"), "early");
  assert.equal(classifyStochastic([20, 35], [25, 30], "BULL"), "optimal");
  assert.equal(classifyStochastic([78, 85], [75, 80], "BULL"), "late");
});

test("Stochastic detects pre-cross, post-cross and overextended bear phases", () => {
  assert.equal(classifyStochastic([90, 82], [80, 81], "BEAR"), "early");
  assert.equal(classifyStochastic([80, 65], [75, 70], "BEAR"), "optimal");
  assert.equal(classifyStochastic([22, 15], [25, 20], "BEAR"), "late");
});

test("phase classifiers fail closed with insufficient values", () => {
  assert.equal(classifyAo([0.1, 0.2], "BULL"), "none");
  assert.equal(classifyRsi([58], "BULL"), "none");
  assert.equal(classifyStochastic([30], [25], "BULL"), "none");
});
