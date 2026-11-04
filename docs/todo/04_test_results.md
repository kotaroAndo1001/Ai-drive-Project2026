# TODOアプリ V1 テスト結果

対象ブランチ / PR: `feature/todo-v1` → `main`（Pull Request #3）  
Production URL: `https://ai-drive-project2026-chi.vercel.app`  
DB: Neon `webapp-class` / ブランチ `production` / DB `neondb`（Preview・Production とも同じ接続先）  
記録日: 2026-11-04  
接続文字列・パスワードは記載しない。

## 1 環境別の画面・API確認

| 確認時点 | `/` | `/api/db-check` | `/todo` | `/api/v1/todos` |
|---|---|---|---|---|
| ローカル | トップページ表示 | `{"status":"ok","database":"connected"}` | 0件時「TODOがありません」。登録後に一覧表示 | 0件時 `{"status":"success","data":[]}`。登録後に1件以上 |
| Preview（マージ前） | Ready の Preview で確認（PR #3 の Vercel Deployment） | 接続確認を実施 | TODO画面を確認 | API応答を確認 |
| Production（マージ前） | 従来どおり表示 | `connected` | `/todo` は未マージのため 404 でよい | ルート未追加のため失敗してよい |
| Production（マージ後） | HTTP 200・トップページ表示 | `{"status":"ok","database":"connected"}` | HTTP 200・TODO画面表示 | `{"status":"success","data":[...]}`（共有DBの登録済みデータ） |

補足: Preview と Production は別URL・別デプロイのコードである。今回の `DATABASE_URL` は同じ Neon を指すため、TODOデータは共有される。

## 2 要件ごとの確認（主にローカル）

| REQ | 操作 | 期待 | 結果 | 判定 |
|---|---|---|---|---|
| REQ-01 | `GET /api/v1/todos`（0件） | 200・`status:success`・`data:[]` | ローカルで確認 | 合格 |
| REQ-01 | `/todo`（0件） | 「TODOがありません」 | ローカルで確認 | 合格 |
| REQ-01 | 1件以上の一覧 | id・title・isDone が表示 | ローカルで「バイト」を登録して確認。Production APIでも同件を確認 | 合格 |
| REQ-02 | 画面から title を登録 | 一覧に増える | ローカルで1件追加成功 | 合格 |
| REQ-03 | 完了チェックの切替 | isDone のみ更新 | ローカル画面で操作可能なことを確認（詳細ステータスは未記録） | 一部確認 |
| REQ-04 | 削除 | 204・一覧から消える | 未実施（要追試） | 未実施 |
| 既存 | `/`・`/api/db-check`・`/db-sample` | 従来どおり | ローカル・Production で `/` と db-check を確認 | 合格 |

## 3 SQL

| 項目 | 内容 |
|---|---|
| ファイル | `sql/todo/020_create_todo_tasks.sql` |
| 実行場所 | Neon SQL Editor（production / neondb） |
| 実行日 | 2026-11-04 |
| 結果 | `CREATE TABLE` 成功。その後 API で 0件取得・登録が可能になった |

Git への SQL 保存だけではテーブルは作られない。Neon での手動実行後にアプリから利用できた。

## 4 発生した問題と対応

| 問題 | 対応 |
|---|---|
| `public/todo/` 配下に JS を置くと `/todo` が静的ディレクトリ扱いになり 301 になる | `public/js/todo.js` に配置し、画面から `/js/todo.js` を読み込む |
| テーブル未作成時は API がエラー | Neon で `020_create_todo_tasks.sql` を実行して解消 |

## 5 未実施・次の確認

- REQ-04 削除の正式記録（204 → 再DELETEで404）
- 不正入力（空 title・101文字・壊れた JSON）の 400 / 422 記録
- Preview URL の具体値を提出物へ転記（必要なら Vercel Deployments から取得）

## 6 提出用リンク

- GitHub: https://github.com/kotaroAndo1001/Ai-drive-Project2026
- PR: https://github.com/kotaroAndo1001/Ai-drive-Project2026/pull/3
- Production: https://ai-drive-project2026-chi.vercel.app
