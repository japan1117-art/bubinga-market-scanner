import { scoreAsset } from "./scoring.ts";
import type { Candle, Direction, ScanResult } from "./types.ts";

const names = ["GSMI", "LATAM", "ASIA", "BITCOIN OTC", "EUR/USD", "GOLD OTC", "USD/JPY", "NASDAQ OTC"];

function candles(seed: number, direction: Direction, timeframe: number): Candle[] {
  const sign = direction === "BULL" ? 1 : -1; let price = 100 + seed * 0.1;
  return Array.from({ length: 90 }, (_, i) => {
    const trend = sign * 0.01; const wave = Math.sin(i * 0.2 + seed) * 0.08;
    const open = price; price += trend + wave;
    return { time: new Date(Date.now() - (89 - i) * timeframe * 60_000).toISOString(), open, close: price, high: Math.max(open, price) + 0.18, low: Math.min(open, price) - 0.18 };
  });
}

export function runDemoScan(direction: Direction): ScanResult {
  const profiles = direction === "BULL" ? [2, 2, 15, 15, 2, 15, 2, 15] : [18, 18, 18, 18, 18, 18, 18, 18];
  const candidates = names.map((name, index) => scoreAsset(
    { id: index + 1, name, payout: 95 - index },
    candles(profiles[(index + 1) % profiles.length], direction, 5),
    candles(profiles[index], direction, 30),
    candles(profiles[index], direction, 60),
    direction,
  ))
    .filter((v): v is NonNullable<typeof v> => Boolean(v && v.score >= 60)).sort((a, b) => b.score - a.score || b.payout - a.payout).slice(0, 5);
  return { scannedAt: new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()), source: "demo", candidates };
}
