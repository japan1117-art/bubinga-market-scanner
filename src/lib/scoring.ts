import { ao, ema, rsi, stochastic } from "./indicators.ts";
import type { Candle, Candidate, Direction, Phase } from "./types.ts";

const MULTIPLIER: Record<Phase, number> = { early: 0.7, optimal: 1, late: 0.55, none: 0 };

export function maGate(candles: Candle[], direction: Direction): boolean {
  const closes = candles.map((c) => c.close); const e20 = ema(closes, 20); const e50 = ema(closes, 50);
  if (e20.length < 3 || !e50.length) return false;
  const [a, b, c] = e20.slice(-3); const price = closes.at(-1)!;
  return direction === "BULL" ? c > b && b > a && price > c && c > e50.at(-1)! : c < b && b < a && price < c && c < e50.at(-1)!;
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

export function scoreAsset(asset: { id: number; name: string; payout: number }, candles30m: Candle[], candles1h: Candle[], direction: Direction): Candidate | null {
  const ma30m = maGate(candles30m, direction); const ma1h = maGate(candles1h, direction);
  if (!ma30m || !ma1h) return null;
  const aoValues = ao(candles30m); const rsiValues = rsi(candles30m.map((c) => c.close)); const stoch = stochastic(candles30m);
  const phases = { ao: classifyAo(aoValues, direction), rsi: classifyRsi(rsiValues, direction), stochastic: classifyStochastic(stoch.k, stoch.d, direction) };
  const score = Math.round(35 * MULTIPLIER[phases.ao] + 30 * MULTIPLIER[phases.rsi] + 35 * MULTIPLIER[phases.stochastic]);
  return { assetId: asset.id, name: asset.name, payout: asset.payout, direction, score, ma1h, ma30m, rsi: rsiValues.at(-1) ?? 0, phases };
}
