# Backtesting v0.1

## Purpose

テクニカル適合度スコアと将来結果の関係を測る。80点を勝率80%として扱わず、実測の勝率・損益・期待値を別に算出する。

## No-lookahead rule

`Candle.time`は足の開始時刻として保守的に扱い、`time + timeframe <= 評価時刻`を満たす確定足だけを指標計算へ渡す。未来足は指定した判定期間後の結果判定にだけ使用する。

## Configurable inputs

- expiryMinutes: 結果判定期間。必須
- soonWindowMinutes: SOONからNOWへの移行確認期間。既定30分
- payoutRatio: 1単位ベットの勝利純利益。既定0.90
- signalCooldownMinutes: 同一銘柄で次の取引候補を数えるまでの待機時間。レポートCLIは判定期間と同じ値を既定とし、同時保有を防ぐ

## Metrics

- NOW/SOON信号数
- WIN/LOSS/PUSH/出口データなし
- 勝率 = WIN / (WIN + LOSS)
- 1単位当たり合計損益
- 1シグナル当たり期待値
- SOONから指定時間内にNOWへ移行した割合
- SOONからNOWへ移行するまでの平均分数
- 短期ノイズ・中期ノイズ別の信号数、勝率、期待値
- Earlyを1つ以上含む信号と、Earlyを含まない信号の勝率・期待値比較
- MAゲート有効・無効の対照実験（通常スキャンは常に有効）
- 1H / 30M / 5MごとのAO・RSI・Stochasticフェーズ別成績
- payout帯別の信号数、勝率、期待値

## Segments v0.2

ノイズは画面と同じ閾値で、`STABLE`（0〜29）、`NORMAL`（30〜49）、`UNSTABLE`（50〜69）、`CHOPPY`（70〜100）、`UNKNOWN`（データ不足）に分類する。各区分について信号数、決着数、WIN/LOSS、勝率、1シグナル当たり期待値を算出する。

Early倍率0.79の妥当性は、AO・RSI・StochasticのいずれかにEarlyを含む信号と、Earlyを含まない成熟信号を分けて評価する。前倒し採用の判断では、平均移行時間だけでなく、誤検知による勝率・期待値の低下も同時に確認する。

MAゲートの寄与は同じOHLCデータに対して `requireMaGate: true / false` の2回を実行し、信号数、勝率、期待値を比較する。`false` は検証専用であり、本番スキャナーの既定値は `true` のままとする。指標寄与は時間足ごとに各指標の `early / optimal / late / none` を集計し、単なる出現頻度ではなく期待値差で判断する。

## Validation gates

最低50〜100件は動作確認の初期サンプルにすぎない。閾値変更を判断する場合は、銘柄・期間・BULL/BEARを分けたout-of-sample検証を追加する。

## Reproducible dataset workflow

履歴データは一度だけ取得してローカルJSONへ固定し、その後の比較では同じファイルを再利用する。これにより条件ごとの取得時刻差をなくし、Bubingaへの不要な再アクセスも防ぐ。スナップショットとレポートはGit管理対象外とする。

```bash
pnpm backtest:capture -- --from 2026-09-01T00:00:00Z --to 2026-09-10T00:00:00Z --assets 49,50
pnpm backtest:run -- --expiry 5
```

取得コマンドはassetsを1回取得し、Candlesは本番接続で確認済みの範囲（5Mは18時間、30Mは3日、1Hは5日）に分割する。境界で重複した足は時刻キーで1本に統合する。最大20銘柄を明示指定し、Cookie・Authorizationは送信しない。実行前に対象IDをassets APIの現在値で確認し、利用条件が不明な間は個人検証の範囲を超えてデータを共有しない。
