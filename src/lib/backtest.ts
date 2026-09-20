import { classifyOpportunity, type Opportunity } from "./candidate-selection.ts";
import { scoreAsset } from "./scoring.ts";
import type { Asset, Candle, Candidate, Direction, Phase } from "./types.ts";

export interface BacktestSeries {
  asset: Asset;
  candles5m: Candle[];
  candles30m: Candle[];
  candles1h: Candle[];
}

export interface BacktestConfig {
  expiryMinutes: number;
  soonWindowMinutes?: number;
  payoutRatio?: number;
  requireMaGate?: boolean;
  signalCooldownMinutes?: number;
}

export type TradeOutcome = "WIN" | "LOSS" | "PUSH" | "NO_EXIT";

export interface BacktestSignal {
  assetId: number;
  assetName: string;
  evaluatedAt: string;
  direction: Direction;
  opportunity: Exclude<Opportunity, "HIDDEN">;
  candidate: Candidate;
  entry: number;
  exit: number | null;
  outcome: TradeOutcome;
  pnlPerUnit: number;
  becameNowWithinWindow: boolean;
  minutesToNow: number | null;
}

export interface BacktestSegmentStats {
  signals: number;
  settled: number;
  wins: number;
  losses: number;
  winRate: number | null;
  expectedValuePerSignal: number | null;
}

export type NoiseBand = "STABLE" | "NORMAL" | "UNSTABLE" | "CHOPPY" | "UNKNOWN";

export interface BacktestSegments {
  shortNoise: Record<NoiseBand, BacktestSegmentStats>;
  mediumNoise: Record<NoiseBand, BacktestSegmentStats>;
  earlyPresence: Record<"WITH_EARLY" | "WITHOUT_EARLY", BacktestSegmentStats>;
  maAlignment: Record<"BOTH_ALIGNED" | "NOT_ALIGNED", BacktestSegmentStats>;
  payout: Record<PayoutBand, BacktestSegmentStats>;
  indicatorPhase: Record<Timeframe, Record<Indicator, Record<Phase, BacktestSegmentStats>>>;
}

export type Timeframe = "1H" | "30M" | "5M";
export type Indicator = "AO" | "RSI" | "STOCHASTIC";
export type PayoutBand = "BELOW_80" | "80_TO_89" | "90_PLUS" | "UNKNOWN";

export interface BacktestSummary {
  totalSignals: number;
  settledSignals: number;
  nowSignals: number;
  soonSignals: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number | null;
  pnlPerUnit: number;
  expectedValuePerSignal: number | null;
  soonToNowCount: number;
  soonToNowRate: number | null;
  averageMinutesToNow: number | null;
  segments: BacktestSegments;
}

export interface BacktestResult {
  config: Required<BacktestConfig>;
  signals: BacktestSignal[];
  summary: BacktestSummary;
}

function timestamp(candle: Candle): number {
  return Date.parse(candle.time);
}

export function candlesThrough(candles: Candle[], evaluatedAt: number): Candle[] {
  return candles.filter((candle) => timestamp(candle) <= evaluatedAt);
}

export function confirmedCandlesThrough(candles: Candle[], evaluatedAt: number, timeframeMinutes: number): Candle[] {
  const interval = timeframeMinutes * 60_000;
  return candles.filter((candle) => timestamp(candle) + interval <= evaluatedAt);
}

export function evaluateOutcome(entry: number, exit: number | null, direction: Direction): TradeOutcome {
  if (exit === null) return "NO_EXIT";
  if (exit === entry) return "PUSH";
  const movedInDirection = direction === "BULL" ? exit > entry : exit < entry;
  return movedInDirection ? "WIN" : "LOSS";
}

export function noiseBand(score: number, sufficient = true): NoiseBand {
  if (!sufficient || !Number.isFinite(score)) return "UNKNOWN";
  if (score >= 70) return "CHOPPY";
  if (score >= 50) return "UNSTABLE";
  if (score >= 30) return "NORMAL";
  return "STABLE";
}

function pnl(outcome: TradeOutcome, payoutRatio: number): number {
  if (outcome === "WIN") return payoutRatio;
  if (outcome === "LOSS") return -1;
  return 0;
}

