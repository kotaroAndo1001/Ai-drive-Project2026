# AI質問アプリ テスト結果

対象ブランチ: `feature/ai-app`（commit `ef784ea`、origin へ push 済み）  
対象環境: Local（http://localhost:3000）。Preview / Production はデプロイ後に追記  
記録日: 2026-11-11  
秘密値（APIキー・接続文字列）は記載しない。

## 1 必須確認（授業テキスト T01〜）

| ID | 対応REQ/DES | 条件・操作 | 期待 | 実測 | 判定 |
|---|---|---|---|---|---|
| T01 | F002 / DES-AI-02 | 正常な質問を POST `/api/ai/ask` | 201・回答・DB保存 | 201。例: prompt「こんにちは。短く返してください。」→ response あり・id=4 | 合格 |
| T02 | F003 / DES-AI-01 | 履歴 GET または再読込 | 保存内容を取得・表示 | 200・`success:true`・items に保存済み件あり | 合格 |
| T03 | F004 | 履歴0件 | 200・`items:[]`・画面「履歴がありません」 | 表作成直後（2026-11-11）に API で 200 / `items:[]` を確認。現在は件ありのため再測定せず | 合格（初期確認） |
| T04 | F005 / D002 | `{"prompt":"   "}` を直接 POST | 400・AI未呼出・未保存 | 400・`BAD_REQUEST`・`promptが空です` | 合格 |
| T10 | F005 | AI失敗時 | 安全な502・未保存・UI復帰 | モデル不正時に 502・`AI_FAILED` を確認済み。UI復帰はコード上 finally。追加の実演は講師確認可 | 一部確認 |
| T12 | F005 | オフラインで送信 | 質問保持・案内・ボタン復帰 | 未実施（ブラウザ手動） | 未実施 |
| T13 | F005 | 待機中の連打 | 重複送信抑止 | `disabled` で抑止する実装を確認。画面連打の実測は未 | 一部確認 |
| T14 | N002 | HTMLに見える質問・回答 | textContent で文字列表示 | `public/js/ai.js` は textContent のみ。innerHTML 未使用 | 合格（コード確認） |
| T16 | N002 | Sources / Network / git | キーなし・Geminiへブラウザ直通信なし | `public/` にキーなし。API は自サーバ `/api/ai/*`。`.gitignore` に `.env` | 合格（ローカル） |
| T20 | N003 | TOP・TODO | 既存操作が動く | `/`・`/todo`・`/api/db-check` いずれも 200 | 合格 |

## 2 追加確認

| ID | 操作 | 期待 | 実測 | 判定 |
|---|---|---|---|---|
| A01 | 壊れた JSON を POST | 400 | 400・`BAD_REQUEST` | 合格 |
| A02 | `AI_DEMO_ENABLED=false` で history | 503・`DEMO_DISABLED` | 503・デモ停止。`/`・`/todo` は 200 | 合格 |
| A03 | `/ai` 画面 | フォーム表示 | HTTP 200 | 合格 |

## 3 SQL

| 項目 | 内容 |
|---|---|
| ファイル | `sql/ai/030_create_ai_qa_logs.sql` |
| 実行先 | Neon production / neondb |
| 結果 | 作成成功。履歴・ask を確認 |

## 4 未実施・次

- T12 オフライン送信のブラウザ実測
- T13 連打の画面実測
- Preview 保護・Production で `AI_DEMO_ENABLED=false` の確認（push / PR 後）
- `working_report.md` の学籍・氏名欄は本人記入

## 5 提出用（記入待ち）

- GitHub: https://github.com/kotaroAndo1001/Ai-drive-Project2026
- PR作成: https://github.com/kotaroAndo1001/Ai-drive-Project2026/pull/new/feature/ai-app
- Preview / Production: Vercel デプロイ後に URL を追記。Production は `AI_DEMO_ENABLED=false`
