# Bubinga Market Scanner

> Personal-use decision-support tool. Do not redistribute, sell, or use commercially. This application does not place orders or store Bubinga credentials.

Bubingaのペイアウト上位20銘柄から、選択方向のMAゲートとAO・RSI・Stochastic適合度により、確認対象を最大5銘柄へ絞るPWAです。自動発注は行いません。

## Current status

- Issue #1相当のスマホ向けPWA画面を実装
- EMA、AO、RSI、Stochastic、BULL/BEARスコアリングを純粋関数として実装
- Bubingaの未認証HTTP APIからassetsと5m/30m/1h candlesを取得するMVPを実装
- 30Mと5Mを50%ずつ採点し、1H/30MのMAゲート後に最大5銘柄を表示
- PWAとVercel Previewを実装済み。Production公開はリリース作業中

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

表示スコアはテクニカル条件の適合度であり、勝率や利益を保証しません。公開URLは検索対象外に設定しますが、認証はないためURLを知る人はアクセスできます。個人・非商用利用に限定し、URLや取得データを第三者へ共有しません。
