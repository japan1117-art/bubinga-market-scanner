import test from "node:test";
import assert from "node:assert/strict";
import { bollingerBands, ema, rsi, stochastic } from "../src/lib/indicators.ts";
import { classifyAo, classifyReversalSetup, classifyRsi, classifyStochastic, combineTimeframeScores, DEFAULT_MA_GATE_CONFIG, EARLY_MULTIPLIER, EARLY_TIMING_ADVANCE, maGate, scoreAsset, scoreIndicators, timeframeContributions } from "../src/lib/scoring.ts";
import type { Candle } from "../src/lib/types.ts";

function trend(sign = 1): Candle[] {
  return Array.from({ length: 80 }, (_, i) => {
    const open = 100 + sign * i; const close = open + sign * 0.5;
    return { time: String(i), open, close, high: Math.max(open, close) + 0.2, low: Math.min(open, close) - 0.2 };
  });
}

function bullConfirmedReversal(): Candle[] {
  return candlesFromDeltas(-0.5, 65, [-0.93, -0.91, 1.18, 0.01, -0.43, -0.52, 1.34, 0.27, 0.04, 0.64, -0.97, 0.17, -0.89, 0.32, 0.37]);
}

function mirror(candles: Candle[]): Candle[] {
  return candles.map((candle) => ({ ...candle, open: -candle.open, close: -candle.close, high: -candle.low, low: -candle.high }));
}

function candlesFromDeltas(prefixDelta: number, prefixLength: number, tail: number[]): Candle[] {
  let price = 100;
  return [...Array.from({ length: prefixLength }, () => prefixDelta), ...tail].map((delta, index) => {
    const open = price; price += delta;
    return { time: String(index), open, close: price, high: Math.max(open, price) + 0.2, low: Math.min(open, price) - 0.2 };
  });
}

