import test from "node:test";
import assert from "node:assert/strict";
import { rankTradableAssets } from "../src/lib/asset-ranking.ts";
import type { Asset } from "../src/lib/types.ts";

function asset(id: number, payout: number, enabled = true, code = `A${String(id).padStart(2, "0")}`): Asset {
  return { id, name: code, code, payout, enabled };
}

test("returns enabled assets in descending payout order", () => {
  const input = [asset(1, 80), asset(2, 95), asset(3, 99, false), asset(4, 90)];
  assert.deepEqual(rankTradableAssets(input).map((item) => item.id), [2, 4, 1]);
});

test("caps the default result at twenty assets", () => {
  const input = Array.from({ length: 25 }, (_, index) => asset(index + 1, 75 + index));
  const output = rankTradableAssets(input);
  assert.equal(output.length, 20);
  assert.equal(output[0].payout, 99);
  assert.equal(output.at(-1)?.payout, 80);
});

test("returns fewer than twenty when fewer are tradable", () => {
  assert.equal(rankTradableAssets([asset(1, 90), asset(2, 80, false)]).length, 1);
});

test("uses code then id as deterministic tie breakers", () => {
  const input = [asset(3, 90, true, "ZZZ"), asset(2, 90, true, "AAA"), asset(1, 90, true, "AAA")];
  assert.deepEqual(rankTradableAssets(input).map((item) => item.id), [1, 2, 3]);
});

test("supports a configurable minimum payout without mutating input", () => {
  const input = [asset(1, 70), asset(2, 85)];
  const snapshot = structuredClone(input);
  assert.deepEqual(rankTradableAssets(input, { minimumPayout: 80 }).map((item) => item.id), [2]);
  assert.deepEqual(input, snapshot);
});

test("handles zero and excessive limits safely", () => {
  const input = [asset(1, 90), asset(2, 80)];
  assert.deepEqual(rankTradableAssets(input, { limit: 0 }), []);
  assert.equal(rankTradableAssets(input, { limit: 999 }).length, 2);
});
