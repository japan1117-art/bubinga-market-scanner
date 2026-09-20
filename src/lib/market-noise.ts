import type { Candle, Direction, NoiseAssessment } from "./types.ts";

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function assessMarketNoise(candles: Candle[], direction: Direction, bars: 6 | 12): NoiseAssessment {
  const window = candles.slice(-bars);
  if (window.length < bars) {
    return { score: 0, reversals: 0, efficiency: 100, failedMoves: 0, rangePercent: 0, bars, sufficient: false };
  }

  const closes = window.map((candle) => candle.close);
  const moves = closes.slice(1).map((close, index) => close - closes[index]);
  const highest = Math.max(...window.map((candle) => candle.high));
  const lowest = Math.min(...window.map((candle) => candle.low));
  const averagePrice = closes.reduce((sum, close) => sum + close, 0) / closes.length;
  const priceRange = Math.max(0, highest - lowest);
  const meaningfulThreshold = Math.max(priceRange * 0.03, Math.abs(averagePrice) * 1e-8);
  const signs = moves
    .filter((move) => Math.abs(move) >= meaningfulThreshold)
    .map((move) => Math.sign(move));

  let reversals = 0;
  for (let index = 1; index < signs.length; index += 1) {
    if (signs[index] !== signs[index - 1]) reversals += 1;
  }
  const reversalScore = signs.length > 1 ? reversals / (signs.length - 1) * 100 : 0;

  const pathLength = moves.reduce((sum, move) => sum + Math.abs(move), 0);
  const netMove = Math.abs(closes.at(-1)! - closes[0]);
  const efficiency = pathLength === 0 ? 100 : clamp(netMove / pathLength * 100);
  const inefficiencyScore = 100 - efficiency;

  let directionalAttempts = 0;
  let failedMoves = 0;
  for (let index = 0; index < moves.length - 1; index += 1) {
    const move = moves[index]; const next = moves[index + 1];
    const aligned = direction === "BULL" ? move > meaningfulThreshold : move < -meaningfulThreshold;
    if (!aligned) continue;
    directionalAttempts += 1;
    const reversed = direction === "BULL" ? next < -meaningfulThreshold : next > meaningfulThreshold;
    if (reversed && Math.abs(next) >= Math.abs(move) * 0.5) failedMoves += 1;
  }
  const failedMoveScore = directionalAttempts ? failedMoves / directionalAttempts * 100 : 0;

  const traversalRatio = priceRange > 0 ? pathLength / priceRange : 0;
  const rangeChurnScore = clamp((traversalRatio - 1) * 50);
  const score = bars === 6
    ? reversalScore * 0.4 + inefficiencyScore * 0.4 + failedMoveScore * 0.2
    : reversalScore * 0.35 + inefficiencyScore * 0.4 + failedMoveScore * 0.15 + rangeChurnScore * 0.1;

  return {
    score: Math.round(clamp(score)),
    reversals,
    efficiency: Math.round(efficiency),
    failedMoves,
    rangePercent: averagePrice === 0 ? 0 : priceRange / Math.abs(averagePrice) * 100,
    bars,
    sufficient: true,
  };
}
