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

## 起動方法

```
npm ci
npm run build
npm start
```

開発時は `npm run dev` を使います。http://localhost:3000/ を開きます。