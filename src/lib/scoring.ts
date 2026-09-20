import { ao, ema, rsi, stochastic } from "./indicators.ts";
import { assessMarketNoise } from "./market-noise.ts";
import type { Candle, Candidate, Direction, IndicatorBreakdown, Phase } from "./types.ts";

export const EARLY_TIMING_ADVANCE = 0.3;
export const EARLY_MULTIPLIER = 0.7 + (1 - 0.7) * EARLY_TIMING_ADVANCE;
const MULTIPLIER: Record<Phase, number> = { early: EARLY_MULTIPLIER, optimal: 1, late: 0.55, none: 0 };

export interface MaGateConfig {
  fastPeriod: number;
  slowPeriod: number;
  slopePoints: number;
  requirePriceSide: boolean;
  requireFastSlowAlignment: boolean;
}

export const DEFAULT_MA_GATE_CONFIG: Readonly<MaGateConfig> = Object.freeze({
  fastPeriod: 20,
  slowPeriod: 50,
  slopePoints: 3,
  requirePriceSide: true,
  requireFastSlowAlignment: true,
});

export function maGate(candles: Candle[], direction: Direction, overrides: Partial<MaGateConfig> = {}): boolean {
  const config = { ...DEFAULT_MA_GATE_CONFIG, ...overrides };
  if (config.fastPeriod < 1 || config.slowPeriod < 1 || config.slopePoints < 2) return false;

  const closes = candles.map((c) => c.close);
  const fast = ema(closes, config.fastPeriod);
  const slow = ema(closes, config.slowPeriod);
  if (fast.length < config.slopePoints || (config.requireFastSlowAlignment && !slow.length)) return false;

  const recent = fast.slice(-config.slopePoints);
  const slopeAligned = recent.slice(1).every((value, index) =>
    direction === "BULL" ? value > recent[index] : value < recent[index],
  );
  if (!slopeAligned) return false;

  const currentFast = fast.at(-1)!;
  if (config.requirePriceSide) {
    const priceAligned = direction === "BULL" ? closes.at(-1)! > currentFast : closes.at(-1)! < currentFast;
    if (!priceAligned) return false;
  }
  if (config.requireFastSlowAlignment) {
    const averagesAligned = direction === "BULL" ? currentFast > slow.at(-1)! : currentFast < slow.at(-1)!;
    if (!averagesAligned) return false;
  }
  return true;
}

export function classifyAo(values: number[], direction: Direction): Phase {
  const [a, b, c, d] = values.slice(-4);
  if ([a, b, c, d].some(Number.isNaN) || d === undefined) return "none";
  const move = direction === "BULL" ? (x: number, y: number) => y - x : (x: number, y: number) => x - y;
  const gains = [move(a, b), move(b, c), move(c, d)]; const directional = gains[2] > 0;
  const beyondZero = direction === "BULL" ? d > 0 : d < 0;
  if (!directional) return "none";
  if (!beyondZero) return "early";
  if (gains.every((g) => g > 0) && gains[2] >= gains[1] * 0.55) return "optimal";
  return "late";
}

export function classifyRsi(values: number[], direction: Direction): Phase {
  const current = values.at(-1); const previous = values.at(-2);
  if (current === undefined || previous === undefined) return "none";
  if (direction === "BULL") {
    if (current >= 42 && current < 50 && current > previous) return "early";
    if (current >= 50 && current <= 65) return "optimal";
    if (current > 65 && current <= 72) return "late";
  } else {
    if (current > 50 && current <= 58 && current < previous) return "early";
    if (current >= 35 && current <= 50) return "optimal";
    if (current >= 28 && current < 35) return "late";
  }
  return "none";
}

export function classifyStochastic(k: number[], d: number[], direction: Direction): Phase {
  const kc = k.at(-1); const kp = k.at(-2); const dc = d.at(-1); const dp = d.at(-2);
  if ([kc, kp, dc, dp].some((v) => v === undefined)) return "none";
  if (direction === "BULL") {
    if ((kc! < dc! && kc! > kp! && kc! - dc! > kp! - dp!) || (kc! <= 20 && kc! > kp!)) return "early";
    if (kc! > dc! && kc! >= 20 && kc! <= 70) return "optimal";
    if (kc! > dc! && kc! > 70) return "late";
  } else {
    if ((kc! > dc! && kc! < kp! && kc! - dc! < kp! - dp!) || (kc! >= 80 && kc! < kp!)) return "early";
    if (kc! < dc! && kc! >= 30 && kc! <= 80) return "optimal";
    if (kc! < dc! && kc! < 30) return "late";
  }
  return "none";
}

export interface IndicatorScore {
  score: number;
  rsi: number;
  phases: { ao: Phase; rsi: Phase; stochastic: Phase };
  points: { ao: number; rsi: number; stochastic: number };
}

