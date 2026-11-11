-- AI質問履歴（授業用）
-- Neon SQL Editor で production / neondb に手動実行する
CREATE TABLE IF NOT EXISTS ai_qa_logs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_qa_logs_created_at_id_desc_idx
  ON ai_qa_logs (created_at DESC, id DESC);
