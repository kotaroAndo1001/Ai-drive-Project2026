# TODOアプリ V1 実装手順書

根拠は `01_requirements.md` と `02_design.md` である。REQ の名前と URL は言い換えない。既存の `index.ts`、`db.ts`、`package.json`、`tsconfig.json` に合わせ、既存ルートは壊さない。1工程ごとに確認する。接続文字列はログや提出物に書かない。

作業ブランチ: `main` を最新にしたあと `feature/todo-v1` を切る（すでに `feature/product-list` で文書を置く場合は、そのブランチ名を記録する）。

## 工程1 SQLファイルを Git に保存する（まだ DB は変えない）

- **対象**: `sql/todo/020_create_todo_tasks.sql`、`sql/README.md`
- **作業**: `todo_tasks` の CREATE 文をファイルに書く。実行記録欄は「未実行」のままにする。
- **確認**: ファイルがリポジトリにあること。Neon の Tables に `todo_tasks` がまだ無くてよい。
- **期待**: push してもテーブルは自動作成されない。
- **失敗時**: ファイルパスと `.gitignore`（`.env` が入っていないこと）。

## 工程2 Neon の SQL Editor で手動実行する

- **対象**: Neon（`production` / `neondb`）。アプリと同じ接続先。
- **作業**: 工程1の SQL を貼って Run する。
- **確認**: Tables に `todo_tasks` がある。`SELECT * FROM todo_tasks` が 0 件。
- **期待**: 空テーブルができる。
- **失敗時**: 接続先ブランチと DB 名。archived なら SQL Editor で Run して起こす。

## 工程3 土台（json・tsconfig・Router の空登録）

- **対象**: `index.ts`、`tsconfig.json`、`src/apps/todo/todoRouter.ts`（空の Router で可）
- **作業**: `express.json()` を `urlencoded` の直後に追加。`include` に `src/apps/todo/**/*.ts`。`app.use('/api/v1/todos', todoRouter)` と `GET /todo` は、画面ファイルができる工程までプレースホルダでもよいが、最終的には設計書の位置（`/db-sample` の後、`listen` の前）。
- **確認**: `npm run build`
- **期待**: コンパイル成功。`/` と `/api/db-check` が従来どおり。
- **失敗時**: `tsc` の最初のエラー。`include` 漏れ。

## 工程4 REQ-01 一覧 API

- **対象**: `todoModel.ts`、`todoController.ts`、`todoRouter.ts`
- **作業**: `GET /` で一覧。0件は 200 と `"data": []`。
- **確認**: `npm run dev` のあと `GET http://localhost:3000/api/v1/todos`
- **期待**: `{ "status": "success", "data": [] }`
- **失敗時**: テーブル有無、`DATABASE_URL`、ターミナルの最初のエラー。接続文字列はコピーしない。
- **完了**: 0件なら `data` が空配列。

## 工程5 REQ-02 登録 API

- **対象**: Model / Controller / Router の `POST /`
- **作業**: trim した title を INSERT。201。空・101文字は 422。壊れた JSON は 400。
- **確認**: 正常 POST、空 POST、長い title、壊れた JSON。続けて GET で件数が増えること。
- **期待**: 要件の完了条件どおり。
- **失敗時**: `express.json()` の有無。400 と 422 の取り違え。

## 工程6 REQ-03 部分更新 API

- **対象**: `PATCH /:id`
- **作業**: `isDone` だけ更新。無い id は 404。
- **確認**: 存在する id、無い id、不正 id。
- **期待**: 完了状態だけ変わる。
- **失敗時**: パスパラメータの型。UPDATE の 0 行を 404 にしているか。

## 工程7 REQ-04 削除 API

- **対象**: `DELETE /:id`
- **作業**: 成功 204 本文なし。2回目は 404。
- **確認**: 1回目 204、2回目 404、GET でその id が無いこと。
- **期待**: 要件の完了条件どおり。
- **失敗時**: 204 で JSON を返していないか。

## 工程8 TodoApi

- **対象**: `public/todo/todo.js`
- **作業**: `list` / `create` / `updateDone` / `remove`。認証ヘッダーは付けない。
- **確認**: ブラウザの開発者ツールで4操作のステータスを見る。
- **期待**: 設計書のメソッドと URL が一致する。
- **失敗時**: パスの先頭 `/api/v1/todos`。DELETE の body を付けていないか。

## 工程9 画面

- **対象**: `views/todo/index.ejs`、`index.ts` の `GET /todo`
- **作業**: 枠だけ描き、一覧は Fetch。0件メッセージ「TODOがありません」。
- **確認**: http://localhost:3000/todo
- **期待**: REQ-01〜04 の画面側受け入れ条件。
- **失敗時**: `views` が `process.cwd()` か。`res.render('todo/index')`。静的ファイル `/todo/todo.js`。

## 工程10 ローカルまとめ

- **確認コマンド**: `npm run build` → `npm run dev`
- **開く**: `/`、`/api/db-check`、`/db-sample`、`/todo`、`/api/v1/todos`
- **期待**: 既存3画面が壊れず、TODO が動く。
- **失敗時**: ターミナル先頭のエラー。既存ルートを消していないか。

## 工程11 Preview

- **作業**: `.env` を含めず commit / push。Vercel の Preview が Ready になるのを待つ。
- **確認**: Preview の `/`、`/api/db-check`、`/todo`、API 4操作。
- **期待**: ローカルと同じ。`todo_tasks` は工程2で共有 DB に作済みなら Preview からも見える。
- **失敗時**: Preview の `DATABASE_URL`。Function Logs の最初のエラー。接続文字列は書き写さない。

## 工程12 Pull Request

- **作業**: base `main`、compare 実装ブランチ。説明に変更内容、ローカル結果、Preview URL、未解決を書く。
- **確認**: 差分に `.env` が無い。SQL・src・views・public・docs がある。
- **期待**: Preview 成功後にマージする。
- **失敗時**: マージ前の本番 `/todo` は 404 でよい（コードがまだ無いため。DB にテーブルが無いという意味ではない）。

## 工程13 Production

- **作業**: マージ後、Production が Ready になってから確認する。
- **確認**: 本番の `/`、`/api/db-check`、`/todo`、API。
- **期待**: REQ-01〜04 が本番でも通る。
- **失敗時**: Production 用 `DATABASE_URL`。Logs の最初のエラー。

## 工程14 テスト結果

- **対象**: `docs/todo/04_test_results.md`（実装後）
- **作業**: ローカル / Preview / Production の表を埋める。
- **確認**: 文書4件目として Git 管理する。
