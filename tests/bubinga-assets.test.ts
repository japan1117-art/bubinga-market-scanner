import test from "node:test";
import assert from "node:assert/strict";
import { BubingaDataError, fetchBubingaAssets, normalizeAsset, normalizeAssetsResponse } from "../src/lib/bubinga-assets.ts";

const fixture = {
  data: [
    { id: 50, name: "GSMI", code: "GSMI", enabled: true, category: "index", profitability: { binary: { current: 0.92 }, turbo: { current: 0.9 } } },
    { id: "49", name: "LATAM", code: "LATAM", enabled: false, category: "index", profitability: { binary: { current: "88" } } },
    { id: 50, name: "duplicate", code: "DUP", enabled: true, profitability: { binary: { current: 99 } } },
    { id: null, name: "invalid", code: "", enabled: true, profitability: {} },
  ],
};

test("normalizes ratio payout to percent", () => assert.equal(normalizeAsset(fixture.data[0])?.payout, 92));
test("preserves percent payout", () => assert.equal(normalizeAsset(fixture.data[1])?.payout, 88));
test("normalizes and deduplicates assets", () => assert.deepEqual(normalizeAssetsResponse(fixture).map((asset) => asset.id), [50, 49]));
test("rejects an unknown response envelope", () => assert.throws(() => normalizeAssetsResponse({ result: [] }), BubingaDataError));
test("fetch omits credentials and requests one 250-item page", async () => {
  let requested = "";
  const assets = await fetchBubingaAssets({
    fetcher: async (input, init) => {
      requested = String(input);
      assert.equal(init?.credentials, "omit");
      return new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(assets.length, 2);
  assert.match(requested, /pagination%5Blimit%5D=250/);
  assert.match(requested, /pagination%5Boffset%5D=0/);
});