export interface ScoreAssetOptions {
  requireMaGate?: boolean;
}

function rawIndicatorPhases(candles: Candle[], direction: Direction) {
  const aoValues = ao(candles);
  const rsiValues = rsi(candles.map((c) => c.close));
  const stoch = stochastic(candles);
  return {
    rsiValue: rsiValues.at(-1) ?? 0,
    aoValues,
    stoch,
    phases: {
    ao: classifyAo(aoValues, direction),
    rsi: classifyRsi(rsiValues, direction),
    stochastic: classifyStochastic(stoch.k, stoch.d, direction),
    },
  };
}

function bestPhase(phases: Phase[]): Phase {
  return phases.reduce((best, phase) => MULTIPLIER[phase] > MULTIPLIER[best] ? phase : best, "none");
}

function aoReversing(values: number[], direction: Direction): boolean {
  const [a, b, c] = values.slice(-3);
  if ([a, b, c].some((value) => value === undefined)) return false;
  return direction === "BULL" ? b < a && c < b : b > a && c > b;
}

function recentOppositeStochCross(k: number[], d: number[], direction: Direction): boolean {
  const recentK = k.slice(-3); const recentD = d.slice(-3);
  if (recentK.length < 3 || recentD.length < 3) return false;
  const aligned = (index: number) => direction === "BULL" ? recentK[index] > recentD[index] : recentK[index] < recentD[index];
  return !aligned(2) && (aligned(1) || aligned(0));
}

export function hasStrongAdverseReversal(candles: Candle[], direction: Direction): boolean {
  const raw = rawIndicatorPhases(candles, direction);
  return aoReversing(raw.aoValues, direction) && recentOppositeStochCross(raw.stoch.k, raw.stoch.d, direction);
}

export function scoreIndicators(candles: Candle[], direction: Direction, persistenceBars = 1): IndicatorScore {
  const current = rawIndicatorPhases(candles, direction);
  const phases = { ...current.phases };
  if (persistenceBars > 1) {
    const recent = Array.from({ length: Math.min(persistenceBars, candles.length) }, (_, offset) =>
      rawIndicatorPhases(candles.slice(0, candles.length - offset), direction).phases,
    );
    phases.ao = aoReversing(current.aoValues, direction) ? "none" : bestPhase(recent.map((item) => item.ao));
    phases.stochastic = recentOppositeStochCross(current.stoch.k, current.stoch.d, direction)
      ? "none" : bestPhase(recent.map((item) => item.stochastic));
  }
  const points = {
    ao: 35 * MULTIPLIER[phases.ao],
    rsi: 30 * MULTIPLIER[phases.rsi],
    stochastic: 35 * MULTIPLIER[phases.stochastic],
  };
  const score = points.ao + points.rsi + points.stochastic;
  return { score, rsi: current.rsiValue, phases, points };
}

export function combineTimeframeScores(score1h: number, score30m: number, score5m: number): number {
  return Math.round(score1h * 0.6 + score30m * 0.3 + score5m * 0.1);
}

function breakdown(result: IndicatorScore): IndicatorBreakdown {
  return { ...result.points, phases: result.phases, rsiValue: result.rsi };
}

export function scoreAsset(
  asset: { id: number; name: string; payout: number },
  candles5m: Candle[],
  candles30m: Candle[],
  candles1h: Candle[],
  direction: Direction,
  options: ScoreAssetOptions = {},
): Candidate | null {
  const ma30m = maGate(candles30m, direction); const ma1h = maGate(candles1h, direction);
  if ((options.requireMaGate ?? true) && (!ma30m || !ma1h)) return null;
  const adverse1h = hasStrongAdverseReversal(candles1h, direction);
  const adverse30m = hasStrongAdverseReversal(candles30m, direction);
  if (adverse1h && adverse30m) return null;
  const h1 = scoreIndicators(candles1h, direction, 4);
  const m30 = scoreIndicators(candles30m, direction);
  const m5 = scoreIndicators(candles5m, direction);
  const weightedScore = combineTimeframeScores(h1.score, m30.score, m5.score);
  const score = adverse30m || hasStrongAdverseReversal(candles5m, direction) ? Math.min(weightedScore, 79) : weightedScore;
  return {
    assetId: asset.id, name: asset.name, payout: asset.payout, direction,
    score,
    score5m: Math.round(m5.score), score30m: Math.round(m30.score), score1h: Math.round(h1.score),
    ma1h, ma30m, rsi: m5.rsi, phases: m5.phases,
    rsi30m: m30.rsi, phases30m: m30.phases,
    rsi1h: h1.rsi, phases1h: h1.phases,
    breakdown5m: breakdown(m5), breakdown30m: breakdown(m30), breakdown1h: breakdown(h1),
    noiseShort: assessMarketNoise(candles5m, direction, 6),
    noiseMedium: assessMarketNoise(candles5m, direction, 12),
  };
}
