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

## Asset ranking v0.1

- `enabled=true`だけを取引可能候補とする
- 正規化済みpayoutの降順
- 同率の場合はcode昇順、さらに同じならID昇順
- 最大20件。取引可能銘柄が20件未満なら存在する件数のみ返す
- minimum payoutは設定可能だが、初期値は0
- binary/turboの選択はデータ正規化層の責務とし、ランキング層は分離する

## Multi-timeframe scoring v0.2

- 1Hと30MのMAは方向ゲート
- 30MのAO/RSI/Stochasticを100点で採点
- 5MのAO/RSI/Stochasticを100点で採点
- 最終点は30M 50% + 5M 50%
- 80〜100をNOW、60〜79をSOON、59以下を非表示

## Failure handling

- 分析中は方向切替と二重実行を無効化
- network/timeout、HTTP、レスポンス形式不正をユーザー向け文言へ変換
- 生のエラー本文や認証情報を画面へ出さない
- 再試行可能な失敗だけ再試行ボタンを表示
- 部分失敗時は成功した銘柄を表示し、対象数・分析完了数・警告を併記
- 失敗時も直前の成功結果は消さない
