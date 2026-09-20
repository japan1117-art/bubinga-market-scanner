# Backtesting v0.1

## Purpose

テクニカル適合度スコアと将来結果の関係を測る。80点を勝率80%として扱わず、実測の勝率・損益・期待値を別に算出する。

## No-lookahead rule

`Candle.time`はその足の確定時刻として扱う。評価時刻以下の足だけを指標計算へ渡す。未来足は指定した判定期間後の結果判定にだけ使用する。

実APIで`time`が開始時刻を表す場合、この前提は変わるため、時刻仕様確認前の実測結果は正式採用しない。

## Configurable inputs

- expiryMinutes: 結果判定期間。必須
- soonWindowMinutes: SOONからNOWへの移行確認期間。既定30分
- payoutRatio: 1単位ベットの勝利純利益。既定0.90

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

## Segments v0.2

ノイズは画面と同じ閾値で、`STABLE`（0〜29）、`NORMAL`（30〜49）、`UNSTABLE`（50〜69）、`CHOPPY`（70〜100）、`UNKNOWN`（データ不足）に分類する。各区分について信号数、決着数、WIN/LOSS、勝率、1シグナル当たり期待値を算出する。

Early倍率0.79の妥当性は、AO・RSI・StochasticのいずれかにEarlyを含む信号と、Earlyを含まない成熟信号を分けて評価する。前倒し採用の判断では、平均移行時間だけでなく、誤検知による勝率・期待値の低下も同時に確認する。

## Validation gates

最低50〜100件は動作確認の初期サンプルにすぎない。閾値変更を判断する場合は、銘柄・期間・BULL/BEARを分けたout-of-sample検証を追加する。
