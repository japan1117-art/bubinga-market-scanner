# UAT checklist

Updated: 2026-09-13

## Scope

Phase 1 MVPの利用者視点テスト。スコアはテクニカル条件への適合度であり、勝率を表さない。

## Verified

- [x] Next.js production build succeeds
- [x] Vercel Preview deployment reaches `READY`
- [x] Local application returns HTTP 200
- [x] Initial screen contains BULL, BEAR, and `今の相場を分析`
- [x] Automated calculation and selection tests pass (49 tests)
- [x] NOW and SOON share a single five-result limit
- [x] Final score combines 30m and 5m at 50% each
- [x] Requests omit browser credentials by default
- [x] Manifest includes 192px, 512px, and maskable icons
- [x] Service Worker caches the application shell and supports offline navigation fallback

## Pending interactive UAT

- [ ] Select BULL and run demo analysis
- [ ] Select BEAR and run demo analysis
- [ ] Confirm loading state prevents duplicate submission
- [ ] Confirm retry UI after a simulated data failure
- [ ] Confirm cards remain readable at 360px viewport width
- [ ] Install from the PWA manifest on an Android device
- [ ] Confirm offline shell behavior on an Android device

## External-data validation pending

- [ ] Confirm Bubinga API usage terms and authentication requirements
- [ ] Confirm live `assets` response contract and tradability rule
- [ ] Confirm official 5m and 1h candle granularities
- [ ] Confirm `from` / `to` units and candle-boundary semantics
- [ ] Run a minimum of 50–100 historical cases before interpreting score performance

## Release gate

Production deployment remains blocked until interactive UAT passes and the live-data access method is confirmed acceptable. No Bubinga user ID or password is used in the current MVP.
