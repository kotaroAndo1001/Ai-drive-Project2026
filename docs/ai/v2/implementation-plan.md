# AI対話アプリ V2 実装手順書

根拠: `requirements.md` / `design.md`。1作業ずつ実装・確認する。

| 作業ID | 対応 | 操作 | 期待 | 次へ進む条件 |
|---|---|---|---|---|
| TASK-V2-01 | REQ-06 / DES-05 | V1で実回答・201・履歴を確認。`feature/ai-app-v2` を作成 | V1疎通を記録 | ブランチ作成済み・V1確認済み |
| TASK-V2-02 | REQ-01・02 / DES-02・03 | `040` SQL と会話作成・一覧・空履歴 API | A・B作成、各 turns が `items:[]` | 両会話IDを記録できる |
| TASK-V2-03 | REQ-03〜05 / DES-03・04 | 文脈付き送信・保存。模擬または実API | A2回目が user,model,user。B初回が user。201と保存 | 文脈組立と保存を確認 |
| TASK-V2-04 | REQ-01・02・05 / DES-01 | `/ai/v2` 画面 | A→B→A切替、再読込再開、失敗時入力保持 | 画面操作で確認 |
| TASK-V2-05 | REQ-01〜06 | `test-results.md` に実測。404/失敗/503/V1回帰 | 表に記録 | 提出用URLを添える |

## テスト記録の書式

`テストID／対象環境／操作／期待結果／実測／判定`

例: T-V2-02 … B初回の送信 contents が今回の質問のみ（回答文だけでなく組立内容も確認）。

## 進捗

- TASK-V2-01: 完了（`feature/ai-app-v2`。V1は実 Gemini 201 確認済み）
- TASK-V2-02: 完了（SQL・会話API・空履歴）
- TASK-V2-03: 完了（文脈組立・保存。A2回目 user,model,user / B初回 user）
- TASK-V2-04: 完了（`/ai/v2` 画面）
- TASK-V2-05: `test-results.md` に記録（404・デモ停止503済み。画面切替の最終確認は本人）