function segmentStats(signals: BacktestSignal[]): BacktestSegmentStats {
  const settled = signals.filter((signal) => signal.outcome !== "NO_EXIT");
  const wins = settled.filter((signal) => signal.outcome === "WIN").length;
  const losses = settled.filter((signal) => signal.outcome === "LOSS").length;
  const decisive = wins + losses;
  const totalPnl = settled.reduce((sum, signal) => sum + signal.pnlPerUnit, 0);
  return {
    signals: signals.length,
    settled: settled.length,
    wins,
    losses,
    winRate: decisive ? wins / decisive : null,
    expectedValuePerSignal: settled.length ? totalPnl / settled.length : null,
  };
}

function hasEarlyPhase(signal: BacktestSignal): boolean {
  return [signal.candidate.breakdown1h, signal.candidate.breakdown30m, signal.candidate.breakdown5m]
    .some((breakdown) => Object.values(breakdown.phases).includes("early"));
}

function payoutBand(payout: number): PayoutBand {
  if (!Number.isFinite(payout)) return "UNKNOWN";
  if (payout >= 90) return "90_PLUS";
  if (payout >= 80) return "80_TO_89";
  return "BELOW_80";
}

function indicatorPhaseSegments(signals: BacktestSignal[]): BacktestSegments["indicatorPhase"] {
  const phases = ["early", "optimal", "late", "none"] as const;
  const breakdown = (signal: BacktestSignal, timeframe: Timeframe) => {
    if (timeframe === "1H") return signal.candidate.breakdown1h;
    if (timeframe === "30M") return signal.candidate.breakdown30m;
    return signal.candidate.breakdown5m;
  };
  const select = (signal: BacktestSignal, timeframe: Timeframe, indicator: Indicator): Phase => {
    const selected = breakdown(signal, timeframe).phases;
    if (indicator === "AO") return selected.ao;
    if (indicator === "RSI") return selected.rsi;
    return selected.stochastic;
  };
  return Object.fromEntries((["1H", "30M", "5M"] as const).map((timeframe) => [
    timeframe,
    Object.fromEntries((["AO", "RSI", "STOCHASTIC"] as const).map((indicator) => [
      indicator,
      groupSegments(signals, phases, (signal) => select(signal, timeframe, indicator)),
    ])),
  ])) as BacktestSegments["indicatorPhase"];
}

function groupSegments<K extends string>(signals: BacktestSignal[], keys: readonly K[], select: (signal: BacktestSignal) => K): Record<K, BacktestSegmentStats> {
  return Object.fromEntries(keys.map((key) => [key, segmentStats(signals.filter((signal) => select(signal) === key))])) as Record<K, BacktestSegmentStats>;
}

export function summarizeBacktest(signals: BacktestSignal[]): BacktestSummary {
  const settled = signals.filter((signal) => signal.outcome !== "NO_EXIT");
  const wins = settled.filter((signal) => signal.outcome === "WIN").length;
  const losses = settled.filter((signal) => signal.outcome === "LOSS").length;
  const pushes = settled.filter((signal) => signal.outcome === "PUSH").length;
  const decisive = wins + losses;
  const soon = signals.filter((signal) => signal.opportunity === "SOON");
  const convertedSoon = soon.filter((signal) => signal.minutesToNow !== null);
  const pnlPerUnit = settled.reduce((sum, signal) => sum + signal.pnlPerUnit, 0);
  return {
    totalSignals: signals.length,
    settledSignals: settled.length,
    nowSignals: signals.filter((signal) => signal.opportunity === "NOW").length,
    soonSignals: soon.length,
    wins,
    losses,
    pushes,
    winRate: decisive ? wins / decisive : null,
    pnlPerUnit,
    expectedValuePerSignal: settled.length ? pnlPerUnit / settled.length : null,
    soonToNowCount: soon.filter((signal) => signal.becameNowWithinWindow).length,
    soonToNowRate: soon.length ? soon.filter((signal) => signal.becameNowWithinWindow).length / soon.length : null,
    averageMinutesToNow: convertedSoon.length
      ? convertedSoon.reduce((sum, signal) => sum + signal.minutesToNow!, 0) / convertedSoon.length
      : null,
    segments: {
      shortNoise: groupSegments(signals, ["STABLE", "NORMAL", "UNSTABLE", "CHOPPY", "UNKNOWN"] as const, (signal) => noiseBand(signal.candidate.noiseShort.score, signal.candidate.noiseShort.sufficient)),
      mediumNoise: groupSegments(signals, ["STABLE", "NORMAL", "UNSTABLE", "CHOPPY", "UNKNOWN"] as const, (signal) => noiseBand(signal.candidate.noiseMedium.score, signal.candidate.noiseMedium.sufficient)),
      earlyPresence: groupSegments(signals, ["WITH_EARLY", "WITHOUT_EARLY"] as const, (signal) => hasEarlyPhase(signal) ? "WITH_EARLY" : "WITHOUT_EARLY"),
      maAlignment: groupSegments(signals, ["BOTH_ALIGNED", "NOT_ALIGNED"] as const, (signal) => signal.candidate.ma1h && signal.candidate.ma30m ? "BOTH_ALIGNED" : "NOT_ALIGNED"),
      payout: groupSegments(signals, ["BELOW_80", "80_TO_89", "90_PLUS", "UNKNOWN"] as const, (signal) => payoutBand(signal.candidate.payout)),
      indicatorPhase: indicatorPhaseSegments(signals),
    },
  };
}

