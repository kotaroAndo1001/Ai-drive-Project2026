# TODOアプリ V1 設計書

`docs/todo/01_requirements.md` の REQ-01〜REQ-04 は変更せず参照する。既存の `/`、`/api/db-check`、`/db-sample` と `db.ts` の Pool は残す。`index.ts` の追記は最低限にする。

## 1 作るものとファイルの役割

```
プロジェクト直下/
├── index.ts                 既存ルートを残し、JSONパーサ・/todo・todoRouter だけ足す
├── db.ts                    既存の Pool。TODO からも同じ pool を使う
├── public/todo/todo.js      TodoApi と画面操作（Fetch）
├── views/todo/index.ejs     /todo の枠。一覧は Fetch で埋める
├── src/apps/todo/
│   ├── todoRouter.ts        URL と HTTP メソッドの割り当て
│   ├── todoController.ts    入力チェックと JSON 応答
│   └── todoModel.ts         SQL。JSON は camelCase、列は snake_case
├── sql/todo/020_create_todo_tasks.sql
└── docs/todo/               本シリーズの文書
```

| ファイル | 役割 |
|---|---|
| `todoRouter.ts` | `GET /` `POST /` `PATCH /:id` `DELETE /:id`（マウント先は `/api/v1/todos`） |
| `todoController.ts` | 400 / 422 / 404 の判定。成功JSON。Model の例外を 500 / 503 に分ける |
| `todoModel.ts` | `todo_tasks` への SELECT / INSERT / UPDATE / DELETE |
| `views/todo/index.ejs` | 見出し、登録フォーム、空メッセージ、一覧の入れ物、`/todo/todo.js` の読み込み |
| `public/todo/todo.js` | `TodoApi` クラス。ページ読み込み後に一覧取得 |

## 2 リクエストはどこを通るか

```
ブラウザ /todo
  → GET views/todo/index.ejs（一覧データは含めない）
  → TodoApi（Fetch）
      → index.ts の app.use('/api/v1/todos', todoRouter)
          → todoRouter
              → todoController
                  → todoModel
                      → db.ts の pool（DATABASE_URL）
                          → Neon の todo_tasks
```

`index.ts` への追記位置:

1. 既存の `express.urlencoded` の直後に `app.use(express.json())` を足す。
2. `import { todoRouter } from './src/apps/todo/todoRouter';` を先頭付近に足す。
3. `/db-sample` のあと、`app.listen` より前に次を足す。
   - `app.use('/api/v1/todos', todoRouter);`
   - `app.get('/todo', (_req, res) => { res.render('todo/index'); });`

既存の3ルートは触らない。`tsconfig.json` の `include` に `src/apps/todo/**/*.ts` を足す。

## 3 DBの設計

テーブル名: `todo_tasks`（授業テキスト）。Git に SQL を置いても自動実行されない。Neon の SQL Editor で `production` / `neondb` に手動実行する。

| 列 | 型 | 制約 | JSON |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, IDENTITY | `id` |
| `title` | TEXT | NOT NULL | `title` |
| `is_done` | BOOLEAN | NOT NULL, DEFAULT FALSE | `isDone` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | `createdAt`（ISO 8601） |

並び順は `id ASC`。V1 で使わない列（優先度など）は作らない。

## 4 APIの共通ルール

- プレフィックス: `/api/v1/todos`
- 成功（204以外）: `{ "status": "success", "data": ... }`
- エラー: `{ "status": "error", "code": "...", "message": "...", "details": [] }`
- `code`: 400 `BAD_REQUEST`、422 `VALIDATION_ERROR`、404 `NOT_FOUND`、500 `INTERNAL_ERROR`、503 `UNAVAILABLE`
- `details` が無いときは `[]`
- 接続文字列は返さない。`/api/db-check` のJSONは変えない

## 5.1 REQ-01 TODO一覧を取得する

