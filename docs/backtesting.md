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

## Validation gates

最低50〜100件は動作確認の初期サンプルにすぎない。閾値変更を判断する場合は、銘柄・期間・BULL/BEARを分けたout-of-sample検証を追加する。
