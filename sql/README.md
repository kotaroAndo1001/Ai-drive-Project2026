# sql

- `000_check_connection.sql`：接続先を確かめるための読み取り専用SQLです。
- `010_setup_sample_products.sql`：授業用の商品テーブル（products）と商品3件を用意するSQLです。
- NeonのSQL Editorで実行します（GitHubへpushしても自動では実行されません）。
- パスワードや接続文字列は記載しません。

## 実行記録

| 順序 | ファイル | 実行先（Neonブランチ / DB） | 結果 |
|---|---|---|---|
| 1 | `000_check_connection.sql` | webapp-class / production ブランチ / neondb | 接続確認成功（current_database=neondb） |
| 2 | `010_setup_sample_products.sql` | webapp-class / production ブランチ / neondb | 商品3件を確認（2026-10-28） |
