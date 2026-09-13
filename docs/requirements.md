# Requirements

## Product goal

Bubingaの取引可能銘柄をペイアウト順に20件まで取得し、選択方向のMAゲートを通過した銘柄をAO・RSI・Stochasticで採点する。60点以上をスコア順に最大5件表示する。自動発注は行わない。

## User flow

1. BULLまたはBEARを選択
2. 「今の相場を分析」を実行
3. 80〜100点を「今すぐチャンス」、60〜79点を「30分以内にチャンス」として全体で最大5件表示

## Acceptance criteria — Issue #1

- スマートフォン幅でBULL/BEAR選択と分析ボタンを操作できる
- 方向選択が視覚・アクセシビリティの両面で識別できる
- 最大5件の結果カードをNOW/SOONに分類できる
- PWA manifestとfaviconを持つ
- スコアが勝率ではない旨を明示する
- 本番ビルドに成功する

## Non-goals

- 自動発注
- MVPでのWebSocket常時接続
- MVPでのチャート表示
- 認証回避、レート制限回避、毎秒REST polling

## Data status

画面と計算エンジンは実装済み。Bubinga実データ接続は、規約・認証条件・レスポンス仕様・1時間足境界の確認が済むまで無効化する。
