# リアルタイムチャット 実装手順書（`docs/chat/04_implementation.md`）

入力: `02_requirements.md`・`03_design.md`、既存コード（`index.ts`・`db.ts`・`package.json`・`src/apps/todo/`）
ブランチ: `feature/chat`（`feature/ai-app-v2` の `4713bbd` から作成）
記録日: 2026-11-25

実行場所はすべて**プロジェクトのルート**（`package.json` がある場所）。

---

## A. 既存アプリの確認・Socket.IO 追加・`/chat` と接続ログ

| 項目 | 内容 |
|---|---|
| 目的 | 既存機能が動く状態で、`/chat` と Socket.IO の接続だけを先に通す |
| 対応 | REQ-CHAT-001, 011 / DES-CHAT-001 |
| 変更ファイル | `package.json`、`index.ts`、`tsconfig.json`、`src/apps/chat/chatRouter.ts`・`chatController.ts`、`views/chat/index.ejs`、`views/index.ejs` |

手順

1. `npm run dev` で起動し、`/`・`/todo`・`/ai`・`/ai/v2`・`/api/db-check` が従来どおり表示されることを確認する。
2. `git checkout -b feature/chat`
3. `npm install socket.io`（検証スクリプト用に `npm install -D socket.io-client`）
4. `index.ts` で `app.listen` の戻り値に Socket.IO をつなぐ（新しく `listen` しない）。

