# AI対話アプリ V2 テスト結果

対象ブランチ: `feature/ai-app-v2`  
対象環境: Local（http://localhost:3000）  
記録日: 2026-11-18  
秘密値は記載しない。

| テストID | 対象環境 | 操作 | 期待結果 | 実測 | 判定 |
|---|---|---|---|---|---|
| T-V2-01 | Local | 会話A・Bを作成 | 201・一覧に2件 | id=1「会話A」、id=2「会話B」 | 合格 |
| T-V2-02 | Local | Aの空履歴 GET | 200・`items:[]` | 200・空配列 | 合格 |
| T-V2-03 | Local | Aで合言葉送信→追加質問 | 2回目 roles=`user,model,user`・合言葉を踏まえる | debug.roles 一致。回答「しろくま47です。」 | 合格 |
| T-V2-04 | Local | B初回に同じ追加質問 | roles=`user` のみ・Aの合言葉を知らない | debug.roles=`["user"]`。知らない旨の回答 | 合格 |
| T-V2-05 | Local | 存在しない会話 turns | 404 | 404・`NOT_FOUND` | 合格 |
| T-V2-06 | Local | V1 history / TODO | 従来どおり | history 200、`/todo` 200 | 合格 |
| T-V2-07 | Local | `/ai/v2` 画面 | 一覧・切替・送信 | 実装済み。ブラウザ手動の最終確認は本人 | 一部確認 |
| T-V2-08 | Local | `AI_DEMO_ENABLED=false` で V2 API | 503 | 503・`DEMO_DISABLED`。画面 `/` `/todo` `/ai/v2` は 200 | 合格 |

## SQL

| ファイル | 結果 |
|---|---|
| `sql/ai/040_create_ai_conversations.sql` | Neon に作成成功（2026-11-18） |

## 未実施・次

- ブラウザでの再読込・A→B→A 切替の本人確認
- Preview / Production 提出用確認（任意）
