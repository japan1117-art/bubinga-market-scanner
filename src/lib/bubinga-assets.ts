import type { Asset } from "./types.ts";

const ASSETS_URL = "https://api.bubinga.com/api/v1/assets";

type UnknownRecord = Record<string, unknown>;

export class BubingaDataError extends Error {
  readonly code: "NETWORK" | "HTTP" | "INVALID_RESPONSE";

  constructor(message: string, code: "NETWORK" | "HTTP" | "INVALID_RESPONSE") {
    super(message);
    this.name = "BubingaDataError";
    this.code = code;
  }
}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function currentProfitability(raw: UnknownRecord): number | null {
  const profitability = record(raw.profitability);
  const binary = record(profitability?.binary);
  const turbo = record(profitability?.turbo);
  const candidates = [binary, turbo]
    .filter((product) => product?.enabled === true)
    .map((product) => product?.current);
  let highest: number | null = null;
  for (const value of candidates) {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(numeric) && numeric >= 0) {
      const percent = numeric <= 1 ? numeric * 100 : numeric;
      highest = highest === null ? percent : Math.max(highest, percent);
    }
  }
  return highest;
}

export function normalizeAsset(raw: unknown): Asset | null {
  const value = record(raw);
  if (!value) return null;
  const id = typeof value.id === "number" ? value.id : Number(value.id);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const payout = currentProfitability(value);
  if (!Number.isInteger(id) || id <= 0 || !name || !code || payout === null) return null;
  return { id, name, code, enabled: value.enabled === true, payout };
}

export function normalizeAssetsResponse(payload: unknown): Asset[] {
  const root = record(payload);
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(root?.items)
        ? root.items
        : null;
  if (!source) throw new BubingaDataError("Assets response does not contain an asset array.", "INVALID_RESPONSE");

  const seen = new Set<number>();
  return source.flatMap((item) => {
    const asset = normalizeAsset(item);
    if (!asset || seen.has(asset.id)) return [];
    seen.add(asset.id);
    return [asset];
  });
}

export async function fetchBubingaAssets(options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<Asset[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  const url = new URL(ASSETS_URL);
  url.searchParams.set("pagination[limit]", "250");
  url.searchParams.set("pagination[offset]", "0");

  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) throw new BubingaDataError(`Assets API returned HTTP ${response.status}.`, "HTTP");
    return normalizeAssetsResponse(await response.json());
  } catch (error) {
    if (error instanceof BubingaDataError) throw error;
    throw new BubingaDataError(error instanceof Error ? error.message : "Assets API request failed.", "NETWORK");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