```ts
const httpServer = app.listen(port, () => console.log(`Server started: http://localhost:${port}`));
if (!process.env.VERCEL && httpServer) {
  const io = new SocketIOServer(httpServer);
  attachChat(io);            // src/apps/chat/chatService.ts
}
```

5. `app.use(chatRouter)` を **`express.static` より前**に登録する。`public/chat/` フォルダがあるため、後ろにすると static が `/chat` を `/chat/` にリダイレクトする。
6. `tsconfig.json` の `include` に `src/apps/chat/**/*.ts` を追加する（ないと `npm run build` で chat が出力されない）。
7. ポートは `Number(process.env.PORT) || 3000` にする（2台検証で `PORT=3001` を使う）。

確認

- `GET /chat` が 200、`/socket.io/socket.io.js` が 200。
- 開発者ツールの Network で `socket.io/?EIO=4&transport=...` の通信があり、WS 欄で `chat:join` などのフレームが見える。

つまずいたとき

- `/chat` が 404 → `chatRouter` を `app.use` したか、登録位置が 404 より前か。
- `/chat/` にリダイレクトされる → `chatRouter` が `express.static` より後ろにある。
- 画面は出るのに接続できない → `/socket.io/socket.io.js` が 404 なら Socket.IO が HTTP サーバーにつながっていない。

---

## B. SQL 適用・Model（保存と最新20件）

| 項目 | 内容 |
|---|---|
| 目的 | 投稿の保存・取得と、席テーブルを用意する |
| 対応 | REQ-CHAT-004, 005, 007 / DES-CHAT-003 |
| 変更ファイル | `sql/chat/050_create_chat_tables.sql`、`src/apps/chat/chatModel.ts` |

手順

1. 既存 SQL 番号（000/010/020/030/040）を確認し、`050` を使う。
2. Neon の SQL Editor（または `pg` での実行）で `sql/chat/050_create_chat_tables.sql` を実行する。`IF NOT EXISTS` なので再実行しても壊れない。
3. Model の最新20件は「新しい順に20件選ぶ → 外側で古い順に並べ替える」。

```sql
SELECT ... FROM (SELECT ... WHERE room_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2) latest
ORDER BY created_at ASC, id ASC
```

確認

- `chat_rooms`・`chat_messages`・`chat_room_seats` の3テーブルがあり、`chat_rooms` に `('lobby', 5)`。
- `GET /api/chat/status` が `{"status":"success","data":{"roomId":"lobby","capacity":5,"occupied":0}}`。

つまずいたとき：`relation "chat_rooms" does not exist` → SQL を適用した DB と `.env` の `DATABASE_URL` の接続先が同じか。

---

## C. 投稿フォーム・サーバー検証・保存後の配信・2タブ確認

| 項目 | 内容 |
|---|---|
| 目的 | 送信→検証→保存→同じルームへ配信の流れを通す |
| 対応 | REQ-CHAT-002, 003, 009, 011 / DES-CHAT-002, 004, 006 |
| 変更ファイル | `src/apps/chat/chatService.ts`、`public/chat/chat.js`、`views/chat/index.ejs` |

手順

1. `chatService.ts` に `validateMessageInput`（型→trim→文字数）を作る。
2. `chat:send` は「入室済み確認 → 検証 → `ChatModel.insertMessage` → `io.to('lobby').emit('chat:message')` → ack」の順。保存に失敗したら配信しない。
3. `chat.js` は一覧への追加を `chat:message` の受信時だけ行い、`shownIds` で重複を除く。描画は `textContent` のみ。
4. 送信前に `socket.connected && joined` を確認する（切断中の emit は Socket.IO が溜めて再接続後に送ってしまう）。

確認：タブ A・B で `/chat` を開き、A から送ると A・B に同じ投稿が各1件。B から送っても同様。`chat_messages` は送信1回で1行。

つまずいたとき：片方にしか出ない → 両タブの状態表示が「入室中」か、イベント名が `chat:message` で一致しているか、配信先が `io.to(ROOM_ID)` か。

---

## D. 5人制限・切断時の席解放・再入室と履歴同期・例外表示

| 項目 | 内容 |
|---|---|
| 目的 | 定員と切断復帰、エラー表示を仕上げる |
| 対応 | REQ-CHAT-005, 007, 008, 010 / DES-CHAT-004, 005 |
| 変更ファイル | `chatModel.ts`（`reserveSeat`・`releaseSeat`・`heartbeat`）、`chatService.ts`、`chat.js` |

手順

1. `reserveSeat` はトランザクション内で `chat_rooms` 行を `FOR UPDATE` でロックし、期限切れ席の削除・件数確認・INSERT を行う。
2. `chat:join` は「席確保 → `socket.join` → 履歴取得 → ack」。満席なら `ROOM_FULL` を返し、ルームに参加させない。
3. `disconnect` で `releaseSeat`。
4. ハートビート（10秒）は「入室済み＋入室処理中」の Socket の席を更新し、それ以外の自インスタンスの席は確保から15秒以上たったものだけ消す。
   - 初版は「入室済み」だけを対象にしていたため、確保直後の席を消してしまい、2台同時入室で6人目が入れる不具合が出た（`06_test_results.md` 参照）。
5. `chat.js` はリスナーを最初に1回だけ登録し、`connect` のたびに `join()` を呼ぶ。入室処理中に届いた新着はバッファし、履歴と ID で統合する。

確認：6つ目の接続で満席表示、1つ閉じて「再試行」で入室。サーバーを止めると「サーバーに接続できません…」、再起動で自動入室し、切断中の投稿が履歴に1件出る。

つまずいたとき

- 席が減らない → サーバーログに「席の解放に失敗」がないか。`chat_room_seats` を直接確認する。
- 強制終了したプロセスの席は30秒後の入室判定で回収される（それまで満席になることがある）。

---

## E. 複数インスタンス同期・共有定員・回帰確認

| 項目 | 内容 |
|---|---|
| 目的 | 2プロセスで新着と定員が共有されることを確かめる |
| 対応 | REQ-CHAT-006, 007, 011 / DES-CHAT-005 |
| 変更ファイル | `chatService.ts`（DB 同期ポーリング）、`tests/chat/socket-check.mjs` |

手順

1. 各インスタンスが2秒ごとに `id > (配信済み最大ID − 20)` の投稿を取得し、未配信のものだけ配信する。
2. 2プロセスを起動する（PowerShell の場合）。

```powershell
$env:PORT=3000; npx tsx index.ts
```

```powershell
$env:PORT=3001; npx tsx index.ts
```

（Git Bash なら `PORT=3000 npx tsx index.ts` と `PORT=3001 npx tsx index.ts` を別ターミナルで）

3. DB 障害の確認用に、接続できない DB を指定した3台目を起動する（任意）。

```powershell
$env:PORT=3002; $env:DATABASE_URL="postgresql://u:p@127.0.0.1:1/x"; npx tsx index.ts
```

4. 検証スクリプトを実行する。

```powershell
$env:CHAT_URL_BADDB="http://localhost:3002"; node tests/chat/socket-check.mjs
```

5. 回帰：`/`・`/todo`・`/api/v1/todos`・`/ai`・`/ai/v2`・`/api/db-check`・存在しない URL（404）・JSON 破損（400）。
6. `npm run build` が通ること。

確認：スクリプトが `13/13 passed`。3000 と 3001 の画面同士で投稿が届く。

---

## 環境変数（名前のみ）

| 名前 | 用途 |
|---|---|
| `DATABASE_URL` | 既存。チャットも `db.ts` の `pool` を共有 |
| `PORT` | 任意。未設定なら 3000 |

`DATABASE_URL_POOLED`・`REDIS_URL` は使わない（DB 同期方式のため）。
