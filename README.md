# Ai-drive-Project2026

Express・TypeScriptで作成したWebサイトです。GitHubで管理し、Vercelで公開しています。

## データベース

- データベースにはNeon（PostgreSQL）を使用しています。
- 接続先は環境変数 `DATABASE_URL` で指定します。
  - ローカル：プロジェクト直下の `.env` に設定します（`.env` はGitに含めません）。
  - Vercel：Preview・Productionの環境変数に設定します（プール接続URLを使用）。
- 接続文字列の値はREADMEやコードに書きません。

## 接続確認API

- `GET /api/db-check`：Neonへ `SELECT 1` を実行し、結果を返します。
  - 成功：`{"status":"ok","database":"connected"}`
  - 失敗：HTTP 503 と `{"status":"error","database":"unavailable"}`

## SQL

- `sql/000_check_connection.sql`：接続先を確かめるための読み取り専用SQLです。NeonのSQL Editorで実行します。
- `sql/010_setup_sample_products.sql`：授業用の商品テーブル（products）と商品3件を用意するSQLです。NeonのSQL Editorで手動実行します。
- 実行記録は `sql/README.md` にあります。

## 商品一覧

- `GET /db-sample`：Neonの `products` テーブルから商品を読み取り専用で取得し、一覧表示します。

## TODOアプリ（V1）

- 画面：`GET /todo`
- API：`/api/v1/todos`（GET一覧、POST登録、PATCH完了更新、DELETE削除）
- SQL：`sql/todo/020_create_todo_tasks.sql`（NeonのSQL Editorで手動実行）
- 設計文書：`docs/todo/`（要件・設計・実装手順・テスト結果）

## AI質問アプリ

質問を送り、サーバー経由で Gemini に答えさせ、履歴を Neon に保存します。ブラウザに API キーは渡しません。過去の履歴は AI に送りません（今回の質問のみ）。

- 画面：`GET /ai`（TOP からリンク）
- API：`POST /api/ai/ask`（成功 201）、`GET /api/ai/history`（0件でも 200 と空配列）
- SQL：`sql/ai/030_create_ai_qa_logs.sql`（Neon の SQL Editor で手動実行）
- コード：`src/apps/ai/`、`views/ai/index.ejs`、`public/js/ai.js`
- 文書：`docs/ai/`（要望・要件・設計・tasks・test-results・ai-log・working_report）

### 環境変数（名前のみ）

| 名前 | 用途 |
|---|---|
| `DATABASE_URL` | Neon 接続（既存） |
| `AI_DEMO_ENABLED` | `true` のときだけ AI API 有効。未設定/`false` で ask/history は 503 |
| `GEMINI_API_KEY` | サーバーのみ |
| `GEMINI_MODEL` | 利用モデル名（サーバーのみ） |

### 失敗・0件・公開停止

- 履歴0件：正常。API は空配列、画面は「履歴がありません」
- 入力不正・AI失敗・保存失敗：固定の公開コード。成功扱いにしない
- Production は標準で `AI_DEMO_ENABLED` を止め、ローカルまたは保護した Preview でデモする

### 確認状況（2026-11-11）

- ローカル：実 Gemini での質問保存、履歴、空白入力 400、デモ停止 503、TOP/TODO 回帰を確認（詳細は `docs/ai/test-results.md`）
- 未実施：オフライン送信・連打の画面実測、Preview/PR/Production 停止の提出用確認

## AI対話アプリ V2

話題ごとに会話を分け、同じ会話では直近5往復を Gemini に渡して追加質問できます。画面表示は最新20往復です。

- 画面：`GET /ai/v2`
- API：`/api/ai/v2/conversations`、`/api/ai/v2/conversations/:id/turns`
- SQL：`sql/ai/040_create_ai_conversations.sql`
- 文書：`docs/ai/v2/`
- V1・TOP・TODO は維持。公開時は `AI_DEMO_ENABLED` で V2 API も停止可能

## リアルタイムチャット

利用者同士がユーザー名とコメントで会話します（AI 応答なし）。Socket.IO で同じルームの入室者に配信し、投稿は Neon に保存します。

- 画面：`GET /chat`（TOP からリンク）
- API：`GET /api/chat/status`（定員と入室数のみ。履歴は入室を許可した Socket にだけ返す）
- Socket イベント：`chat:join`・`chat:send`（ack あり）、`chat:message`（配信）
- 定員：ルーム `lobby` に全インスタンス合計5接続。席は DB（`chat_room_seats`）で管理
- 複数インスタンス：DB を2秒ごとに確認して新着を配信（Redis 不要）
- 入力：ユーザー名1〜50文字、コメント1〜500文字（前後空白を除いて判定）
- SQL：`sql/chat/050_create_chat_tables.sql`
- コード：`src/apps/chat/`、`views/chat/index.ejs`、`public/chat/chat.js`
- 文書：`docs/chat/`（01 要望〜06 テスト結果）
- 検証：`PORT=3000` と `PORT=3001` で2つ起動し `node tests/chat/socket-check.mjs`（DB にテスト投稿が保存される）
- Vercel 上では Socket.IO を起動しない（画面は表示され、接続できない旨を案内）

## 起動方法

```
npm ci
npm run build
npm start
```

開発時は `npm run dev` を使います。http://localhost:3000/ を開きます。