export function runBacktest(series: BacktestSeries[], direction: Direction, config: BacktestConfig): BacktestResult {
  if (!Number.isFinite(config.expiryMinutes) || config.expiryMinutes <= 0) throw new Error("expiryMinutes must be positive.");
  const resolved = {
    expiryMinutes: config.expiryMinutes,
    soonWindowMinutes: config.soonWindowMinutes ?? 30,
    payoutRatio: config.payoutRatio ?? 0.9,
    requireMaGate: config.requireMaGate ?? true,
    signalCooldownMinutes: config.signalCooldownMinutes ?? 0,
  };
  const signals: BacktestSignal[] = [];

  for (const item of series) {
    const ordered5m = item.candles5m.toSorted((a, b) => timestamp(a) - timestamp(b));
    let nextEligibleAt = Number.NEGATIVE_INFINITY;
    for (const current of ordered5m) {
      const evaluatedAt = timestamp(current) + 5 * 60_000;
      if (evaluatedAt < nextEligibleAt) continue;
      const candidate = scoreAsset(
        item.asset,
        confirmedCandlesThrough(ordered5m, evaluatedAt, 5),
        confirmedCandlesThrough(item.candles30m, evaluatedAt, 30),
        confirmedCandlesThrough(item.candles1h, evaluatedAt, 60),
        direction,
        { requireMaGate: resolved.requireMaGate },
      );
      if (!candidate) continue;
      const opportunity = classifyOpportunity(candidate.score);
      if (opportunity === "HIDDEN") continue;
      const exitAt = evaluatedAt + resolved.expiryMinutes * 60_000;
      const exitCandle = ordered5m.find((candle) => timestamp(candle) + 5 * 60_000 >= exitAt);
      const outcome = evaluateOutcome(current.close, exitCandle?.close ?? null, direction);
      signals.push({
        assetId: item.asset.id,
        assetName: item.asset.name,
        evaluatedAt: new Date(evaluatedAt).toISOString(),
        direction,
        opportunity,
        candidate,
        entry: current.close,
        exit: exitCandle?.close ?? null,
        outcome,
        pnlPerUnit: pnl(outcome, resolved.payoutRatio),
        becameNowWithinWindow: false,
        minutesToNow: null,
      });
      nextEligibleAt = evaluatedAt + resolved.signalCooldownMinutes * 60_000;
    }
  }

  for (const signal of signals) {
    if (signal.opportunity !== "SOON") continue;
    const start = Date.parse(signal.evaluatedAt);
    const end = start + resolved.soonWindowMinutes * 60_000;
    const nextNow = signals.find((future) =>
      future.assetId === signal.assetId &&
      future.direction === signal.direction &&
      future.opportunity === "NOW" &&
      Date.parse(future.evaluatedAt) > start &&
      Date.parse(future.evaluatedAt) <= end,
    );
    signal.becameNowWithinWindow = Boolean(nextNow);
    signal.minutesToNow = nextNow ? (Date.parse(nextNow.evaluatedAt) - start) / 60_000 : null;
  }
  return { config: resolved, signals, summary: summarizeBacktest(signals) };
}
