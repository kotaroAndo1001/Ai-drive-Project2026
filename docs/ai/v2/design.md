# AI対話アプリ V2 設計書

根拠: `docs/ai/v2/requirements.md` と本リポジトリの V1 構成。

## 1. 設計一覧

| 設計ID | 対応REQ | 概要 |
|---|---|---|
| DES-V2-01 | 01・02 | `/ai/v2` に一覧・新規・履歴・質問。通信中は連打抑止。描画は textContent |
| DES-V2-02 | 01・02・05 | `/api/ai/v2/conversations` GET/POST、`/:id/turns` GET/POST。0件は `items:[]`。不正400、無し404 |
| DES-V2-03 | 02〜05 | テーブル `ai_conversations` / `ai_conversation_turns`。会話IDで絞り、最新N件を ID 降順取得して古い順へ戻す |
| DES-V2-04 | 03〜05 | 検証→履歴5往復→user/model組立→Gemini→1往復保存→201。空・失敗は保存しない |
| DES-V2-05 | 06 | V2を V1 と分離。`AI_DEMO_ENABLED` で V2 API 全体を停止（503）。DB/Gemini設定は既存を利用 |

## 2. ファイル

```
src/apps/ai/v2/          # Router / Controller / Service / Model / Middleware
views/ai/v2/index.ejs
public/js/ai-v2.js
sql/ai/040_create_ai_conversations.sql
docs/ai/v2/
index.ts                 # /api/ai/v2 と GET /ai/v2 を追加（V1は維持）
```

## 3. API（DES-V2-02）

| メソッド | URL | 成功 | 備考 |
|---|---|---|---|
| GET | `/api/ai/v2/conversations` | 200 `{ success, items }` | 新しい更新順 |
| POST | `/api/ai/v2/conversations` | 201 `{ success, item }` | body `{ title }` |
| GET | `/api/ai/v2/conversations/:id/turns` | 200 `{ success, items }` | 最新20・古い順 |
| POST | `/api/ai/v2/conversations/:id/turns` | 201 `{ success, item }` | body `{ prompt }` |

公開DTO: `id`, `title`, `createdAt` / 往復は `id`, `prompt`, `response`, `createdAt`。

デモ停止時: 上記すべて 503（`DEMO_DISABLED`）。

## 4. DB（DES-V2-03）

```sql
ai_conversations(id, title, created_at)
ai_conversation_turns(id, conversation_id FK, prompt, response_text, created_at)
```

- 一覧: `created_at DESC, id DESC`
- 履歴表示: 会話ID固定、`id DESC LIMIT 20` の後に古い順
- 文脈: 同様に `LIMIT 5` を古い順へ

## 5. 送信処理（DES-V2-04）

1. デモ停止・JSON・会話ID・prompt 検証
2. 会話存在確認（無ければ404、Geminiしない）
3. 同会話の最新5往復取得→ `[user, model, ...]` ＋今回 `user`
4. Gemini（既存キー・モデル）。空なら失敗
5. 1往復 INSERT。失敗なら201にしない
6. 201 と保存した往復

## 6. 画面（DES-V2-01）

- 会話一覧・新規タイトル・履歴・質問欄
- 再読込後は一覧再取得→選択して turns 再取得
- 失敗時は質問を消さない。finally で操作復帰
