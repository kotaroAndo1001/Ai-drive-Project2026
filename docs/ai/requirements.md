# AI質問アプリ 要件定義書

根拠: `docs/ai/request.md`（講師リポジトリ配布相当）、授業テキスト「AI駆動開発でつくるAIに質問するWebアプリ」の共通条件、既存の `index.ts` / `db.ts` / TODO構成。秘密値は記載しない。

配布要望書に `WISH-AI-001`〜`014` の番号は無かったため、要望書の項目を `WISH-AI-01`〜`07` として対応付けた（講師参考の requirements と同系統）。

## 1 背景・目的・利用者・対象範囲

既存の Express + TypeScript + EJS サイト（TOP・商品一覧・TODO）に、質問を送って AI 回答を得て履歴を保存する機能を追加する。対象利用者は授業の受講者・採点者。個人情報は扱わず、架空の質問だけを使う。

残す既存機能: `GET /`、`GET /api/db-check`、`GET /db-sample`、`GET /todo`、`/api/v1/todos`。DB は既存 Neon（`DATABASE_URL`）。公開は Vercel。AI はサーバー経由の Gemini API（ブラウザにキーを渡さない）。

対象外（標準課題に勝手に足さない）: ログイン、会話記憶（過去履歴を AI に送る）、Markdown 表示、履歴削除 UI、Production での常時公開。

## 2 WISH と REQ の対応

| 要望 | 要件 | 概要 |
|---|---|---|
| WISH-AI-01 画面と導線 | REQ-AI-F001 | `/ai` に質問画面。TOP 等からアクセス可能 |
| WISH-AI-02 送信と応答 | REQ-AI-F002 | Fetch で非同期送信・回答表示 |
| WISH-AI-03 履歴保存・一覧 | REQ-AI-F003, REQ-AI-D001 | DB 保存と最新20件表示 |
| WISH-AI-04 0件 | REQ-AI-F004 | 0件は正常。専用メッセージ |
| WISH-AI-05 失敗・再送 | REQ-AI-F005 | 安全なエラー。質問を保持。自動再送しない |
| WISH-AI-06 公開停止 | REQ-AI-F006 | `AI_DEMO_ENABLED` で API 停止 |
| WISH-AI-07 秘密管理・既存保護 | REQ-AI-N001〜N003 | キーは環境変数。既存機能を壊さない |

## 3 機能要件

### REQ-AI-F001 画面と導線
`GET /ai`（または同等）で質問フォーム・履歴領域・送信ボタンを表示する。既存 TOP からリンクできること。

### REQ-AI-F002 質問送信と回答表示
`POST /api/ai/ask` に JSON `{ "prompt": "..." }` を送り、ページ遷移なしで回答を表示する。成功は AI 取得と DB 保存の両方が終わってから（HTTP 201）。今回の質問だけを AI に送り、過去履歴は送らない。

### REQ-AI-F003 履歴の保存と閲覧
`GET /api/ai/history` で最新20件を作成日時の降順（同時刻なら ID 降順）で返す。再読込で履歴が見える。

### REQ-AI-F004 履歴0件
履歴0件でも HTTP 200。`success: true` と空配列。画面は「履歴がありません」等を表示し、障害と区別する。

### REQ-AI-F005 失敗時
入力不正・AI失敗・保存失敗・ネットワーク失敗を区別する。アプリはクラッシュしない。失敗時は質問文を消しにくくする。ブラウザと SDK の自動再試行はしない。

### REQ-AI-F006 デモ／公開停止
`AI_DEMO_ENABLED` が `false` または未設定のとき、質問・履歴 API は 503（例: `DEMO_DISABLED`）。静的な `/ai` や TOP・TODO まで一律に止めない。Production は標準で停止。ローカルまたは保護済み Preview でデモする。

## 4 非機能要件

### REQ-AI-N001 構成
`src/apps/ai/` に Router / Controller / Service / Model を分け、TODO と同様に `index.ts` へ最小限で登録する。

### REQ-AI-N002 秘密情報
`GEMINI_API_KEY` 等はサーバー環境変数のみ。Git・レスポンス・フロント JS に出さない。XSS 防止のため質問・回答は `textContent` 等で描画する。

### REQ-AI-N003 既存機能
TOP・TODO・db-check・db-sample の主要操作が動き続けること。

### REQ-AI-N004 入力・通信制限（授業共通条件）
- 質問: 前後空白除去後 1〜2000 Unicode コードポイント
- JSON 本文受信上限: 16KiB（16384 バイト）
- 待機の参考: AI 30秒、ブラウザ 45秒（実機で確認）

## 5 データ要件

### REQ-AI-D001 テーブル `ai_qa_logs`
列の目安: `id`、`prompt`、`response_text`、`created_at`（正式定義は設計書）。公開 JSON は camelCase（`id`, `prompt`, `response`, `createdAt`）。

### REQ-AI-D002 バリデーション順
AI 呼び出し前に入力検証する。空・長すぎ・不正 JSON は保存せず AI も呼ばない。

## 6 受入条件

| ID | 受入条件 |
|---|---|
| REQ-AI-F001 | `/ai` を開きフォームと送信が見える |
| REQ-AI-F002 | 送信後、遷移なしで回答が表示され DB に1行ある（201） |
| REQ-AI-F003 | 再読込で履歴が戻る（最大20件・新しい順） |
| REQ-AI-F004 | 0件で 200 と空配列。「履歴がありません」 |
| REQ-AI-F005 | 失敗時に安全な案内、質問保持、操作復帰。自動再送なし |
| REQ-AI-F006 | 停止時は ask/history が 503。TOP・TODO は動く |
| REQ-AI-N002 | 差分・Network にキーが出ない |

## 7 授業で確定した共通条件

| 項目 | 確定 |
|---|---|
| 質問長 | trim 後 1〜2000 code points |
| JSON上限 | 16KiB |
| 履歴 | 最新20件、created_at DESC, id DESC |
| 保存成功 | AI成功かつ DB保存後に成功応答 |
| 文脈 | 今回の質問のみ |
| 再送 | 自動再試行しない |
| 公開 | Production 標準停止。Local / 保護 Preview でデモ |

## 8 未決事項

| 項目 | 担当 | 時期 |
|---|---|---|
| 講師指定の `GEMINI_MODEL` と `@google/genai` 版 | 講師 | 実装 TASK-04 前 |
| Preview 保護の具体手順 | 学生＋講師 | Preview 公開前 |
| 授業後の履歴削除日 | 講師 | 指定があれば追記 |

推測でモデル ID や SDK 版は確定しない。
