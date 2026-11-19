import { fetchBubingaAssets } from "./bubinga-assets.ts";
import { fetchBubingaCandles, type CandleValidation, type SupportedTimeframe } from "./bubinga-candles.ts";
import { rankTradableAssets } from "./asset-ranking.ts";
import { stochastic, rsi } from "./indicators.ts";
import type { CrossWatch } from "./types.ts";
import { selectTopCandidates } from "./candidate-selection.ts";
import { hasEarlyBottomReversal, hasFreshZeroReversal, scoreAsset } from "./scoring.ts";
import type { Asset, Candle, Candidate, Direction, ScanResult } from "./types.ts";

const TARGET_LIMIT = 20;
const CONCURRENCY = 4;
const CANDLE_CACHE_MS: Record<SupportedTimeframe, number> = { "1m": 60_000, "5m": 30_000, "30m": 120_000, "1h": 120_000 };
const candleCache = new Map<string, { expiresAt: number; value: CandleValidation }>();
const HISTORY_MS: Record<SupportedTimeframe, number> = {
  "1m": 2 * 60 * 60_000,
  "5m": 18 * 60 * 60_000,
  "30m": 3 * 24 * 60 * 60_000,
  "1h": 5 * 24 * 60 * 60_000,
};
const INTERVAL_MS: Record<SupportedTimeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
};

export function confirmedCandles(candles: Candle[], timeframe: SupportedTimeframe, now: Date): Candle[] {
  const cutoff = now.getTime();
  return candles.filter((candle) => Date.parse(candle.time) + INTERVAL_MS[timeframe] <= cutoff);
}

export function visibleCandles(candles: Candle[], now: Date): Candle[] {
  const cutoff = now.getTime();
  return candles.filter((candle) => Date.parse(candle.time) <= cutoff);
}

export function clearLiveScanCache(): void {
  candleCache.clear();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let completed = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
      completed += 1;
      onProgress?.(completed, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type AssetResult = { candidate: Candidate | null; analyzed: boolean; warnings: string[]; watches?: CrossWatch[] };

export function crossWatch(direction: Direction, k: number, d: number, pk: number, pd: number, strength: number) {
  if (![k,d,pk,pd,strength].every(Number.isFinite)) return null;
  const sign = direction === "BULL" ? 1 : -1;
  const gap = sign * (d-k);
  if (gap <= 0 || gap > 5 || (sign === 1 ? k > 10 || strength > 48 : k < 90 || strength < 52)) return null;
  return { k,d,rsi: strength, approaching: sign*(k-pk) > 0 && gap < sign*(pd-pk) };
}

export async function runLiveScan(
  direction: Direction,
  options: {
    now?: Date;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  } = {},
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
    return { ...result, candles: confirmedCandles(result.candles, timeframe, now), liveCandles: visibleCandles(result.candles, now) };
  };

  options.onProgress?.(0, targets.length);
  const evaluated = await mapWithConcurrency(targets, CONCURRENCY, async (asset): Promise<AssetResult> => {
    try {
      const [m30, h1] = await Promise.all([fetchTimeframe(asset, "30m"), fetchTimeframe(asset, "1h")]);
      if (m30.candles.length < 50 || h1.candles.length < 50) {
        return { candidate: null, analyzed: false, warnings: [`${asset.name}: EMA50に必要な確定足が不足`] };
      }
      const warnings = [m30, h1].flatMap((result, index) =>
        result.gaps.length ? [`${asset.name} ${["30M", "1H"][index]}: ${result.gaps.length}箇所の欠損`] : [],
      );
      const watches = ([["1H",h1],["30M",m30]] as const).flatMap(([timeframe,frame]) => {
        const {k,d} = stochastic(frame.liveCandles);
        const signal = crossWatch(direction,k.at(-1)!,d.at(-1)!,k.at(-2)!,d.at(-2)!,rsi(frame.liveCandles.map(c=>c.close)).at(-1)!);
        return signal ? [{...signal,assetId:asset.id,name:asset.name,timeframe,provisional:frame.liveCandles.length > frame.candles.length}] : [];
      });
      const m5 = await fetchTimeframe(asset, "5m");
      if (m5.candles.length < 50) {
        return { candidate: null, analyzed: false, warnings: [...warnings, `${asset.name}: 5M確定足が不足`] };
      }
      if (m5.gaps.length) warnings.push(`${asset.name} 5M: ${m5.gaps.length}箇所の欠損`);
      const confirmedCandidate = scoreAsset(asset, m5.candles, m30.candles, h1.candles, direction);
      const liveCandidate = scoreAsset(asset, m5.liveCandles, m30.liveCandles, h1.liveCandles, direction);
      const formingReversal = (h1.liveCandles.length > h1.candles.length
          && (hasEarlyBottomReversal(h1.liveCandles, direction) || hasFreshZeroReversal(h1.liveCandles, direction, "1h")))
        || (m30.liveCandles.length > m30.candles.length
          && (hasEarlyBottomReversal(m30.liveCandles, direction) || hasFreshZeroReversal(m30.liveCandles, direction, "30m")));
      const candidate = formingReversal && liveCandidate
        && (!confirmedCandidate || liveCandidate.score > confirmedCandidate.score)
        ? { ...liveCandidate, provisional: true }
        : confirmedCandidate;
      return { candidate, analyzed: true, warnings, watches };
    } catch {
      return { candidate: null, analyzed: false, warnings: [`${asset.name}: データ取得に失敗`] };
    }
  }, options.onProgress);

  const candidates = selectTopCandidates(evaluated.flatMap(item => item.candidate ? [item.candidate] : []));
  const used = new Set(candidates.map(c=>c.assetId));
  const watches = evaluated.flatMap(item=>item.watches ?? []).sort((a,b)=>Number(b.approaching)-Number(a.approaching))
    .filter(w=>{ if (used.has(w.assetId)) return false; used.add(w.assetId); return true; }).slice(0,5-candidates.length);
  return {
    scannedAt: new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now),
    source: "bubinga",
    candidates, watches,
    analyzedCount: evaluated.filter((item) => item.analyzed).length,
    targetCount: targets.length,
    warnings: evaluated.flatMap((item) => item.warnings),
  };
}

export const runLiveGsmiScan = runLiveScan;
