"use client";

import { useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Clock3, Flame, ScanSearch } from "lucide-react";
import type { Direction, ScanResult } from "@/src/lib/types";
import { runDemoScan } from "@/src/lib/demo-scan";
import { classifyOpportunity } from "@/src/lib/candidate-selection";

const EMPTY: ScanResult = { scannedAt: "", source: "demo", candidates: [] };

export default function Home() {
  const [direction, setDirection] = useState<Direction>("BULL");
  const [result, setResult] = useState<ScanResult>(EMPTY);
  const [loading, setLoading] = useState(false);

  async function scan() {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setResult(runDemoScan(direction));
    setLoading(false);
  }

  const now = result.candidates.filter((item) => classifyOpportunity(item.score) === "NOW");
  const soon = result.candidates.filter((item) => classifyOpportunity(item.score) === "SOON");

  return (
    <main className="min-h-screen bg-[#07110d] text-[#f5f8f6]">
      <div className="mx-auto min-h-screen w-full max-w-xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <header className="mb-9 flex items-center justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">Bubinga signal desk</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Market Scanner</h1>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
            <Activity size={23} aria-hidden="true" />
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#0c1a14] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <p className="mb-3 text-sm font-medium text-white/60">分析方向</p>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="分析方向">
            <DirectionButton active={direction === "BULL"} onClick={() => setDirection("BULL")} tone="bull" />
            <DirectionButton active={direction === "BEAR"} onClick={() => setDirection("BEAR")} tone="bear" />
          </div>
          <button type="button" onClick={scan} disabled={loading} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e7ff55] px-5 text-base font-bold text-[#10170c] transition hover:bg-[#f0ff91] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">
            <ScanSearch size={20} aria-hidden="true" />
            {loading ? "20銘柄を分析中…" : "今の相場を分析"}
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-white/40">MAゲート通過後、AO・RSI・Stochasticの適合度を採点</p>
        </section>

        {result.scannedAt ? (
          <section className="mt-8" aria-live="polite">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div><p className="text-xs font-medium text-white/40">TOP MATCHES</p><h2 className="mt-1 text-xl font-semibold">候補 {result.candidates.length}銘柄</h2></div>
              <p className="text-right text-xs text-white/40">デモデータ<br />{result.scannedAt}</p>
            </div>
            {result.candidates.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/55">60点以上の候補はありません</div>
            ) : (
              <div className="space-y-7">
                <CandidateGroup icon={<Flame size={18} />} title="今すぐチャンス" items={now} tone="now" />
                <CandidateGroup icon={<Clock3 size={18} />} title="30分以内にチャンス" items={soon} tone="soon" />
              </div>
            )}
          </section>
        ) : (
          <section className="mt-8 rounded-[24px] border border-dashed border-white/10 px-6 py-10 text-center">
            <p className="text-sm font-medium text-white/55">方向を選び、現在の候補をスキャン</p>
            <p className="mt-2 text-xs leading-relaxed text-white/35">最大5銘柄だけをスコア順に表示します</p>
          </section>
        )}
        <footer className="mt-10 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/35">スコアはテクニカル条件の適合度であり、勝率ではありません。現在は画面・計算検証用のデモOHLCを使用しています。</footer>
      </div>
    </main>
  );
}

function DirectionButton({ active, onClick, tone }: { active: boolean; onClick: () => void; tone: "bull" | "bear" }) {
  const bull = tone === "bull"; const Icon = bull ? ArrowUpRight : ArrowDownRight;
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition ${active ? bull ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-300" : "border-rose-300/60 bg-rose-400/15 text-rose-300" : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.06]"}`}>
      <Icon size={19} aria-hidden="true" />{bull ? "BULL" : "BEAR"}
    </button>
  );
}

function CandidateGroup({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: ScanResult["candidates"]; tone: "now" | "soon" }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className={`mb-3 flex items-center gap-2 text-sm font-bold ${tone === "now" ? "text-orange-300" : "text-amber-200"}`}>{icon}{title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <article key={item.assetId} className="rounded-[22px] border border-white/10 bg-[#0c1a14] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-xs font-semibold text-white/45">{index + 1}</span><div><h4 className="font-semibold tracking-tight">{item.name}</h4><p className="mt-1 text-xs text-white/40">Payout {item.payout}% · 30M {item.score30m} / 5M {item.score5m}</p></div></div>
              <div className="text-right"><strong className="text-3xl tracking-[-0.05em]">{item.score}</strong><span className="ml-1 text-xs text-white/35">点</span></div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 border-t border-white/10 pt-4 text-center text-[11px]">
              <Metric label="1H MA" value={item.direction === "BULL" ? "↑" : "↓"} />
              <Metric label="30M MA" value={item.direction === "BULL" ? "↑" : "↓"} />
              <Metric label="5M AO" value={symbol(item.phases.ao)} />
              <Metric label="5M RSI" value={item.rsi.toFixed(0)} />
              <Metric label="5M Stoch" value={symbol(item.phases.stochastic)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function symbol(phase: string) { return phase === "optimal" ? "◎" : phase === "early" ? "↗" : "△"; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-white/35">{label}</p><p className="mt-1 text-sm font-bold text-white/80">{value}</p></div>; }
