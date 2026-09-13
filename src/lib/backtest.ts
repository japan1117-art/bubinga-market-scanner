import { classifyOpportunity, type Opportunity } from "./candidate-selection.ts";
import { scoreAsset } from "./scoring.ts";
import type { Asset, Candle, Candidate, Direction } from "./types.ts";

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
}

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

export function evaluateOutcome(entry: number, exit: number | null, direction: Direction): TradeOutcome {
  if (exit === null) return "NO_EXIT";
  if (exit === entry) return "PUSH";
  const movedInDirection = direction === "BULL" ? exit > entry : exit < entry;
  return movedInDirection ? "WIN" : "LOSS";
}

function pnl(outcome: TradeOutcome, payoutRatio: number): number {
  if (outcome === "WIN") return payoutRatio;
  if (outcome === "LOSS") return -1;
  return 0;
}

export function summarizeBacktest(signals: BacktestSignal[]): BacktestSummary {
  const settled = signals.filter((signal) => signal.outcome !== "NO_EXIT");
  const wins = settled.filter((signal) => signal.outcome === "WIN").length;
  const losses = settled.filter((signal) => signal.outcome === "LOSS").length;
  const pushes = settled.filter((signal) => signal.outcome === "PUSH").length;
  const decisive = wins + losses;
  const soon = signals.filter((signal) => signal.opportunity === "SOON");
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
  };
}

export function runBacktest(series: BacktestSeries[], direction: Direction, config: BacktestConfig): BacktestResult {
  if (!Number.isFinite(config.expiryMinutes) || config.expiryMinutes <= 0) throw new Error("expiryMinutes must be positive.");
  const resolved = {
    expiryMinutes: config.expiryMinutes,
    soonWindowMinutes: config.soonWindowMinutes ?? 30,
    payoutRatio: config.payoutRatio ?? 0.9,
  };
  const signals: BacktestSignal[] = [];

  for (const item of series) {
    const ordered5m = item.candles5m.toSorted((a, b) => timestamp(a) - timestamp(b));
    for (const current of ordered5m) {
      const evaluatedAt = timestamp(current);
      const candidate = scoreAsset(
        item.asset,
        candlesThrough(ordered5m, evaluatedAt),
        candlesThrough(item.candles30m, evaluatedAt),
        candlesThrough(item.candles1h, evaluatedAt),
        direction,
      );
      if (!candidate) continue;
      const opportunity = classifyOpportunity(candidate.score);
      if (opportunity === "HIDDEN") continue;
      const exitAt = evaluatedAt + resolved.expiryMinutes * 60_000;
      const exitCandle = ordered5m.find((candle) => timestamp(candle) >= exitAt);
      const outcome = evaluateOutcome(current.close, exitCandle?.close ?? null, direction);
      signals.push({
        assetId: item.asset.id,
        assetName: item.asset.name,
        evaluatedAt: current.time,
        direction,
        opportunity,
        candidate,
        entry: current.close,
        exit: exitCandle?.close ?? null,
        outcome,
        pnlPerUnit: pnl(outcome, resolved.payoutRatio),
        becameNowWithinWindow: false,
      });
    }
  }

  for (const signal of signals) {
    if (signal.opportunity !== "SOON") continue;
    const start = Date.parse(signal.evaluatedAt);
    const end = start + resolved.soonWindowMinutes * 60_000;
    signal.becameNowWithinWindow = signals.some((future) =>
      future.assetId === signal.assetId &&
      future.direction === signal.direction &&
      future.opportunity === "NOW" &&
      Date.parse(future.evaluatedAt) > start &&
      Date.parse(future.evaluatedAt) <= end,
    );
  }
  return { config: resolved, signals, summary: summarizeBacktest(signals) };
}