test("EMA returns one seed plus subsequent values", () => assert.equal(ema([1, 2, 3, 4, 5], 3).length, 3));
test("RSI reaches 100 for a monotonic rise", () => assert.equal(rsi(Array.from({ length: 20 }, (_, i) => i), 14).at(-1), 100));
test("Stochastic values stay within 0..100", () => assert.ok(stochastic(trend(), 14, 3).k.every((value) => value >= 0 && value <= 100)));
test("Bollinger Bands use a ten-period two-sigma envelope", () => {
  const bands = bollingerBands([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10, 2);
  assert.equal(bands.middle.at(-1), 5.5); assert.ok(bands.lower.at(-1)! < 1); assert.ok(bands.upper.at(-1)! > 10);
});
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
test("MA gate bypass is explicit and reserved for comparison backtests", () => {
  const falling = trend(-1);
  const asset = { id: 1, name: "TEST", payout: 90 };
  const earlyReversal = scoreAsset(asset, falling, falling, falling, "BULL");
  assert.ok(earlyReversal, "an H1 potential reversal is the documented MA-gate exception");
  assert.equal(earlyReversal.ma1h, false); assert.equal(earlyReversal.score, 80);
});
test("early scoring advances thirty percent of the remaining distance to optimal", () => {
  assert.equal(EARLY_TIMING_ADVANCE, 0.3);
  assert.ok(Math.abs(EARLY_MULTIPLIER - 0.79) < 1e-12);
  assert.equal(Math.round(35 * EARLY_MULTIPLIER + 30 * EARLY_MULTIPLIER + 35 * EARLY_MULTIPLIER), 79);
});
test("combines 1h, 30m and 5m scores at 50/35/15 weights", () => {
  assert.equal(combineTimeframeScores(90, 70, 50), 77);
  assert.equal(combineTimeframeScores(100, 100, 0), 85);
  assert.equal(combineTimeframeScores(0, 100, 100), 50);
  assert.deepEqual(timeframeContributions(80, 80, 80), { score1h: 40, score30m: 28, score5m: 12 });
});
test("timeframe weighting rounds only the final score", () => {
  assert.equal(combineTimeframeScores(79.5, 80.5, 60.5), 77);
});
test("indicator scoring exposes exact component points", () => {
  const scored = scoreIndicators(trend(1), "BULL");
  assert.equal(scored.baseScore, scored.points.ao + scored.points.rsi + scored.points.stochastic);
});
test("potential reversal is worth eighty percent in both directions", () => {
  assert.equal(classifyReversalSetup(trend(-1), "BULL"), "potential");
  assert.equal(scoreIndicators(trend(-1), "BULL").score, 80);
  assert.equal(classifyReversalSetup(trend(1), "BEAR"), "potential");
  assert.equal(scoreIndicators(trend(1), "BEAR").score, 80);
});

test("pre-reversal preparation is visible at sixty percent in both directions", () => {
  const bull = candlesFromDeltas(0.15, 65, [0.34, -0.6, 0.12, 0.95, -0.43, -0.48, -0.36, 0.25, 0.75, -0.84, -0.98, 0.18, -0.44, -0.7, 0.14]);
  const bear = mirror(bull);
  assert.equal(classifyReversalSetup(bull, "BULL"), "preparing");
  assert.equal(scoreIndicators(bull, "BULL").score, 60);
  assert.equal(classifyReversalSetup(bear, "BEAR"), "preparing");
  assert.equal(scoreIndicators(bear, "BEAR").score, 60);
});

test("a mature H1 reversal caps the final score even when lower timeframes are strong", () => {
  const mature = candlesFromDeltas(0.4, 70, [-0.74, -1.07, -0.71, -1.15, -0.08, -0.85, -0.1, 0.48, -0.08, -1.01]);
  const result = scoreAsset({ id: 1, name: "TEST", payout: 90 }, trend(1), trend(1), mature, "BULL", { requireMaGate: false });
  assert.ok(result);
  assert.ok(result.score <= 69);
});
test("post-zero exhaustion plus RSI overheat cuts the timeframe score to thirty percent", () => {
  const bull = candlesFromDeltas(0.5, 70, [0.53, 0.11, -0.22, -0.7, -0.25, 0.35, -0.09, 0.28, -0.32, 0.19]);
  const bear = mirror(bull);
  const bullScore = scoreIndicators(bull, "BULL");
  const bearScore = scoreIndicators(bear, "BEAR");
  assert.equal(bullScore.setup, "exhausted");
  assert.equal(bullScore.score, 30);
  assert.equal(bearScore.setup, "exhausted");
  assert.equal(bearScore.score, 30);
  assert.deepEqual(timeframeContributions(bullScore.score, bullScore.score, bullScore.score), { score1h: 15, score30m: 11, score5m: 5 });
});
test("a clear H1 trend remains a candidate even when lower timeframes are not aligned", () => {
  const sideways = candlesFromDeltas(0, 0, Array.from({ length: 80 }, (_, index) => index % 2 === 0 ? 1 : -1));
  const result = scoreAsset({ id: 1, name: "TEST", payout: 90 }, sideways, sideways, trend(1), "BULL");
  assert.ok(result);
  assert.equal(result.score, 60);
  assert.equal(result.score1h, 40);
});
test("AO color turn plus prior-candle higher low and Stochastic cross is full score", () => {
  const bull = bullConfirmedReversal(); const bear = mirror(bull);
  assert.equal(classifyReversalSetup(bull, "BULL"), "confirmed");
  assert.equal(scoreIndicators(bull, "BULL").score, 100);
  assert.equal(classifyReversalSetup(bear, "BEAR"), "confirmed");
  assert.equal(scoreIndicators(bear, "BEAR").score, 100);
});
test("a confirmed bull reversal cannot score full points when Stochastic is overbought", () => {
  const overbought = candlesFromDeltas(-0.5, 65, [-0.55, 0.11, 0.61, 1.27, 0.44, 0.99, -0.53, -0.01, -0.8, 0.81, 0.23, 0.84, -0.66, 0.28, 0.66]);
  assert.equal(classifyReversalSetup(overbought, "BULL"), "overextended");
  assert.equal(scoreIndicators(overbought, "BULL").score, 40);
});
test("AO beyond zero is capped at eighty percent", () => {
  assert.equal(classifyReversalSetup(trend(1), "BULL"), "post_zero");
  assert.equal(scoreIndicators(trend(1), "BULL").score, 80);
  assert.equal(classifyReversalSetup(trend(-1), "BEAR"), "post_zero");
  assert.equal(scoreIndicators(trend(-1), "BEAR").score, 80);
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
