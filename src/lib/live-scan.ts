import { fetchBubingaAssets } from "./bubinga-assets.ts";
import { fetchBubingaCandles, type CandleValidation, type SupportedTimeframe } from "./bubinga-candles.ts";
import { rankTradableAssets } from "./asset-ranking.ts";
import { selectTopCandidates } from "./candidate-selection.ts";
import { maGate, scoreAsset } from "./scoring.ts";
import type { Asset, Candle, Candidate, Direction, ScanResult } from "./types.ts";

const TARGET_LIMIT = 20;
const CONCURRENCY = 4;
const CANDLE_CACHE_MS: Record<SupportedTimeframe, number> = { "5m": 30_000, "30m": 120_000, "1h": 120_000 };
const candleCache = new Map<string, { expiresAt: number; value: CandleValidation }>();
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

export function clearLiveScanCache(): void {
  candleCache.clear();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type AssetResult = { candidate: Candidate | null; analyzed: boolean; warnings: string[] };

export async function runLiveScan(
  direction: Direction,
  options: { now?: Date; fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ScanResult> {
  const now = options.now ?? new Date();
  const assets = await fetchBubingaAssets({ fetcher: options.fetcher, signal: options.signal });
  const targets = rankTradableAssets(assets, { limit: TARGET_LIMIT });
  if (!targets.length) throw new Error("No tradable assets are currently available.");

  const fetchTimeframe = async (asset: Asset, timeframe: SupportedTimeframe) => {
    const cacheKey = `${asset.id}:${timeframe}`;
    const cached = options.fetcher ? undefined : candleCache.get(cacheKey);
    let result = cached && cached.expiresAt > Date.now() ? cached.value : undefined;
    if (!result) result = await fetchBubingaCandles({
      assetId: asset.id,
      timeframe,
      from: new Date(now.getTime() - HISTORY_MS[timeframe]).toISOString(),
      to: now.toISOString(),
      fetcher: options.fetcher,
      signal: options.signal,
    });
    if (!options.fetcher && (!cached || cached.value !== result)) {
      candleCache.set(cacheKey, { expiresAt: Date.now() + CANDLE_CACHE_MS[timeframe], value: result });
    }
    return { ...result, candles: confirmedCandles(result.candles, timeframe, now) };
  };

  const evaluated = await mapWithConcurrency(targets, CONCURRENCY, async (asset): Promise<AssetResult> => {
    try {
      const [m30, h1] = await Promise.all([fetchTimeframe(asset, "30m"), fetchTimeframe(asset, "1h")]);
      if (m30.candles.length < 50 || h1.candles.length < 50) {
        return { candidate: null, analyzed: false, warnings: [`${asset.name}: EMA50に必要な確定足が不足`] };
      }
      const warnings = [m30, h1].flatMap((result, index) =>
        result.gaps.length ? [`${asset.name} ${["30M", "1H"][index]}: ${result.gaps.length}箇所の欠損`] : [],
      );
      if (!maGate(m30.candles, direction) || !maGate(h1.candles, direction)) {
        return { candidate: null, analyzed: true, warnings };
      }
      const m5 = await fetchTimeframe(asset, "5m");
      if (m5.candles.length < 50) {
        return { candidate: null, analyzed: false, warnings: [...warnings, `${asset.name}: 5M確定足が不足`] };
      }
      if (m5.gaps.length) warnings.push(`${asset.name} 5M: ${m5.gaps.length}箇所の欠損`);
      return { candidate: scoreAsset(asset, m5.candles, m30.candles, h1.candles, direction), analyzed: true, warnings };
    } catch {
      return { candidate: null, analyzed: false, warnings: [`${asset.name}: データ取得に失敗`] };
    }
  });

  return {
    scannedAt: new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now),
    source: "bubinga",
    candidates: selectTopCandidates(evaluated.flatMap((item) => item.candidate ? [item.candidate] : [])),
    analyzedCount: evaluated.filter((item) => item.analyzed).length,
    targetCount: targets.length,
    warnings: evaluated.flatMap((item) => item.warnings),
  };
}

export const runLiveGsmiScan = runLiveScan;
