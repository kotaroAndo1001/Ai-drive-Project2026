# AI質問アプリ 作業報告

- 日付・学籍番号・氏名：（本人記入）
- 対象ブランチ／コミット／PR：`feature/ai-app` / `ef784ea` / PRは作成リンクから開く
- 対象環境：Local（Preview は Vercel デプロイ後）

## 要望から決めたこと

- 既存 TOP・TODO を残し、`/ai` と `/api/ai/*` で質問・履歴を追加する
- 質問は trim 後 1〜2000 コードポイント、履歴は最新20件、成功は AI 取得＋DB保存後のみ
- ログイン・会話記憶・Markdown 表示は標準課題に入れない
- Production では `AI_DEMO_ENABLED` で API を止められるようにする

## AIとの協働

- 依頼：現状調査、要件・設計・tasks、TASK-01〜04 実装、テスト表
- 採用：Gemini（`@google/genai`）、デモ停止ミドルウェア、16KiB JSON、textContent 描画
- 不採用・修正：チャット提案の `@google/generai`（誤記）→ `@google/genai`。`gemini-1.5-flash` は API で不可のため利用可能な `gemini-3.5-flash-lite` に変更
- `/ai` は `public/ai` ではなく `views/ai`＋`public/js/ai.js`（TODO と同様のルート衝突回避）

## 実際に確認したこと

- 正常系：実 Gemini で 201・履歴再取得（T01/T02）
- 0件：表作成直後に 200 / `items:[]`（T03）
- 空白 prompt：400（T04）
- デモ停止：503、TOP・TODO は 200（A02）
- 秘密管理：キーは `.env` のみ。フロントにキーなし（T16）
- 模擬回答と実AI：TASK-03 は模擬、TASK-04 で実APIへ置換（模擬は撤去）

## 未完成・未実施

- Preview 保護・PR・Production 停止の実測
- T12（オフライン）・T13（連打）のブラウザ実測
- 次の1作業：`feature/ai-app` を commit / push し PR を作成する

## 自分の言葉による説明

- APIキーはサーバーの環境変数にあり、ブラウザの JS には渡さない。ブラウザは自作の `/api/ai/ask` にだけ送る
- 順序は入力検証 → Gemini → DB保存 → 201。AI 失敗時は保存しない
- 履歴0件は 200 と空配列（正常）。DB障害は 503 などで区別する
- 画面は textContent で描画し、失敗時も finally で入力・送信を戻す