| 項目 | 内容 |
|---|---|
| メソッド / URL | `GET /api/v1/todos` |
| 本文 | なし |
| 成功 | 200 `{ "status": "success", "data": [ { "id", "title", "isDone", "createdAt" } ] }`。0件は `"data": []` |
| 失敗 | 503 `UNAVAILABLE` / 500 `INTERNAL_ERROR` |
| DB | `SELECT id, title, is_done, created_at FROM todo_tasks ORDER BY id` |
| TodoApi | `list()` |
| 画面 | 0件なら「TODOがありません」。1件以上なら各行を描画 |
| 確認 | `/todo` と `GET /api/v1/todos` |

## 5.2 REQ-02 TODOを登録する

| 項目 | 内容 |
|---|---|
| メソッド / URL | `POST /api/v1/todos` |
| 本文 | `{ "title": "授業の課題" }` |
| 成功 | 201 `{ "status": "success", "data": { "id", "title", "isDone": false, "createdAt" } }` |
| 失敗 | 400 本文破損・`title` 欠如・型不一致。422 空白除去後が空または101文字以上。503 / 500 |
| DB | `INSERT INTO todo_tasks (title) VALUES ($1) RETURNING ...`（`$1` は trim 済み title） |
| TodoApi | `create(title)` |
| 画面 | フォーム送信後に一覧を再取得 |
| 確認 | 正常 title、空、101文字、壊れた JSON |

## 5.3 REQ-03 完了状態を変える

| 項目 | 内容 |
|---|---|
| メソッド / URL | `PATCH /api/v1/todos/:id` |
| 本文 | `{ "isDone": true }` または `{ "isDone": false }` |
| 成功 | 200 `{ "status": "success", "data": { 更新後の1件 } }` |
| 失敗 | 400 `id` 不正・JSON破損・`isDone` 欠如。422 `isDone` が真偽値でない。404 行なし。503 / 500 |
| DB | `UPDATE todo_tasks SET is_done = $1 WHERE id = $2 RETURNING ...`。0行なら 404 |
| TodoApi | `updateDone(id, isDone)` |
| 画面 | チェック変更で PATCH し、その行だけ更新（失敗時は一覧再取得） |
| 確認 | 存在する id、無い id、`abc` / `0` |

## 5.4 REQ-04 TODOを削除する

| 項目 | 内容 |
|---|---|
| メソッド / URL | `DELETE /api/v1/todos/:id` |
| 本文 | なし |
| 成功 | 204、本文なし |
| 失敗 | 400 `id` 不正。404 行なし（2回目の DELETE も含む）。503 / 500 |
| DB | `DELETE FROM todo_tasks WHERE id = $1`。削除0件なら 404 |
| TodoApi | `remove(id)` |
| 画面 | 削除ボタン。204 のあと一覧からその行を外す |
| 確認 | 1回目 204、同じ id の2回目 404 |

## 6 画面とTodoApiの設計

`GET /todo` は EJS の枠だけ返す。TODO配列はサーバから埋め込まない。

`TodoApi`（`public/todo/todo.js`）:

| メソッド | Fetch |
|---|---|
| `list()` | `GET /api/v1/todos` |
| `create(title)` | `POST /api/v1/todos` |
| `updateDone(id, isDone)` | `PATCH /api/v1/todos/:id` |
| `remove(id)` | `DELETE /api/v1/todos/:id` |

画面要素: タイトル入力、登録ボタン、空メッセージ、一覧（title、完了チェック、削除）。個人情報は入力しない。

## 7 エラーはどこで処理するか

| 場所 | 扱うこと |
|---|---|
| Controller | id の整数判定、title / isDone の 400・422。Model が「0件」なら 404 |
| Model | SQL のみ。接続失敗は throw |
| Controller の catch | DB接続系は 503、それ以外は 500。メッセージに接続文字列を含めない |
| TodoApi / 画面 | `status === "error"` または 204 以外を見て、短いメッセージを出す。詳細は出さない |

## 8 実装への注意事項

- 実装前に `sql/todo/020_create_todo_tasks.sql` を Git へ保存する工程と、Neon で実行する工程を分ける
- `npm run build` で `src/apps/todo` が `dist` に出ることを確認する
- V1 で認証ヘッダーは付けない
