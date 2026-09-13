import type { Candle } from "./types.ts";
import { BubingaDataError } from "./bubinga-assets.ts";

const API_ORIGIN = "https://api.bubinga.com";
export const SUPPORTED_TIMEFRAMES = ["5m", "30m", "1h"] as const;
export type SupportedTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

type UnknownRecord = Record<string, unknown>;

export interface CandleValidation {
  candles: Candle[];
  rejected: number;
  duplicates: number;
  gaps: Array<{ after: string; before: string; missing: number }>;
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const numeric = Number(value);
    const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function normalizeCandle(raw: unknown): Candle | null {
  const value = record(raw);
  if (!value) return null;
  const time = normalizeTime(value.time);
  const open = finiteNumber(value.open);
  const high = finiteNumber(value.high);
  const low = finiteNumber(value.low);
  const close = finiteNumber(value.close);
  if (!time || open === null || high === null || low === null || close === null) return null;
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
  if ([open, high, low, close].some((price) => price < 0)) return null;
  return { time, open, high, low, close };
}

function candleArray(payload: unknown): unknown[] {
  const root = record(payload);
  const data = record(root?.data);
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(data?.items)
          ? data.items
          : null;
  if (!source) throw new BubingaDataError("Candles response does not contain a candle array.", "INVALID_RESPONSE");
  return source;
}

export function normalizeCandlesResponse(payload: unknown, intervalMinutes = 30): CandleValidation {
  const source = candleArray(payload);
  const byTime = new Map<string, Candle>();
  let rejected = 0;
  let duplicates = 0;

  for (const item of source) {
    const candle = normalizeCandle(item);
    if (!candle) {
      rejected += 1;
      continue;
    }
    if (byTime.has(candle.time)) duplicates += 1;
    byTime.set(candle.time, candle);
  }

  const candles = [...byTime.values()].toSorted((left, right) => Date.parse(left.time) - Date.parse(right.time));
  const intervalMs = intervalMinutes * 60_000;
  const gaps: CandleValidation["gaps"] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const difference = Date.parse(candles[index].time) - Date.parse(candles[index - 1].time);
    if (difference > intervalMs) {
      gaps.push({
        after: candles[index - 1].time,
        before: candles[index].time,
        missing: Math.max(1, Math.round(difference / intervalMs) - 1),
      });
    }
  }
  return { candles, rejected, duplicates, gaps };
}

export async function fetchBubingaCandles(options: {
  assetId: number;
  timeframe: SupportedTimeframe;
  from: string;
  to: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<CandleValidation> {
  if (!Number.isInteger(options.assetId) || options.assetId <= 0) {
    throw new BubingaDataError("A positive integer asset ID is required.", "INVALID_RESPONSE");
  }
  if (!options.from || !options.to) {
    throw new BubingaDataError("Explicit from/to values are required until API units are confirmed.", "INVALID_RESPONSE");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const url = new URL(`/api/v1/assets/${options.assetId}/candles`, API_ORIGIN);
  url.searchParams.set("from", options.from);
  url.searchParams.set("to", options.to);
  url.searchParams.set("detalization", options.timeframe);

  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new BubingaDataError(`Candles API returned HTTP ${response.status}.`, "HTTP");
    const intervalMinutes = options.timeframe === "5m" ? 5 : options.timeframe === "30m" ? 30 : 60;
    return normalizeCandlesResponse(await response.json(), intervalMinutes);
  } catch (error) {
    if (error instanceof BubingaDataError) throw error;
    throw new BubingaDataError(error instanceof Error ? error.message : "Candles API request failed.", "NETWORK");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
