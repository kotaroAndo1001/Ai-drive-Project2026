# リアルタイムチャット 設計書（`docs/chat/03_design.md`）

入力: `01_request.md`、`02_requirements.md`（REQ-CHAT-001〜011）、既存コード（`index.ts`・`db.ts`・`src/apps/todo/`）
記録日: 2026-11-25

---

## 1. 設計項目と要件の対応

| 設計ID | 対応要件 | 内容 |
|---|---|---|
| DES-CHAT-001 | REQ-CHAT-001, 011 | ファイル責務、URL、`index.ts` への登録順、既存処理への影響 |
| DES-CHAT-002 | REQ-CHAT-001〜003, 007〜010 | HTTP API と Socket イベントの契約（接続と入室の区別、ack） |
| DES-CHAT-003 | REQ-CHAT-004〜007 | テーブル・制約・インデックス・SQL |
| DES-CHAT-004 | REQ-CHAT-003, 005, 010 | 入室→履歴→投稿→配信→切断→再入室の順序、履歴と新着の統合、リスナー管理 |
| DES-CHAT-005 | REQ-CHAT-006〜008 | 定員管理（全台共通の DB 席テーブル）、席回収、複数台の新着同期 |
| DES-CHAT-006 | REQ-CHAT-009〜011 | 入力検証、XSS、環境変数、HTTP/Socket の例外処理 |

---

## 2. DES-CHAT-001 ファイル責務・URL・登録順

### 2.1 ファイルと責務

| ファイル | 責務 |
|---|---|
| `src/apps/chat/chatRouter.ts` | `GET /chat`（画面）と `GET /api/chat/status`（定員状況）のルート定義のみ |
| `src/apps/chat/chatController.ts` | HTTP の入口。画面描画、状況 API の応答、DB 障害時の 503 |
| `src/apps/chat/chatService.ts` | Socket.IO のイベント処理（入室・投稿・切断）、入力検証、配信、ハートビート、DB 同期ポーリング |
| `src/apps/chat/chatModel.ts` | `chat_messages`・`chat_room_seats`・`chat_rooms` への SQL（すべてパラメータ化） |
| `views/chat/index.ejs` | 画面の骨組み（状態表示・満席案内・一覧・フォーム）。利用者入力は出力しない |
| `public/chat/chat.js` | 接続・入室・送信・受信、一覧描画（`textContent`）、再接続時の再入室 |
| `sql/chat/050_create_chat_tables.sql` | テーブル作成（既存の 040 と重ならない番号） |
| `index.ts` | ルーター登録、`app.listen` が返す HTTP サーバーへの Socket.IO 接続 |
| `views/index.ejs` | TOP に `/chat` へのリンクを追加 |
| `tsconfig.json` | `include` に `src/apps/chat/**/*.ts` を追加 |

既存 TODO と同じく Router → Controller → Model の流れにし、Socket の処理は Service に置く。

### 2.2 URL と登録順

| URL | 種別 | 登録位置 |
|---|---|---|
| `GET /chat` | EJS 画面 | `express.static` **より前**（`public/chat/` フォルダがあるため、static が `/chat` → `/chat/` へリダイレクトするのを避ける） |
| `GET /api/chat/status` | JSON | 同上（chatRouter にまとめる） |
| `/chat/chat.js` | 静的ファイル | 既存の `express.static(public)` で配信 |
| `/socket.io/*` | Socket.IO | Socket.IO サーバーが HTTP サーバーに直接応答（Express を通らない） |

- 既存ルートと重なる URL はない。Express 既定の 404 と、JSON 破損用エラーハンドラーは変更しない。
- Socket.IO は `app.listen(port)` の戻り値（`http.Server`）に `new Server(httpServer)` で接続する。同じポートで二重に listen しない。
- Vercel 上（`process.env.VERCEL` が設定されているとき）は Socket.IO を接続しない。画面は表示され、接続失敗の案内が出る。

---

## 3. DES-CHAT-002 HTTP と Socket の契約

