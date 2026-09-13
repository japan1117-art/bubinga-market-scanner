# Scoring Logic v0.1

## Gate

1Hと30Mの両方でEMA20が直近3点連続して選択方向へ傾斜し、終値がEMA20の選択方向側、かつEMA20がEMA50の選択方向側にあること。片方でも不成立なら採点しない。

実装ではfastPeriod、slowPeriod、slopePoints、終値位置確認、EMA間位置確認を設定として分離する。既定値は20/50/3/有効/有効。設定値が不正または必要本数不足の場合は通過させない。

## Score

| Indicator | Weight | Early | Optimal | Late |
|---|---:|---:|---:|---:|
| AO | 35 | 24.5 | 35 | 19.25 |
| RSI | 30 | 21 | 30 | 16.5 |
| Stochastic | 35 | 24.5 | 35 | 19.25 |

倍率はEarly 0.70、Optimal 1.00、Late 0.55、条件外0。合計は画面表示時に整数へ四捨五入する。

## Indicator phase boundaries

### AO

- BULL Early: 0未満で上昇、BEAR Early: 0超で下降
- Optimal: 0ラインを選択方向へ越え、3区間連続で改善
- Late: 選択方向側だが直近の改善幅が1区間前の55%未満
- 逆行または履歴不足: 0点

### RSI

- BULL: 42〜50未満かつ上昇=Early、50〜65=Optimal、65超〜72=Late、72超=0点
- BEAR: 50超〜58かつ下降=Early、35〜50=Optimal、28〜35未満=Late、28未満=0点

### Stochastic

- Early: GC/DC直前への接近、または20/80からの反転開始
- Optimal: BULLは%K>%Dかつ20〜70、BEARは%K<%Dかつ30〜80
- Late: BULLは70超、BEARは30未満でクロス方向を維持
- 逆行または履歴不足: 0点

## Timeframe

MAゲートは1Hと30M。AO・RSI・Stochasticは30Mと5Mでそれぞれ0〜100点を算出し、最終スコアは次式とする。

`final = round(30M score × 0.50 + 5M score × 0.50)`

30Mは中期的な準備状態、5Mは直近のエントリータイミングを表す。形成中の足を含めるかは実API検証時に決定し、バックテストと本番で統一する。

## Important interpretation

80点は勝率80%を意味しない。「30分以内」も未来予測ではなく、現在60〜79点で追加条件により80点へ移行し得る状態を表す暫定ラベルである。

## Calibration candidates

- EMA50を必須から補助条件へ変更する効果
- RSI58近辺を連続得点化する効果
- AOの上昇幅縮小率
- StochasticのGC/DC直後本数
- 形成中足を使う場合の再描画・先読みバイアス
