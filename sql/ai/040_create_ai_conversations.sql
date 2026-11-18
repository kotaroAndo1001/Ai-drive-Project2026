-- AI対話アプリ V2（会話・往復）
-- Neon SQL Editor で production / neondb に手動実行する
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_conversation_turns (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations (id),
  prompt TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversation_turns_conv_id_id_desc_idx
  ON ai_conversation_turns (conversation_id, id DESC);
