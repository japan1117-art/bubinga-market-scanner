# Bubinga Data Research

## Confirmed by supplied DevTools observations

- Assets: `GET https://api.bubinga.com/api/v1/assets`
- Pagination observed: `pagination[limit]=250&pagination[offset]=0`
- Fields observed: `id`, `name`, `code`, `enabled`, `category`, `profitability`
- Candles: `GET /api/v1/assets/{asset_id}/candles`
- Candle query observed: `from`, `to`, `dataization=30m`
- Candle fields observed: `time`, `open`, `high`, `low`, `close`
- WebSocket observed: `wss://ws.bubinga.com/connection/websocket`
- Quote channel observed: `anonymous:assets/{asset_id}/quotes`

## Known mappings (do not hardcode as primary source)

- 50 = GSMI
- 49 = LATAM
- 99 = ASIA
- 154 = BITCOIN (OTC)

## Open validation items

- 利用規約上の取得・保存・表示・商用利用可否
- APIが未認証利用を正式に許可しているか
- PWA originからのCORS可否
- `profitability.binary.current`と`turbo.current`の採用ルール
- 取引可能判定に`enabled`以外の営業時間フィールドが必要か
- 1Hの正式な`dataization`値
- `from/to`の単位、タイムゾーン、境界、最大取得本数
- 最終要素が確定足か形成中足か
- 欠損・重複・順序逆転の扱い
- レート制限とキャッシュ方針

## MVP policy

実データ接続はサーバー側アダプターに隔離する。規約・認証条件を確認するまではデモデータを既定値とし、認証情報は使用しない。

## 2026-09-13 implementation note

- 認証情報を送らず、`credentials: "omit"`で1回だけ取得するアダプターを実装
- limit=250 / offset=0を固定し、1銘柄ずつの検索を行わない
- 配列、`data`、`items` envelopeを正規化
- binary.currentを優先し、存在しない場合だけturbo.currentを利用
- 0〜1の収益率は百分率へ変換し、既に百分率なら維持
- 不正レコードと重複IDを除外
- 10秒timeout、HTTP・network・response形式エラーを区別

### 未検証

実行環境から`api.bubinga.com`へのGETは20秒でタイムアウトした。HTTP応答本文を取得できていないため、認証要否、実際のenvelope、CORS、現在のフィールド型は未確認。これはBubinga側の認証要求ではなく、実行環境の通信制限である可能性も残る。

## Candle adapter v0.1

- DevToolsで確認済みの`dataization=30m`と、追加仕様の`dataization=5m`を扱う。5m指定値は実通信確認待ち
- `from`/`to`は単位未確認のため、呼び出し元が明示した値をそのまま利用
- Cookie・Authorizationを送らない
- ISO日時、epoch秒、epochミリ秒をUTC ISOへ正規化
- OHLCの高値・安値関係が不正な足、負数、必須値欠損を除外
- 時刻昇順へ統一
- 同時刻の重複足は後勝ちで統合し、重複件数を報告
- 30分間隔の欠損本数を報告
- 公式な1H指定値と境界が確認できるまで1Hリクエストを許可しない
