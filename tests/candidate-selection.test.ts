import test from "node:test";
import assert from "node:assert/strict";
import { classifyOpportunity, selectTopCandidates } from "../src/lib/candidate-selection.ts";
import type { Candidate } from "../src/lib/types.ts";

function candidate(id: number, score: number, score5m = score, payout = 90): Candidate {
  return {
    assetId: id,
    name: `ASSET-${id}`,
    payout,
    direction: "BULL",
    score,
    score5m,
    score30m: score,
    ma1h: true,
    ma30m: true,
    rsi: 58,
    phases: { ao: "optimal", rsi: "optimal", stochastic: "optimal" },
  };
}

test("classifies exact NOW and SOON boundaries", () => {
  assert.equal(classifyOpportunity(100), "NOW");
  assert.equal(classifyOpportunity(80), "NOW");
  assert.equal(classifyOpportunity(79), "SOON");
  assert.equal(classifyOpportunity(60), "SOON");
  assert.equal(classifyOpportunity(59), "HIDDEN");
  assert.equal(classifyOpportunity(Number.NaN), "HIDDEN");
});

test("NOW and SOON share one five-item limit", () => {
  const input = [95, 90, 85, 80, 79, 75, 70].map((score, index) => candidate(index + 1, score));
  const output = selectTopCandidates(input);
  assert.equal(output.length, 5);
  assert.deepEqual(output.map((item) => item.score), [95, 90, 85, 80, 79]);
});

test("removes every candidate below sixty", () => {
  assert.deepEqual(selectTopCandidates([candidate(1, 59), candidate(2, 60)]).map((item) => item.assetId), [2]);
});

test("uses 5m score then payout as tie breakers", () => {
  const output = selectTopCandidates([
    candidate(1, 80, 70, 95),
    candidate(2, 80, 90, 80),
    candidate(3, 80, 70, 99),
  ]);
  assert.deepEqual(output.map((item) => item.assetId), [2, 3, 1]);
});

test("selection is non-mutating and accepts an explicit limit", () => {
  const input = [candidate(1, 70), candidate(2, 90)];
  const snapshot = structuredClone(input);
  assert.equal(selectTopCandidates(input, 1)[0].assetId, 2);
  assert.deepEqual(input, snapshot);
});