### 3.1 HTTP

| メソッド・パス | 認可 | 成功 | 失敗 |
|---|---|---|---|
| `GET /chat` | なし | 200 HTML | 描画失敗は Express 既定のエラー処理 |
| `GET /api/chat/status` | なし（履歴は返さない） | 200 `{status:"success",data:{roomId,capacity,occupied}}` | 503 `{status:"error",code:"UNAVAILABLE",message}` |

履歴は HTTP では返さない。**履歴は入室を許可した Socket の ack でだけ返す**ので、満席の接続や未入室の利用者は HTTP からも履歴を読めない。

### 3.2 Socket イベント

「接続（connect）」と「入室（chat:join の成功）」を区別する。接続しただけの Socket はルームに参加しておらず、配信も履歴も届かない。

| イベント | 方向 | payload | ack（応答） |
|---|---|---|---|
| `chat:join` | ブラウザ→サーバー | なし | 成功 `{ok:true, roomId, capacity, occupied, messages: ChatMessage[]}`<br>満席 `{ok:false, code:"ROOM_FULL", message, capacity, occupied}`<br>障害 `{ok:false, code:"UNAVAILABLE", message}` |
| `chat:send` | ブラウザ→サーバー | `{username, comment}` | 成功 `{ok:true, message: ChatMessage}`<br>未入室 `{ok:false, code:"NOT_JOINED", message}`<br>不正 `{ok:false, code:"VALIDATION_ERROR", message, details:[{field, issue}]}`<br>障害 `{ok:false, code:"UNAVAILABLE", message}` |
| `chat:message` | サーバー→同じルームの入室者 | `ChatMessage` | なし |

`ChatMessage = { id: number, username: string, comment: string, createdAt: string(ISO) }`

- ack 関数がない・関数でない呼び出しは無視する（サーバーは例外を出さない）。
- ブラウザは `socket.timeout(8000).emit(...)` で ack を待ち、時間切れを「結果不明」として扱う。

---

## 4. DES-CHAT-003 データベース

### 4.1 テーブル

```sql
chat_rooms (
  room_id    TEXT PRIMARY KEY,                       -- 'lobby'
  capacity   INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
chat_messages (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id    TEXT NOT NULL REFERENCES chat_rooms(room_id),
  username   TEXT NOT NULL CHECK (char_length(username) BETWEEN 1 AND 50),
  comment    TEXT NOT NULL CHECK (char_length(comment)  BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
INDEX chat_messages_room_created_idx ON chat_messages (room_id, created_at DESC, id DESC)
INDEX chat_messages_room_id_idx      ON chat_messages (room_id, id)
chat_room_seats (
  socket_id    TEXT PRIMARY KEY,
  room_id      TEXT NOT NULL REFERENCES chat_rooms(room_id),
  instance_id  TEXT NOT NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
INDEX chat_room_seats_room_idx ON chat_room_seats (room_id, last_seen_at)
```

`chat_rooms` に `('lobby', 5)` を1行入れる。DB の CHECK 制約はサーバー検証が漏れたときの最後の防御。

### 4.2 最新20件を古い順に

```sql
SELECT id, username, comment, created_at FROM (
  SELECT id, username, comment, created_at FROM chat_messages
  WHERE room_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2
) latest ORDER BY created_at ASC, id ASC
```

### 4.3 保存

```sql
INSERT INTO chat_messages (room_id, username, comment) VALUES ($1, $2, $3)
RETURNING id, username, comment, created_at
```

すべて `pool.query(sql, params)` のパラメータで渡し、文字列連結しない。

---

## 5. DES-CHAT-004 処理の順序

### 5.1 入室

