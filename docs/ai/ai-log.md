# AI質問アプリ AI活用記録

## 工程：STEP 0 現状調査（2026-11-04）

### AIへの依頼
既存 Express／TypeScript プロジェクトの現状調査のみ（ファイル変更なし）。`.env` は読まない。

### 実際に確認したこと（推測と区別）

#### 1. 起動方法と構成
- `package.json` の scripts：`dev` = `tsx watch ./index.ts`、`build` = `tsc`、`start` = `node ./dist/index.js`
- 依存：`express`、`ejs`、`pg`、`dotenv`（Gemini SDK は未導入）
- `tsconfig.json`：`outDir` は `./dist`
- `db.ts`：`DATABASE_URL` 必須。`Pool` の `max: 2`
- `.gitignore` に `.env` / `.env.*` あり（存在確認のみ。中身は未読）

#### 2. AI機能の追加先（授業テキストの目安）
- 画面：`/ai`
- API：`POST /api/ai/ask`、`GET /api/ai/history`
- コード：`src/apps/ai/`
- SQL：`sql/ai/030_create_ai_qa_logs.sql`
- 文書：`docs/ai/`

#### 3. 壊してはいけない既存機能
`GET /`、`GET /api/db-check`、`GET /db-sample`、`GET /todo`、`/api/v1/todos`

### 判断
- ブランチ `feature/ai-app` を作成
- 要望書配置後に STEP 1 へ

---

## 工程：STEP 1〜4 文書（2026-11-11）

### 実施
- 講師配布相当の要望を `docs/ai/request.md` に配置
- `requirements.md` / `spec.md` / `tasks.md` を作成
- Gemini を採用方針とし、モデル ID・SDK 版は講師指定待ち（推測で確定しない）

---

## 工程：TASK-01〜03 実装（2026-11-11）

### AIへの依頼
要件・設計に沿い、デモ停止・履歴 API・模擬回答での保存・`/ai` 画面まで実装。既存 TOP/TODO/db-check/db-sample を壊さない。

### 実施内容
- `src/apps/ai/`（Router / Controller / Service / Model / Middleware / Error）
- `views/ai/index.ejs` + `public/js/ai.js`（`public/ai` は `/ai` 衝突回避のため未使用）
- `sql/ai/030_create_ai_qa_logs.sql`
- `index.ts`：`/api/ai` に 16KiB JSON・デモ停止・ルータ、`GET /ai`
- 模擬回答：`GEMINI_API_KEY` 未設定または `AI_USE_MOCK=true` のとき

### 次の人手作業（当時）
1. Neon で `030_create_ai_qa_logs.sql` を実行
2. ローカル `.env` に `AI_DEMO_ENABLED=true`

---

## 工程：TASK-04 実 Gemini 接続（2026-11-11）

### AIへの依頼
模擬回答を `@google/genai` の実呼び出しへ置き換え。キー値は読まない・表示しない。

### 実施内容
- 依存：`@google/genai`
- `aiService.ts`：`GEMINI_API_KEY` / `GEMINI_MODEL`、timeout 30秒、再試行 attempts=1、maxOutputTokens=1024
- 今回の質問のみ送信。空回答は失敗
- 模擬回答パスを削除

### 学生確認
- `gemini-1.5-flash` / `2.0-flash` は API 側で不可 → 利用可能な `gemini-3.5-flash-lite` に変更して 201 を確認
- ローカルで `/ai` から質問し、DB保存・履歴再取得を確認する

---

## 工程：TASK-05〜07・文書整備（2026-11-11）

### 実施
- UI：`views/ai` + `public/js/ai.js`（textContent・busy・45秒・1〜2000）
- `docs/ai/test-results.md` に必須テストの実測を記録（未実施は未実施のまま）
- `docs/ai/working_report.md`・README の AI 節を更新

### 次
- commit / push → Preview・PR → Production は停止のまま確認（TASK-08）
