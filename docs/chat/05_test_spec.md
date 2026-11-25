# リアルタイムチャット テスト仕様書（`docs/chat/05_test_spec.md`）

入力: `02_requirements.md`・`03_design.md`・`04_implementation.md`、実装（`src/apps/chat/`・`public/chat/chat.js`）
自動実行: `tests/chat/socket-check.mjs`（「自動」列が ○ のもの）

前提

- 同じ `.env`（同じ Neon）で `PORT=3000`（以下「台A」）と `PORT=3001`（「台B」）を起動済み。
- DB 障害確認用に、接続できない `DATABASE_URL` で `PORT=3002` を起動（TST-CHAT-020）。
- 開始時に `lobby` の入室者がいないこと（`GET /api/chat/status` の `occupied` が 0）。

| TST ID | 対応 REQ / DES | 前提・データ | 操作 | 期待結果 | 確認場所 | 自動 |
|---|---|---|---|---|---|---|
| TST-CHAT-001 | REQ-001 / DES-001 | — | `GET /chat`、TOP のリンク | 200。ユーザー名・コメント・送信・一覧・状態表示。TOP に「チャット」リンク | 画面・curl | — |
| TST-CHAT-002 | REQ-011 / DES-006 | — | `/chat` と `/chat/chat.js` の内容を確認 | 接続文字列・`DATABASE_URL`・ホスト名を含まない | curl | — |
| TST-CHAT-003 | REQ-002,003,004 / DES-002,004 | 2接続入室 | A→B、B→A の順に送信 | A・B とも同じ2件を各1件受信。DB は2行増。ポーリング後も重複なし | Socket・DB | ○ |
| TST-CHAT-004 | REQ-003 / DES-004 | 2タブ（台Aと台B） | 画面のフォームから送信 | 送信側・受信側とも1件だけ表示。コメント欄が空になる | 画面 | — |
| TST-CHAT-005 | REQ-005 / DES-003 | 21件以上保存済み | 新しい接続で入室 | 20件。DB の最新20件と同じ ID を古い順 | Socket・DB | ○ |
| TST-CHAT-006 | REQ-005 / DES-004 | 1接続入室済み | 別接続の入室と同時に投稿（5回） | 履歴＋入室中の新着を ID で統合すると、その投稿は1件 | Socket | ○ |
| TST-CHAT-007 | REQ-007 / DES-005 | 5接続入室（台A・B混在） | 6接続目が入室 | `ROOM_FULL`。履歴を返さない。席数5 | Socket・DB | ○ |
| TST-CHAT-008 | REQ-008 / DES-002 | TST-007 の状態 | 6接続目が送信、入室者が投稿 | 送信は `NOT_JOINED`。6接続目は新着を受信しない | Socket | ○ |
| TST-CHAT-009 | REQ-008 / DES-005 | TST-007 の状態 | 1接続を閉じ、6接続目が再試行 | 入室成功、履歴20件、席数5 | Socket・DB | ○ |
| TST-CHAT-010 | REQ-005,010 / DES-004 | 2接続入室 | Bを切断→Aが投稿→Bが再接続・入室（3回） | 切断で席が1に減る。毎回その投稿が履歴に1件 | Socket・DB | ○ |
| TST-CHAT-011 | REQ-009 / DES-006 | 2接続入室 | 空文字、空白のみ（全角・改行・タブ）、型不正（数値・配列・payload 文字列・なし）、ユーザー名51字、コメント501字、50字・500字ちょうど、絵文字50字、前後空白付き | 不正は `VALIDATION_ERROR` と理由。正常のみ保存・配信。前後空白は除去して保存 | Socket・DB | ○ |
| TST-CHAT-012 | REQ-009 / DES-006 | 画面 | 空・空白のみで送信ボタン | 画面に理由が出て送信されない | 画面 | — |
| TST-CHAT-013 | REQ-010 / DES-004 | 画面で入室中 | 接続先サーバーを停止して送信 | 「サーバーに接続できません…」、送信ボタン無効、送信しても「接続・入室していない」表示。DB に保存されない | 画面・DB | — |
| TST-CHAT-014 | REQ-011 / DES-006 | 入室済み | `<script>`・`<img onerror>`・`<b>` を含む投稿 | DB に文字列のまま保存 | Socket・DB | ○ |
| TST-CHAT-015 | REQ-011 / DES-006 | TST-014 の投稿 | 画面で一覧を表示 | タグが文字として表示され、`b`・`script`・`img` 要素が作られない | 画面 | — |
| TST-CHAT-016 | REQ-008 / DES-002 | 5接続入室 | ブラウザで6つ目の `/chat` を開き、1席空いた後に「再試行」 | 満席案内のみ（一覧・フォームなし）→再試行で入室し履歴20件 | 画面 | — |
| TST-CHAT-017 | REQ-006 / DES-005 | 台Aと台Bに1接続ずつ入室 | 双方向に送信 | 2秒程度以内に相手側へ届く。重複なし | Socket | ○ |
| TST-CHAT-018 | REQ-007 / DES-005 | 台A2接続＋台B2接続（合計4）入室 | 台A・台Bから同時に入室要求（5回） | 毎回成功は1件だけ、席数5 | Socket・DB | ○ |
| TST-CHAT-019 | REQ-007 / DES-005 | 更新が31秒前の席を5つ（異常終了したインスタンスを模擬） | `status` 確認後に入室 | `occupied` は0、入室成功、期限切れ席が消える | HTTP・Socket・DB | ○ |
| TST-CHAT-020 | REQ-010 / DES-006 | 台C（DB 接続不可） | 入室・送信・TOP・status | 入室 `UNAVAILABLE`、送信 `NOT_JOINED`、TOP 200、status 503、プロセス継続 | Socket・HTTP | ○ |
| TST-CHAT-021 | REQ-010 / DES-005 | 画面で入室中に台Bを停止 | 台Bを再起動 | 自動再接続→再入室（満席なら満席案内）→切断中の投稿を履歴に1件。切断中に押した送信は保存されない | 画面・DB | — |
| TST-CHAT-022 | REQ-011 | — | `/`・`/todo`・`/api/v1/todos`・`/ai`・`/ai/v2`・`/api/db-check`・`/nope`・JSON 破損 POST | 200（`/nope` は 404、破損 JSON は 400） | curl | — |
| TST-CHAT-023 | REQ-011 | — | `npm run build` | エラーなし。`dist/src/apps/chat/` が出力される | ターミナル | — |
| TST-CHAT-024 | REQ-006,007 | 本番の複数台構成（別ホスト） | TST-017・018 を別ホストで実施 | 同じ結果 | — | — |
