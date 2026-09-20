export type Direction = "BULL" | "BEAR";
export type Phase = "early" | "optimal" | "late" | "none";
export interface Candle { time: string; open: number; high: number; low: number; close: number }
export interface Asset { id: number; name: string; code: string; enabled: boolean; payout: number }
export interface IndicatorBreakdown {
  ao: number; rsi: number; stochastic: number;
  phases: { ao: Phase; rsi: Phase; stochastic: Phase };
  rsiValue: number;
}
export interface NoiseAssessment {
  score: number; reversals: number; efficiency: number; failedMoves: number;
  rangePercent: number; bars: 6 | 12; sufficient: boolean;
}
export interface Candidate {
  assetId: number; name: string; payout: number; direction: Direction; score: number;
  score5m: number; score30m: number; score1h: number;
  ma1h: boolean; ma30m: boolean; rsi: number; phases: { ao: Phase; rsi: Phase; stochastic: Phase };
  rsi30m: number; phases30m: { ao: Phase; rsi: Phase; stochastic: Phase };
  rsi1h: number; phases1h: { ao: Phase; rsi: Phase; stochastic: Phase };
  breakdown5m: IndicatorBreakdown; breakdown30m: IndicatorBreakdown; breakdown1h: IndicatorBreakdown;
  noiseShort: NoiseAssessment; noiseMedium: NoiseAssessment;
}
export interface ScanResult {
  scannedAt: string;
  source: "demo" | "bubinga";
  candidates: Candidate[];
  analyzedCount: number;
  targetCount: number;
  warnings: string[];
}
