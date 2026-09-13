# Bubinga Market Scanner

Bubingaのペイアウト上位20銘柄から、選択方向のMAゲートとAO・RSI・Stochastic適合度により、確認対象を最大5銘柄へ絞るPWAです。自動発注は行いません。

## Current status

- Issue #1相当のスマホ向けPWA画面を実装
- EMA、AO、RSI、Stochastic、BULL/BEARスコアリングを純粋関数として実装
- 現在はデモOHLCで動作
- Bubinga実データ接続、バックテスト、Vercel公開は未実施

## Commands

```bash
pnpm test
pnpm build
```

## Documentation

- [Requirements](docs/requirements.md)
- [Scoring logic](docs/scoring-logic.md)
- [Data research](docs/data-research.md)
- [Phase 1 plan](docs/phase-1-plan.md)
- [Backtesting](docs/backtesting.md)

## Safety and interpretation

表示スコアはテクニカル条件の適合度であり、勝率や利益を保証しません。実データ取得はBubingaの規約・認証・商用利用条件を確認したうえで有効化します。
