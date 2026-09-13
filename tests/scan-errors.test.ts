import test from "node:test";
import assert from "node:assert/strict";
import { BubingaDataError } from "../src/lib/bubinga-assets.ts";
import { toScanFailure } from "../src/lib/scan-errors.ts";

test("maps network failures to a retryable timeout message", () => {
  const result = toScanFailure(new BubingaDataError("timeout", "NETWORK"));
  assert.equal(result.retryable, true);
  assert.match(result.title, /タイムアウト/);
});

test("maps invalid responses to a non-retryable safe stop", () => {
  const result = toScanFailure(new BubingaDataError("invalid", "INVALID_RESPONSE"));
  assert.equal(result.retryable, false);
  assert.match(result.message, /分析を中止/);
});

test("maps HTTP and unknown failures without exposing raw errors", () => {
  assert.equal(toScanFailure(new BubingaDataError("secret response", "HTTP")).retryable, true);
  const unknown = toScanFailure(new Error("private details"));
  assert.doesNotMatch(unknown.message, /private details/);
});
