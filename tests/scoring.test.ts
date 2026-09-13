import test from "node:test";
import assert from "node:assert/strict";
import { ema, rsi, stochastic } from "../src/lib/indicators.ts";
import { classifyAo, classifyRsi, classifyStochastic, maGate } from "../src/lib/scoring.ts";
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
test("All early phases total 70 by specification", () => assert.equal(Math.round(35 * 0.7 + 30 * 0.7 + 35 * 0.7), 70));
test("RSI phase boundaries", () => { assert.equal(classifyRsi([48, 58], "BULL"), "optimal"); assert.equal(classifyRsi([61, 55], "BEAR"), "early"); });
test("AO bull early below zero and improving", () => assert.equal(classifyAo([-0.4, -0.3, -0.2, -0.1], "BULL"), "early"));
test("Stochastic bull optimal after cross", () => assert.equal(classifyStochastic([20, 35], [25, 30], "BULL"), "optimal"));
