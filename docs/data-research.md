# Bubinga Data Research

## Confirmed by supplied DevTools observations

- Assets: `GET https://api.bubinga.com/api/v1/assets`
- Pagination observed: `pagination[limit]=250&pagination[offset]=0`
- Fields observed: `id`, `name`, `code`, `enabled`, `category`, `profitability`
- Candles: `GET /api/v1/assets/{asset_id}/candles`
- Candle query originally observed as `dataization=30m`; live verification on 2026-09-13 established the accepted key is `detalization`
- Candle fields observed: `time`, `open`, `high`, `low`, `close`
- WebSocket observed: `wss://ws.bubinga.com/connection/websocket`
- Quote channel observed: `anonymous:assets/{asset_id}/quotes`

## Known mappings (do not hardcode as primary source)

- 49 = GSMI
- 50 = LATAM
- 99 = ASIA
- 154 = BITCOIN (OTC)

## Open validation items

- 利用規約上の取得・保存・表示・商用利用可否
- APIが未認証利用を正式に許可しているか
- PWA originからのCORS可否
- `profitability.binary.current`と`turbo.current`の採用ルール
- 取引可能判定に`enabled`以外の営業時間フィールドが必要か
- `from/to`の最大期間と最大取得本数
- 最終要素が確定足か形成中足か
- 欠損・重複・順序逆転の扱い
- レート制限とキャッシュ方針

## MVP policy

実データ接続は専用アダプターに隔離し、ブラウザからCookie・Authorizationを送らずに読み取る。認証情報は保存・使用せず、自動発注も行わない。公開範囲は公式契約の確認結果に従って制限する。

## Official client-agreement review — 2026-09-14

- Official page reviewed: `https://bubinga.com/ja/main/client-agreement`
- The footer limits use of information published on the website to personal and non-commercial purposes and describes the permission as limited and non-exclusive.
- The agreement also states that website access and services are provided subject to strict compliance with the agreement and may be changed without individual notice.
- The current scanner is intended only as the user's personal decision-support tool. It does not authenticate, place orders, or store account credentials.
- A publicly reachable, unauthenticated URL can be interpreted as enabling third-party use even when it is marked `noindex`. The Production release is therefore recorded as a user-accepted residual risk for personal use, not as confirmation of Bubinga's API redistribution permission.
- Technical accessibility, CORS headers, and public caching do not override these contractual restrictions.

## 2026-09-13 implementation note

- 認証情報を送らず、`credentials: "omit"`で1回だけ取得するアダプターを実装
- limit=250 / offset=0を固定し、1銘柄ずつの検索を行わない
- 配列、`data`、`items` envelopeを正規化
- binary.currentを優先し、存在しない場合だけturbo.currentを利用
- 0〜1の収益率は百分率へ変換し、既に百分率なら維持
- 不正レコードと重複IDを除外
- 10秒timeout、HTTP・network・response形式エラーを区別

### Live unauthenticated verification（2026-09-13）

- Assets APIはCookie・AuthorizationなしでHTTP 200。`{ "data": [...] }`として160件を取得し、観測時点でtop-level `enabled=true`は71件
- `id / name / code / enabled / profitability`を実レスポンスで確認
- 現在のマスターでは`49=GSMI`、`50=LATAM`。過去の手動対応表と逆だったため、IDをハードコードしない方針が必須
- Candlesの`from / to`はISO日時を受理。Unix秒はHTTP 400
- 正しいquery keyは`detalization`。`dataization`はextra fieldとしてHTTP 400
- Asset 49で`detalization=5m / 30m / 1h`がすべてHTTP 200となり、`{ "data": [...] }`のOHLCを取得
- 技術的到達性の確認であり、再配布・商用利用の許諾を意味しない

## Candle adapter v0.1

- 実通信確認済みの`detalization=5m / 30m / 1h`を扱う
- `from`/`to`はISO日時を利用する
- Cookie・Authorizationを送らない
- ISO日時、epoch秒、epochミリ秒をUTC ISOへ正規化
- OHLCの高値・安値関係が不正な足、負数、必須値欠損を除外
- 時刻昇順へ統一
- 同時刻の重複足は後勝ちで統合し、重複件数を報告
- 30分間隔の欠損本数を報告
- 公式な1H指定値と境界が確認できるまで1Hリクエストを許可しない
