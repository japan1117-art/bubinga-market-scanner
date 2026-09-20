import { normalizeCandlesResponse } from "./bubinga-candles.ts";
import type { BacktestSeries } from "./backtest.ts";
import type { Asset } from "./types.ts";

export const BACKTEST_DATASET_VERSION = 1 as const;

export interface BacktestDataset {
  version: typeof BACKTEST_DATASET_VERSION;
  capturedAt: string;
  from: string;
  to: string;
  source: "bubinga-unauthenticated";
  series: BacktestSeries[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function asset(value: unknown): Asset | null {
  const item = record(value);
  if (!item || !Number.isInteger(item.id) || Number(item.id) <= 0) return null;
  if (typeof item.name !== "string" || typeof item.code !== "string") return null;
  if (typeof item.enabled !== "boolean" || !Number.isFinite(item.payout)) return null;
  return { id: Number(item.id), name: item.name, code: item.code, enabled: item.enabled, payout: Number(item.payout) };
}

function iso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function normalizeBacktestDataset(payload: unknown): BacktestDataset {
  const root = record(payload);
  if (!root || root.version !== BACKTEST_DATASET_VERSION || root.source !== "bubinga-unauthenticated") {
    throw new Error("Unsupported backtest dataset format.");
  }
  const capturedAt = iso(root.capturedAt); const from = iso(root.from); const to = iso(root.to);
  if (!capturedAt || !from || !to || Date.parse(from) >= Date.parse(to) || !Array.isArray(root.series)) {
    throw new Error("Invalid backtest dataset metadata.");
  }
  const series = root.series.map((raw, index) => {
    const item = record(raw); const normalizedAsset = asset(item?.asset);
    if (!item || !normalizedAsset) throw new Error(`Invalid asset at series[${index}].`);
    const candles5m = normalizeCandlesResponse(item.candles5m, 5).candles;
    const candles30m = normalizeCandlesResponse(item.candles30m, 30).candles;
    const candles1h = normalizeCandlesResponse(item.candles1h, 60).candles;
    if (candles5m.length < 50 || candles30m.length < 50 || candles1h.length < 50) {
      throw new Error(`Insufficient candles for ${normalizedAsset.name}.`);
    }
    return { asset: normalizedAsset, candles5m, candles30m, candles1h };
  });
  if (!series.length) throw new Error("Backtest dataset has no series.");
  return { version: BACKTEST_DATASET_VERSION, capturedAt, from, to, source: "bubinga-unauthenticated", series };
}