1. ブラウザ: `connect` イベント → `chat:join` を送る。入室処理中フラグを立て、届いた `chat:message` はバッファにためる。
2. サーバー: 同じ Socket で入室処理中・入室済みなら現在の結果を返す（二重入室しない）。
3. サーバー: 席を確保（DES-CHAT-005 のトランザクション）。満席なら `ROOM_FULL` を返して終了（ルームに参加させない）。
4. サーバー: 確保後に Socket が既に切断されていたら席を解放して終了。
5. サーバー: `socket.join('lobby')` → 最新20件を取得 → ack で返す。
   **先にルームへ参加してから履歴を取る**ので、取得中に保存された投稿は「履歴」と「新着」の少なくとも一方に必ず入る。
6. 履歴取得に失敗したら、ルームから外し席を解放して `UNAVAILABLE` を返す。画面は再試行ボタンを出す。
7. ブラウザ: 履歴とバッファを投稿 ID で統合し、`createdAt`→`id` の順に並べて一覧を描き直す。

### 5.2 投稿

1. ブラウザ: 接続中かつ入室済みでなければ送らない（Socket.IO は切断中の emit をためて再接続後に送るため、明示的に止める）。
2. サーバー: 入室済み確認 → 検証 → 保存 → `io.to('lobby').emit('chat:message', msg)` → ack。
3. ブラウザ: 一覧への追加は `chat:message` 受信時のみ。ID が表示済みなら追加しない。ack 成功でコメント欄を空にする。

### 5.3 切断・再入室

- サーバー: `disconnect` で席を解放する（入室済みでなくても該当行を削除してよい）。
- ブラウザ: `disconnect` で入室済みフラグを下ろし、フォームを無効化して「再接続中」を表示。Socket.IO の自動再接続で `connect` が再度発生したら 5.1 からやり直す（新しい socket.id で新しい席を取る）。
- リスナー（`connect`・`disconnect`・`chat:message` など）は**ページ読み込み時に1回だけ登録**する。`connect` の中で `on` を呼ばないので、再接続してもリスナーは増えない。
- 切断中に他人が投稿した分は、再入室時の最新20件で取り戻す。

---

## 6. DES-CHAT-005 定員管理と複数台

### 6.1 席の確保（1台でも複数台でも同じ方式）

メモリではなく共有 DB の `chat_room_seats` で席を数える。1台でも複数台でも同じコードで、全台合計5を守る。

```sql
BEGIN;
SELECT capacity FROM chat_rooms WHERE room_id = $1 FOR UPDATE;   -- ルーム行をロック（同時入室を直列化）
DELETE FROM chat_room_seats
  WHERE room_id = $1 AND last_seen_at < NOW() - INTERVAL '30 seconds';  -- 期限切れの席を回収
SELECT COUNT(*) FROM chat_room_seats WHERE room_id = $1;
-- 件数 >= capacity なら COMMIT して満席を返す
INSERT INTO chat_room_seats (socket_id, room_id, instance_id) VALUES ($2, $1, $3);
COMMIT;
```

- ルーム行のロックにより、2台から同時に入室要求が来ても「数える→確保」は1件ずつ行われ、5席目を取れるのは1件だけ。
- 例外時は ROLLBACK し、接続（PoolClient）を必ず解放する。

### 6.2 席の解放と回収

| 状況 | 処理 |
|---|---|
| 切断・タブを閉じる | `disconnect` で `DELETE ... WHERE socket_id = $1` |
| 入室途中で切断 | 確保後に `socket.connected` を確認して解放 |
| プロセス異常終了 | そのプロセスの席は更新されなくなり、30秒後の入室判定で回収 |
| 解放の DELETE が失敗 | 10秒ごとのハートビートで、自インスタンスの席のうち現在の入室 Socket にないものを削除 |
| 正常終了（SIGINT/SIGTERM） | 自インスタンスの席を削除してから終了 |

ハートビート（10秒ごと、各インスタンス）:

```sql
UPDATE chat_room_seats SET last_seen_at = NOW() WHERE instance_id = $1 AND socket_id = ANY($2);
DELETE FROM chat_room_seats WHERE instance_id = $1 AND NOT (socket_id = ANY($2));
```

