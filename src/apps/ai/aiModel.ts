import { pool } from '../../../db';

export type AiHistoryItem = {
  id: number;
  prompt: string;
  response: string;
  createdAt: string;
};

type AiRow = {
  id: number;
  prompt: string;
  response_text: string;
  created_at: Date | string;
};

function toItem(row: AiRow): AiHistoryItem {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    prompt: row.prompt,
    response: row.response_text,
    createdAt,
  };
}

export const AiModel = {
  async listLatest(limit = 20): Promise<AiHistoryItem[]> {
    const result = await pool.query<AiRow>(
      `SELECT id, prompt, response_text, created_at
       FROM ai_qa_logs
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(toItem);
  },

  async insert(prompt: string, responseText: string): Promise<AiHistoryItem> {
    const result = await pool.query<AiRow>(
      `INSERT INTO ai_qa_logs (prompt, response_text)
       VALUES ($1, $2)
       RETURNING id, prompt, response_text, created_at`,
      [prompt, responseText]
    );
    return toItem(result.rows[0]);
  },
};
