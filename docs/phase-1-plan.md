# Phase 1 Plan

| Issue | Work item | Acceptance summary | Status |
|---:|---|---|---|
| 1 | PWA初期構築 | 方向選択、分析、最大5件、manifest、build | In Progress |
| 2 | Bubinga銘柄マスター取得 | 正規化、取引可能判定、失敗処理 | Adapter implemented; live contract blocked |
| 3 | ペイアウト上位20銘柄抽出 | 利用するpayout種別を確定し降順20件 | Ranking implemented; payout source provisional |
| 4 | Candles取得 | 30M/1H、確定足、欠損検査 | 30M adapter implemented; 1H contract blocked |
| 5 | MAトレンドフィルター | 1H AND 30Mゲート、単体テスト | Completed |
| 6 | AO計算 | SMA5−SMA34、単体テスト | Completed |
| 7 | RSI計算 | Wilder RSI14、単体テスト | Completed |
| 8 | Stochastic計算 | %K14/%D3、単体テスト | Completed |
| 9 | BULL/BEARスコアリング | 3フェーズ、30M/5M 50:50、逆方向対称性 | Completed |
| 10 | 上位5銘柄UI | 60点未満除外、NOW+SOON全体5件 | Completed with demo data |
| 11 | エラー・ローディング処理 | 再試行可能、部分失敗の明示 | Completed with demo; live UAT pending |
| 12 | バックテスト環境 | 50〜100ケース、先読み防止 | Backlog |
| 13 | Vercel Preview Deploy | Preview URLとbuild確認 | Backlog |

各Issueには目的、受入条件、変更ファイル、テスト方法、結果を記載する。