`instance_id` は `ホスト名:PID:乱数` で起動ごとに作る。

### 6.3 複数台の新着同期（DB 同期）

Redis Adapter ではなく DB 同期を採用する（追加サービス不要、Neon だけで完結するため）。

- 各インスタンスは2秒ごとに `SELECT ... WHERE room_id=$1 AND id > $2 ORDER BY id LIMIT 100` で新着を取得し、自分のプロセスに入室している Socket へ `chat:message` を配信する。
- 起点 `$2` は「配信済みの最大 ID − 20」。ID の採番順とコミット順が入れ替わっても取りこぼしにくくする。直近に配信した ID の集合（最大1000件）を持ち、同じ投稿は再配信しない。
- 自インスタンスで保存した投稿は保存直後に配信し、ID を配信済み集合に入れる。
- 起動時に最大 ID を読み込み、それより古い投稿は配信しない（入室時の履歴で表示する）。
- ブラウザ側も投稿 ID で重複を除くため、二重に届いても1件表示。
- 反映遅延：別インスタンスの投稿は最大でポーリング間隔（約2秒）遅れる。

### 6.4 障害時の扱い

| 障害 | 扱い |
|---|---|
| DB に接続できず席を確認できない | 入室を許可しない（`UNAVAILABLE`）。定員超過より安全側 |
| ポーリング失敗 | ログを出して次回に再試行。連続失敗時もプロセスは止めない（ログは1分に1回まで） |
| ハートビート失敗 | ログのみ。30秒以上続くと他台から席が回収される可能性がある（その接続は次の再接続で再入室） |

### 6.5 接続先が別の2台を使う確認方法

1. 同じ `.env`（同じ Neon）で `PORT=3000` と `PORT=3001` の2プロセスを起動する。
2. クライアント1は 3000、クライアント2は 3001 に接続し、双方向に投稿が届くことを確認する。
3. 3000 に2接続・3001 に2接続（合計4）入室した状態で、3000 と 3001 から同時に入室要求を送り、成功が1件だけで合計5になることを確認する。

---

## 7. DES-CHAT-006 検証・XSS・秘密情報・例外

### 7.1 入力検証（`chatService.ts` の `validateMessageInput`）

1. payload がオブジェクトでない → `VALIDATION_ERROR`
2. `username`・`comment` が文字列でない → 項目ごとに「文字列で入力してください」
3. `trim()` 後の文字数（`Array.from(s).length`）が 0 → 「入力してください」、上限超 → 「50文字以内／500文字以内で入力してください」
4. 保存するのは `trim()` 後の値

### 7.2 XSS

- `public/chat/chat.js` は `textContent` と `createElement` だけで描画し、`innerHTML` を使わない。
- `views/chat/index.ejs` は利用者入力を出力しない。

### 7.3 秘密情報

- `DATABASE_URL` は既存 `db.ts` が読む。チャットのコードは `pool` を import するだけ。
- 新しい環境変数は `PORT`（任意）のみ。ブラウザに渡す設定値はない。
- エラー応答・ack に SQL や接続先の詳細を含めない（ログにだけ出す）。

### 7.4 例外処理

- HTTP: Controller で try/catch し、DB 障害は 503 JSON。想定外は `next(err)` で Express のエラー処理へ。
- Socket: 各イベントハンドラーを try/catch で包み、`console.error` でログを出し、ack で `UNAVAILABLE` を返す。ハンドラー外に例外を出さない（プロセスを落とさない）。
- `io.engine.on('connection_error')` をログに出す。

---

## 8. 未確定事項と前提

- 前提：ログインはなく、ユーザー名は自己申告。なりすまし対策は対象外。
- 前提：検証は既存の Neon（同じ `DATABASE_URL`）で行う。テスト投稿が残る。
- 未確定：本番（Vercel）でチャットを動かすか（Vercel Functions は WebSocket サーバーを常駐できない）。
- 未確定：利用者が増えた場合の Redis Adapter への移行、古い投稿の保存期間。
