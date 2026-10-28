# TODOアプリ V1 要件定義書

根拠は次の3つである。REST API 講義テキスト（完全改訂版）の第4章（ステータス）、第5章（JSON）、第6章（バージョニング。認証は V1 では使わない）。授業資料「20261028 TODOアプリ作成」。既存の `index.ts`、`db.ts`、`package.json`、`tsconfig.json`。接続文字列・パスワード・APIキーは記載しない。

配布の「TODO機能 要件定義書」とチェックリストが手元にあれば、保存前に照合する。差があれば講義テキスト第4〜6章を優先して直す。

## 1 目的・対象範囲

授業用サイトに、架空のTODOを登録・確認・完了・削除できる機能を追加する。対象者は受講者と採点者である。個人情報は扱わず、架空の授業用データだけを使う。

既存構成（確認済み）は次のとおりである。Express 5 + TypeScript + EJS。起動は `npm run dev`（`tsx watch ./index.ts`）。本番相当は `npm run build`（`tsc`）のあと `npm start`（`node ./dist/index.js`）。`db.ts` は `process.env.DATABASE_URL` で `pg` の Pool（`max: 2`）を作る。`index.ts` は `pool` を読み、`views` と `public` を `process.cwd()` から参照する。残すルートは `GET /`、`GET /api/db-check`、`GET /db-sample` である。`/api/db-check` のJSON（`status` / `database`）は変更しない。DB は既存の Neon PostgreSQL、公開先は Vercel。Preview と Production は同じ Neon を参照する。

追加する画面は `/todo`、API は第6章の URI 指定方式に合わせ ` /api/v1/todos` である。画面と API は別URLである。画面は Fetch で API を操作する。`TodoApi` クラスは設計書で扱う。第6章 6.1 の Bearer 認証は V1 に入れない。

V1 の対象は REQ-01 一覧、REQ-02 登録、REQ-03 完了状態の部分更新、REQ-04 削除である。認証、優先度、絞り込み、タイトル更新、PUT による全置換は作らない。完了状態だけを変えるため PATCH を使う（講義第2章）。

`tsconfig.json` の `include` は現状 `["index.ts", "db.ts"]` である。`index.ts` は `express.urlencoded` のみで、`express.json` は未設定である。TODO の JSON API には `express.json` が必要になる。新規ファイルの配置と `todoRouter` の登録位置は設計書で確定する。

## 2 4機能と受け入れ条件

成功JSONとエラーJSONの形は第3節（講義第5章）に従う。

### REQ-01 TODO一覧を取得する

- **操作**: `GET /api/v1/todos`。画面 `/todo` を開いたときに Fetch で呼ぶ。クエリによる絞り込みは V1 対象外（講義第3章のクエリは V2）。
- **入力**: なし。GET に本文は付けない。
- **結果**: HTTP 200。`status` は `"success"`。`data` は TODO の配列。0件なら `data` は `[]`。DB は変更しない（安全なメソッド）。
- **エラー**: DB を使えないときは 503。想定外は 500。
- **受け入れ条件**: 0件なら `data` が空配列で、画面に「TODOがありません」と出る。1件以上なら id・title・完了状態（`isDone`）が画面に出る。
- **確認方法**: ローカル・Preview・Production で `/todo` と `GET /api/v1/todos` を開く。0件と1件以上の両方を見る。
- **完了と言える状態**: データ0件なら GET の `data` が空配列になり、画面に「TODOがありません」と表示される。

### REQ-02 TODOを登録する

- **操作**: `POST /api/v1/todos`。画面の登録操作から Fetch で呼ぶ。
- **入力**: JSON 本文の `title`。前後空白を除いて 1〜100 文字。個人情報は入れない。
- **結果**: HTTP 201 Created。`status` は `"success"`。`data` は登録した1件のオブジェクト。
- **エラー**: JSON が壊れている、必須の `title` が無い、型が違うときは 400。JSON の形は正しいが、空白除去後が空、または 101 文字以上なら 422。DB 利用不可は 503。想定外は 500。
- **受け入れ条件**: 正しい `title` で一覧に1行増える。不正な `title` では行が増えず、API が 400 または 422 を返す。
- **確認方法**: 正常な title、空、101文字、壊れた JSON を POST し、ステータスと一覧を見る。
- **完了と言える状態**: 1〜100文字の title を登録すると一覧に現れ、空や101文字以上では 422 になり行が増えない。

### REQ-03 完了状態を部分更新する

