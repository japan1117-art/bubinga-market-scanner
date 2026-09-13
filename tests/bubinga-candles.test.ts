import test from "node:test";
import assert from "node:assert/strict";
import { fetchBubingaCandles, normalizeCandle, normalizeCandlesResponse } from "../src/lib/bubinga-candles.ts";

const valid = (time: string | number, open = 100) => ({ time, open, high: open + 2, low: open - 2, close: open + 1 });

test("normalizes ISO, epoch seconds and numeric strings", () => {
  assert.equal(normalizeCandle(valid("2026-09-13T00:00:00Z"))?.time, "2026-09-13T00:00:00.000Z");
  assert.equal(normalizeCandle(valid(1_789_257_600))?.time, "2026-09-13T00:00:00.000Z");
  assert.equal(normalizeCandle({ ...valid("1789257600000"), open: "100", high: "102", low: "98", close: "101" })?.close, 101);
});

test("rejects impossible OHLC and negative prices", () => {
  assert.equal(normalizeCandle({ time: "2026-09-13", open: 100, high: 99, low: 98, close: 101 }), null);
  assert.equal(normalizeCandle(valid("2026-09-13", -1)), null);
});

test("sorts, deduplicates and reports malformed candles", () => {
  const result = normalizeCandlesResponse({ data: [
    valid("2026-09-13T01:00:00Z", 102),
    valid("2026-09-13T00:00:00Z", 100),
    valid("2026-09-13T00:00:00Z", 101),
    { bad: true },
  ] });
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[0].open, 101);
  assert.equal(result.duplicates, 1);
  assert.equal(result.rejected, 1);
});

test("detects missing 30-minute intervals", () => {
  const result = normalizeCandlesResponse([
    valid("2026-09-13T00:00:00Z"),
    valid("2026-09-13T01:30:00Z"),
  ]);
  assert.deepEqual(result.gaps.map((gap) => gap.missing), [2]);
});

test("builds the confirmed 30m request without credentials", async () => {
  let requestUrl = "";
  const result = await fetchBubingaCandles({
    assetId: 50,
    timeframe: "30m",
    from: "1789257600",
    to: "1789261200",
    fetcher: async (input, init) => {
      requestUrl = String(input);
      assert.equal(init?.credentials, "omit");
      return new Response(JSON.stringify([valid("2026-09-13T00:00:00Z")]), { status: 200 });
    },
  });
  assert.equal(result.candles.length, 1);
  assert.match(requestUrl, /assets\/50\/candles/);
  assert.match(requestUrl, /dataization=30m/);
});

test("builds a 5m request and validates five-minute gaps", async () => {
  let requestUrl = "";
  const result = await fetchBubingaCandles({
    assetId: 50,
    timeframe: "5m",
    from: "1789257600",
    to: "1789258500",
    fetcher: async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify([
        valid("2026-09-13T00:00:00Z"),
        valid("2026-09-13T00:15:00Z"),
      ]), { status: 200 });
    },
  });
  assert.match(requestUrl, /dataization=5m/);
  assert.equal(result.gaps[0].missing, 2);
});
