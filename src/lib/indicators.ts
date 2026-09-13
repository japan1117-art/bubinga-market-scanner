import type { Candle } from "./types.ts";

export function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const multiplier = 2 / (period + 1);
  const output = [seed];
  for (const value of values.slice(period)) output.push((value - output.at(-1)!) * multiplier + output.at(-1)!);
  return output;
}

export function sma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const output: number[] = [];
  for (let i = period; i <= values.length; i++) output.push(values.slice(i - period, i).reduce((a, b) => a + b, 0) / period);
  return output;
}

export function ao(candles: Candle[]): number[] {
  const median = candles.map((c) => (c.high + c.low) / 2);
  const fast = sma(median, 5); const slow = sma(median, 34); const offset = fast.length - slow.length;
  return slow.map((value, index) => fast[index + offset] - value);
}

export function rsi(closes: number[], period = 14): number[] {
  if (closes.length <= period) return [];
  const changes = closes.slice(1).map((v, i) => v - closes[i]);
  let gain = changes.slice(0, period).reduce((sum, v) => sum + Math.max(v, 0), 0) / period;
  let loss = changes.slice(0, period).reduce((sum, v) => sum + Math.max(-v, 0), 0) / period;
  const result = [loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)];
  for (const change of changes.slice(period)) {
    gain = (gain * (period - 1) + Math.max(change, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    result.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  }
  return result;
}

export function stochastic(candles: Candle[], period = 14, smoothD = 3): { k: number[]; d: number[] } {
  const k: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high)); const low = Math.min(...window.map((c) => c.low));
    k.push(high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100);
  }
  return { k, d: sma(k, smoothD) };
}
