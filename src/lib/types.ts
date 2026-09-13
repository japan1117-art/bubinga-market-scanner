export type Direction = "BULL" | "BEAR";
export type Phase = "early" | "optimal" | "late" | "none";
export interface Candle { time: string; open: number; high: number; low: number; close: number }
export interface Asset { id: number; name: string; code: string; enabled: boolean; payout: number }
export interface Candidate {
  assetId: number; name: string; payout: number; direction: Direction; score: number;
  score5m: number; score30m: number;
  ma1h: boolean; ma30m: boolean; rsi: number; phases: { ao: Phase; rsi: Phase; stochastic: Phase };
}
export interface ScanResult {
  scannedAt: string;
  source: "demo" | "bubinga";
  candidates: Candidate[];
  analyzedCount: number;
  targetCount: number;
  warnings: string[];
}