- **操作**: `PATCH /api/v1/todos/:id`。画面の完了操作から Fetch で呼ぶ。タイトルは変えない。
- **入力**: パスの `id` は 1 以上の整数。本文は `{ "isDone": true }` または `{ "isDone": false }` のみ。
- **結果**: 対象があるとき HTTP 200。`status` は `"success"`。`data` は更新後の1件。同じ PATCH を繰り返しても最終状態は同じでよい。
- **エラー**: `id` が 1 以上の整数でない、JSON が壊れている、`isDone` が無いときは 400。`isDone` が真偽値でないときは 422。対象が無いときは 404。DB 利用不可は 503。想定外は 500。
- **受け入れ条件**: 未完了と完了を切り替えられる。無い id では 404 で、他の行は変わらない。
- **確認方法**: 存在する id、存在しない id、`abc` / `0` / 負数の id で PATCH する。
- **完了と言える状態**: 存在する id の完了状態だけが変わり、存在しない id では 404 になる。

### REQ-04 TODOを削除する

- **操作**: `DELETE /api/v1/todos/:id`。画面の削除操作から Fetch で呼ぶ。本文は無し。
- **入力**: パスの `id` は 1 以上の整数。
- **結果**: 対象があるとき HTTP 204、本文なし。2回目以降は 404。サーバー上の最終状態は「その id が無い」で同じである（講義第2章の DELETE と冪等性）。
- **エラー**: `id` が 1 以上の整数でないときは 400。対象が無いときは 404。DB 利用不可は 503。想定外は 500。
- **受け入れ条件**: 削除した行が一覧から消える。無い id では 404 で、他の行は残る。
- **確認方法**: 存在する id を削除して 204 を確認し、同じ id をもう一度 DELETE して 404 を確認する。
- **完了と言える状態**: 削除成功は 204 で本文なし、画面からその件が消え、同じ id の再削除は 404 になる。

## 3 共通のデータ・エラー条件

リソースは名詞・複数形の `/api/v1/todos` である（講義第3章・第6章）。パスの `:id` は対象の指定、検索クエリは V2 である。

JSON キーは camelCase、DB 列は snake_case である。1件の JSON は少なくとも `id`（1以上の整数）、`title`（文字列）、`isDone`（真偽値）を持つ。テーブル名の候補は授業テキストの `todo_tasks` である。列の正式定義と並び順は設計書で決める。

成功レスポンス（講義第5章。204 を除く）:

```json
{
  "status": "success",
  "data": {}
}
```

一覧の `data` は配列である。0件の GET は HTTP 200 と `"data": []` である。1件を返す POST / PATCH の `data` はオブジェクトである。

エラーレスポンス（講義第5章）:

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "入力内容に不備があります。",
  "details": [
    {
      "field": "title",
      "issue": "titleは1〜100文字です。"
    }
  ]
}
```

`code` の例: 400 は `BAD_REQUEST`、422 は `VALIDATION_ERROR`、404 は `NOT_FOUND`、500 は `INTERNAL_ERROR`、503 は `UNAVAILABLE`。`details` が無いエラーでは空配列または省略してよい（設計書で揃える）。エラーやログに接続文字列を出さない。

ステータスの使い分け（講義第4章）: 400 は構文・必須漏れ・型不一致。422 は JSON は正しいが業務ルール（文字数など）を満たさない。404 は対象なし。500 は想定外。503 は DB を使えないとき（既存の `/api/db-check` と同じ判断）。401 / 403 は V1 では使わない。

## 4 環境別の確認方法

| 環境 | 確認すること |
|---|---|
| ローカル | `npm run build` と `npm run dev`。`/`、`/api/db-check`、`/db-sample` が従来どおり動き、`/todo` と `/api/v1/todos` が REQ-01〜04 を満たす。 |
| Preview（マージ前） | ブランチの Preview URL で同じページと API を確認する。SQL を GitHub に置いただけではテーブルはできない。Neon の SQL Editor で同じブランチ・DBへ手動実行したあとで確認する。 |
| Production（マージ前） | 本番に `/todo` が無ければ 404 でよい。同じ Neon を見ていても、未マージなら本番コードに画面も API も無い。 |
| Production（マージ後） | 新しい本番デプロイが Ready になったら `/`、`/api/db-check`、`/todo`、`/api/v1/todos` を確認する。 |

確認データは架空の授業用のみとする。`.env` は GitHub に含めない。テスト結果は実装後に `docs/todo/04_test_results.md` へ書く。

## 5 対象外（V1）

- 第6章 6.1 の認証、401 / 403
- 優先度、絞り込み、タイトル変更、PUT
- 個人情報、Neon 以外の DB、既存ルートの削除や `/api/db-check` のJSON変更
- V2 用 API と追加テーブル

## 6 設計書で決めること

1. `todo_tasks` の列、制約、並び順、`createdAt` を返すかどうか
2. 新規ファイルの配置と、`index.ts` が `todoRouter` を `app.listen` より前の `/api/v1/todos` に登録する位置
3. `tsconfig.json` の `include` に `src/apps/todo/` を足すこと、`express.json` の追加
4. `/todo` の初期HTML（空の枠だけ描き、一覧は Fetch で埋める）
5. 配布のチェックリストとの最終照合
