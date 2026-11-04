-- 授業用 TODO テーブル（V1）
-- Neon の SQL Editor で production / neondb に手動実行する
CREATE TABLE IF NOT EXISTS todo_tasks (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
