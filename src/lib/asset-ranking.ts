import type { Asset } from "./types.ts";

export interface RankingOptions {
  limit?: number;
  minimumPayout?: number;
}

/**
 * Selects currently enabled assets and returns a deterministic payout ranking.
 * The input is never mutated.
 */
export function rankTradableAssets(
  assets: Asset[],
  { limit = 20, minimumPayout = 0 }: RankingOptions = {},
): Asset[] {
  const safeLimit = Math.max(0, Math.min(250, Math.trunc(limit)));

  return assets
    .filter((asset) =>
      asset.enabled &&
      Number.isFinite(asset.payout) &&
      asset.payout >= minimumPayout,
    )
    .toSorted((left, right) =>
      right.payout - left.payout ||
      left.code.localeCompare(right.code, "en") ||
      left.id - right.id,
    )
    .slice(0, safeLimit);
}
