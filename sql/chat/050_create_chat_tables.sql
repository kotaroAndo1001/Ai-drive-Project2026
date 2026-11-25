-- リアルタイムチャット用テーブル（docs/chat/03_design.md DES-CHAT-003）
-- 何度実行しても同じ結果になるよう IF NOT EXISTS / ON CONFLICT を使う

-- ルームと定員
CREATE TABLE IF NOT EXISTS chat_rooms (
  room_id TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO chat_rooms (room_id, capacity)
VALUES ('lobby', 5)
ON CONFLICT (room_id) DO NOTHING;

-- 投稿
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES chat_rooms(room_id),
  username TEXT NOT NULL CHECK (char_length(username) BETWEEN 1 AND 50),
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
  ON chat_messages (room_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS chat_messages_room_id_idx
  ON chat_messages (room_id, id);

-- 入室中の席（全インスタンスで共有）
CREATE TABLE IF NOT EXISTS chat_room_seats (
  socket_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES chat_rooms(room_id),
  instance_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_room_seats_room_idx
  ON chat_room_seats (room_id, last_seen_at);
