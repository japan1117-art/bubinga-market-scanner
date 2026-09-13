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
