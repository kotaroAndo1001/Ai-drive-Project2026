# AI質問アプリ 設計書

根拠: `docs/ai/requirements.md` と既存プロジェクト調査。TASK-01〜03 で実装に反映済み。

## 1 役割分担

| 要素 | 役割 |
|---|---|
| ブラウザ `/ai` | 入力・Fetch・待機表示・安全な文字列描画 |
| Express | 検証・デモ停止・Gemini 呼び出し・DB 保存・JSON 応答 |
| Gemini API | 今回の質問だけから回答生成（サーバーのみ） |
| Neon `ai_qa_logs` | 質問・回答・日時の保存 |

## 2 ファイル構成

```
src/apps/ai/
  aiRouter.ts
  aiController.ts
  aiService.ts      # Gemini 通信（模擬回答切替もここ）
  aiModel.ts        # SQL
  aiMiddleware.ts   # AI_DEMO_ENABLED
  aiError.ts        # 公開用エラーコード
views/ai/index.ejs  # /ai 画面（public/ai は TODO と同様にルート衝突回避で使わない）
public/js/ai.js
sql/ai/030_create_ai_qa_logs.sql
docs/ai/            # 本シリーズ
```

`index.ts` への追記:
- `/api/ai` に `express.json({ limit: 16KiB })` → デモ停止 → `aiRouter` を既存 JSON より前に登録
- `app.get('/ai', ...)` で EJS を返す

## 3 API

### DES-AI-01 `GET /api/ai/history`
- 成功 200: `{ "success": true, "items": [ { "id", "prompt", "response", "createdAt" } ] }`
- 0件も 200・`items: []`
- デモ停止 503: `{ "success": false, "code": "DEMO_DISABLED", ... }`
- DB障害 503 / 500（公開コードのみ）

### DES-AI-02 `POST /api/ai/ask`
- 本文: `{ "prompt": "..." }`
- 成功 201: 保存後の1件（同上の形）
- 400: 空・型不正・JSON破損・16KiB超過
- 422: trim 後長さ違反（1〜2000）
- AI失敗: 安全な 502 等。DB に保存しない
- DB保存失敗: 成功扱いにしない
- デモ停止 503

処理順: デモ停止確認 → JSON/入力検証 →（任意）模擬 or Gemini → DB INSERT → 201

## 4 DB（DES-AI-03）

```sql
CREATE TABLE IF NOT EXISTS ai_qa_logs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 履歴用インデックス（created_at DESC, id DESC）は SQL ファイルで定義
```

公開 DTO: `response_text` → `response`、`created_at` → `createdAt`（ISO 8601）

## 5 画面状態（DES-AI-04）

| 状態 | UI |
|---|---|
| 初期取得中 | 入力・送信を無効 |
| 0件 | 「履歴がありません」 |
| 履歴あり | 新しい順に最大20件 |
| 送信中 | busy / disabled。連打抑止 |
| 成功 | 先頭に追加。質問欄クリア |
| 失敗 | 安全な案内。質問保持。finally で復帰 |

描画は `textContent`。`innerHTML` に質問・回答を入れない。

## 6 環境変数（名前のみ）

| 名前 | 用途 |
|---|---|
| `DATABASE_URL` | 既存 |
| `AI_DEMO_ENABLED` | `true` のときのみ API 有効 |
| `GEMINI_API_KEY` | サーバーのみ |
| `GEMINI_MODEL` | 講師指定後に設定 |

## 7 要件対応

| REQ | DES | 確認 |
|---|---|---|
| F001 | 画面 `/ai` | ブラウザで開く |
| F002 | POST ask | 201 と画面表示 |
| F003/D001 | history + SQL | 再取得一致 |
| F004 | 0件 200 | items:[] |
| F005 | エラー変換 | 固定コード |
| F006 | middleware | 503 |
| N002 | キー非露出 | Network / git diff |
