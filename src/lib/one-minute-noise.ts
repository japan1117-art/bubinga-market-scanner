import { fetchBubingaCandles } from "./bubinga-candles.ts";
import type { Candle, OneMinuteNoiseAssessment } from "./types.ts";

const REQUIRED_BARS = 60;
const CURRENT_WINDOW = 10;
const SIGMA_WEIGHT = 0.1;
const REVERSAL_WEIGHT = 0.3;
const INEFFICIENCY_WEIGHT = 0.25;
const WICK_WEIGHT = 0.35;
const CACHE = new Map<number, { expiresAt: number; value: OneMinuteNoiseAssessment }>();

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function empty(bars: number): OneMinuteNoiseAssessment {
  return { score: 0, sigmaZ: 0, sigmaRatio: 1, currentSigmaBps: 0, baselineSigmaBps: 0,
    reversalRate: 0, reversals: 0, efficiency: 100, wickRatio: 0, bars, sufficient: false };
}

export function assessOneMinuteNoise(candles: Candle[]): OneMinuteNoiseAssessment {
  const window = candles.slice(-REQUIRED_BARS);
  if (window.length < REQUIRED_BARS) return empty(window.length);
  if (window.some((candle) => candle.close <= 0)) return empty(window.length);
  const returns = window.slice(1).map((candle, index) => Math.log(candle.close / window[index].close) * 10_000);
  const currentReturns = returns.slice(-CURRENT_WINDOW);
  const baselineReturns = returns.slice(0, -CURRENT_WINDOW);
  const rollingSigma: number[] = [];
  for (let end = CURRENT_WINDOW; end <= baselineReturns.length; end += 1) {
    rollingSigma.push(standardDeviation(baselineReturns.slice(end - CURRENT_WINDOW, end)));
  }
  const currentSigmaBps = standardDeviation(currentReturns);
  const baselineSigmaBps = mean(rollingSigma);
  const sigmaOfSigma = standardDeviation(rollingSigma);
  const sigmaZ = sigmaOfSigma > 0 ? (currentSigmaBps - baselineSigmaBps) / sigmaOfSigma : currentSigmaBps > baselineSigmaBps ? 3 : 0;
  const sigmaRatio = baselineSigmaBps > 0 ? currentSigmaBps / baselineSigmaBps : currentSigmaBps > 0 ? 3 : 1;

  const meaningful = Math.max(mean(baselineReturns.map(Math.abs)) * 0.25, 1e-9);
  const signs = currentReturns.filter((value) => Math.abs(value) >= meaningful).map(Math.sign);
  let reversals = 0;
  for (let index = 1; index < signs.length; index += 1) if (signs[index] !== signs[index - 1]) reversals += 1;
  const reversalRate = signs.length > 1 ? reversals / (signs.length - 1) * 100 : 0;

  const currentCandles = window.slice(-(CURRENT_WINDOW + 1));
  const moves = currentCandles.slice(1).map((candle, index) => candle.close - currentCandles[index].close);
  const pathLength = moves.reduce((sum, move) => sum + Math.abs(move), 0);
  const netMove = Math.abs(currentCandles.at(-1)!.close - currentCandles[0].close);
  const efficiency = pathLength > 0 ? clamp(netMove / pathLength * 100) : 100;
  const wickRatio = mean(currentCandles.slice(1).map((candle) => {
    const range = candle.high - candle.low;
    return range > 0 ? clamp((range - Math.abs(candle.close - candle.open)) / range * 100) : 0;
  }));

  const sigmaScore = clamp(Math.max(0, sigmaZ) / 2 * 100);
  const score = sigmaScore * SIGMA_WEIGHT
    + reversalRate * REVERSAL_WEIGHT
    + (100 - efficiency) * INEFFICIENCY_WEIGHT
    + wickRatio * WICK_WEIGHT;
  return {
    score: Math.round(clamp(score)), sigmaZ, sigmaRatio,
    currentSigmaBps, baselineSigmaBps, reversalRate: Math.round(reversalRate), reversals,
    efficiency: Math.round(efficiency), wickRatio: Math.round(wickRatio), bars: window.length, sufficient: true,
  };
}

export function clearOneMinuteNoiseCache(): void {
  CACHE.clear();
}

export async function fetchOneMinuteNoise(assetId: number, options: {
  now?: Date;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
} = {}): Promise<OneMinuteNoiseAssessment> {
  const now = options.now ?? new Date();
  const cached = options.fetcher ? undefined : CACHE.get(assetId);
  if (cached && cached.expiresAt > now.getTime()) return cached.value;
  const result = await fetchBubingaCandles({
    assetId, timeframe: "1m",
    from: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(), to: now.toISOString(),
    fetcher: options.fetcher, signal: options.signal,
  });
  const confirmed = result.candles.filter((candle) => Date.parse(candle.time) + 60_000 <= now.getTime());
  const value = assessOneMinuteNoise(confirmed);
  if (!options.fetcher) {
    const expiresAt = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
    CACHE.set(assetId, { expiresAt, value });
  }
  return value;
}
