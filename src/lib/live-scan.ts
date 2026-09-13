import { fetchBubingaAssets } from "./bubinga-assets.ts";
import { fetchBubingaCandles, type SupportedTimeframe } from "./bubinga-candles.ts";
import { selectTopCandidates } from "./candidate-selection.ts";
import { scoreAsset } from "./scoring.ts";
import type { Candle, Direction, ScanResult } from "./types.ts";

const GSMI_CODE = "OTC_GSMI";
const HISTORY_MS: Record<SupportedTimeframe, number> = {
  "5m": 18 * 60 * 60_000,
  "30m": 3 * 24 * 60 * 60_000,
  "1h": 5 * 24 * 60 * 60_000,
};
const INTERVAL_MS: Record<SupportedTimeframe, number> = {
  "5m": 5 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
};

export function confirmedCandles(candles: Candle[], timeframe: SupportedTimeframe, now: Date): Candle[] {
  const cutoff = now.getTime();
  return candles.filter((candle) => Date.parse(candle.time) + INTERVAL_MS[timeframe] <= cutoff);
}

export async function runLiveGsmiScan(
  direction: Direction,
  options: { now?: Date; fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ScanResult> {
  const now = options.now ?? new Date();
  const assets = await fetchBubingaAssets({ fetcher: options.fetcher, signal: options.signal });
  const asset = assets.find((item) => item.code === GSMI_CODE && item.enabled);
  if (!asset) throw new Error("GSMI is not currently tradable.");

  const fetchTimeframe = async (timeframe: SupportedTimeframe) => {
    const result = await fetchBubingaCandles({
      assetId: asset.id,
      timeframe,
      from: new Date(now.getTime() - HISTORY_MS[timeframe]).toISOString(),
      to: now.toISOString(),
      fetcher: options.fetcher,
      signal: options.signal,
    });
    return { ...result, candles: confirmedCandles(result.candles, timeframe, now) };
  };

  const [m5, m30, h1] = await Promise.all([
    fetchTimeframe("5m"),
    fetchTimeframe("30m"),
    fetchTimeframe("1h"),
  ]);
  if (m5.candles.length < 50 || m30.candles.length < 50 || h1.candles.length < 50) {
    throw new Error("Confirmed candle history is insufficient for EMA50.");
  }

  const candidate = scoreAsset(asset, m5.candles, m30.candles, h1.candles, direction);
  const warnings = [m5, m30, h1]
    .flatMap((result, index) => result.gaps.length ? [`${["5M", "30M", "1H"][index]}に${result.gaps.length}箇所の欠損を検出`] : []);

  return {
    scannedAt: new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now),
    source: "bubinga",
    candidates: selectTopCandidates(candidate ? [candidate] : []),
    analyzedCount: 1,
    targetCount: 1,
    warnings,
  };
}
