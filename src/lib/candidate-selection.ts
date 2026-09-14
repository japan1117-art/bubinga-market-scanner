import type { Candidate } from "./types.ts";

export type Opportunity = "NOW" | "SOON" | "HIDDEN";

export function classifyOpportunity(score: number): Opportunity {
  if (!Number.isFinite(score) || score < 60) return "HIDDEN";
  return score >= 80 ? "NOW" : "SOON";
}

export function selectTopCandidates(candidates: Candidate[], limit = 5): Candidate[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return candidates
    .filter((candidate) => classifyOpportunity(candidate.score) !== "HIDDEN")
    .toSorted((left, right) =>
      right.score - left.score ||
      right.score1h - left.score1h ||
      right.score30m - left.score30m ||
      right.score5m - left.score5m ||
      right.payout - left.payout ||
      left.name.localeCompare(right.name, "ja"),
    )
    .slice(0, safeLimit);
}
