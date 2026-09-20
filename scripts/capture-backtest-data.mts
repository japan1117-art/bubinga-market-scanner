import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rankTradableAssets } from "../src/lib/asset-ranking.ts";
import { fetchBubingaAssets } from "../src/lib/bubinga-assets.ts";
import { fetchBubingaCandles, type SupportedTimeframe } from "../src/lib/bubinga-candles.ts";
import { BACKTEST_DATASET_VERSION, type BacktestDataset } from "../src/lib/backtest-dataset.ts";
import type { Candle } from "../src/lib/types.ts";

const CHUNK_MS: Record<SupportedTimeframe, number> = {
  "5m": 18 * 60 * 60_000,
  "30m": 3 * 24 * 60 * 60_000,
  "1h": 5 * 24 * 60 * 60_000,
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const from = argument("from"); const to = argument("to");
const requested = argument("assets")?.split(",").map(Number).filter(Number.isInteger) ?? [];
const output = resolve(argument("out") ?? "data/backtests/bubinga-snapshot.json");
if (!from || !to || Date.parse(from) >= Date.parse(to) || !requested.length || requested.length > 20) {
  throw new Error("Usage: pnpm backtest:capture -- --from ISO --to ISO --assets 49,50 [--out path]. Maximum 20 assets.");
}

const assets = await fetchBubingaAssets();
const selected = rankTradableAssets(assets, { limit: 250 }).filter((item) => requested.includes(item.id));
if (selected.length !== new Set(requested).size) throw new Error("One or more requested assets are unavailable or not tradable.");

let candleRequests = 0;
const timeframe = async (assetId: number, value: SupportedTimeframe): Promise<Candle[]> => {
  const byTime = new Map<string, Candle>();
  const end = Date.parse(to);
  for (let cursor = Date.parse(from); cursor < end; cursor += CHUNK_MS[value]) {
    const chunkTo = Math.min(cursor + CHUNK_MS[value], end);
    candleRequests += 1;
    const result = await fetchBubingaCandles({
      assetId, timeframe: value,
      from: new Date(cursor).toISOString(), to: new Date(chunkTo).toISOString(),
    });
    for (const candle of result.candles) byTime.set(candle.time, candle);
  }
  return [...byTime.values()].toSorted((left, right) => Date.parse(left.time) - Date.parse(right.time));
};
const series = [];
for (const asset of selected) {
  const candles5m = await timeframe(asset.id, "5m");
  const candles30m = await timeframe(asset.id, "30m");
  const candles1h = await timeframe(asset.id, "1h");
  series.push({ asset, candles5m, candles30m, candles1h });
}
const dataset: BacktestDataset = {
  version: BACKTEST_DATASET_VERSION, capturedAt: new Date().toISOString(),
  from: new Date(from).toISOString(), to: new Date(to).toISOString(),
  source: "bubinga-unauthenticated", series,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, assets: series.length, requests: 1 + candleRequests,
  candles: series.map((item) => ({ assetId: item.asset.id, m5: item.candles5m.length, m30: item.candles30m.length, h1: item.candles1h.length })) }));
