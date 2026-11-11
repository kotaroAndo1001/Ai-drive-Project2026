# AI質問アプリ 実装計画

根拠: `requirements.md` / `spec.md`。1作業ごとに確認してから次へ。

| 作業ID | 内容 | 対応REQ/DES | 次へ進む条件 |
|---|---|---|---|
| TASK-01 | デモ停止ミドルウェアと `/api/ai` 土台 | F006 | `false` で両API 503。TOP・TODO正常 |
| TASK-02 | SQL + 履歴API | F003,F004,D001 | 表作成、有効時 200 と `items:[]` |
| TASK-03 | 模擬回答で保存 | F002 | 実APIなしで 201 と再取得 |
| TASK-04 | 実 Gemini 接続 | F002,N002 | 実AIで保存。模擬を残さない |
| TASK-05 | 履歴UI・0件 | F001,F003,F004 | 再読込で履歴 |
| TASK-06 | 送信UI・待機 | F002,F005 | 遷移なし・連打抑止 |
| TASK-07 | 異常系・回帰 | F005,N003 | テスト表に記録 |
| TASK-08 | Preview・提出 | F006 | Production停止・文書更新 |

進捗: TASK-01〜07 までローカル実装・主要テスト記録済み。TASK-08（commit/push・Preview・PR・Production停止）が残り。
