import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runBacktest } from "../src/lib/backtest.ts";
import { normalizeBacktestDataset } from "../src/lib/backtest-dataset.ts";
import type { Direction } from "../src/lib/types.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const input = resolve(argument("input") ?? "data/backtests/bubinga-snapshot.json");
const output = resolve(argument("out") ?? "reports/backtests/latest.json");
const expiryMinutes = Number(argument("expiry") ?? 5);
const signalCooldownMinutes = Number(argument("cooldown") ?? expiryMinutes);
if (!Number.isFinite(expiryMinutes) || expiryMinutes <= 0) throw new Error("--expiry must be positive.");
if (!Number.isFinite(signalCooldownMinutes) || signalCooldownMinutes < 0) throw new Error("--cooldown must be zero or positive.");
const dataset = normalizeBacktestDataset(JSON.parse(await readFile(input, "utf8")));
const results = Object.fromEntries((["BULL", "BEAR"] as Direction[]).map((direction) => [direction, {
  withMaGate: runBacktest(dataset.series, direction, { expiryMinutes, signalCooldownMinutes, requireMaGate: true }).summary,
  withoutMaGate: runBacktest(dataset.series, direction, { expiryMinutes, signalCooldownMinutes, requireMaGate: false }).summary,
}]));
const report = {
  generatedAt: new Date().toISOString(), dataset: { capturedAt: dataset.capturedAt, from: dataset.from, to: dataset.to, assets: dataset.series.length },
  config: { expiryMinutes, signalCooldownMinutes }, results,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, expiryMinutes, signalCooldownMinutes, assets: dataset.series.length }));
