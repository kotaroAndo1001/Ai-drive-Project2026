import { pool } from '../../../../db';

export type ConversationItem = {
  id: number;
  title: string;
  createdAt: string;
};

export type TurnItem = {
  id: number;
  prompt: string;
  response: string;
  createdAt: string;
};

type ConversationRow = {
  id: number;
  title: string;
  created_at: Date | string;
};

type TurnRow = {
  id: number;
  prompt: string;
  response_text: string;
  created_at: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toConversation(row: ConversationRow): ConversationItem {
  return { id: row.id, title: row.title, createdAt: toIso(row.created_at) };
}

function toTurn(row: TurnRow): TurnItem {
  return {
    id: row.id,
    prompt: row.prompt,
    response: row.response_text,
    createdAt: toIso(row.created_at),
  };
}

export const V2Model = {
  async listConversations(): Promise<ConversationItem[]> {
    const result = await pool.query<ConversationRow>(
      `SELECT id, title, created_at
       FROM ai_conversations
       ORDER BY created_at DESC, id DESC`
    );
    return result.rows.map(toConversation);
  },

  async createConversation(title: string): Promise<ConversationItem> {
    const result = await pool.query<ConversationRow>(
      `INSERT INTO ai_conversations (title)
       VALUES ($1)
       RETURNING id, title, created_at`,
      [title]
    );
    return toConversation(result.rows[0]);
  },

  async findConversation(id: number): Promise<ConversationItem | null> {
    const result = await pool.query<ConversationRow>(
      `SELECT id, title, created_at
       FROM ai_conversations
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? toConversation(result.rows[0]) : null;
  },

  async listLatestTurns(conversationId: number, limit: number): Promise<TurnItem[]> {
    const result = await pool.query<TurnRow>(
      `SELECT id, prompt, response_text, created_at
       FROM ai_conversation_turns
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [conversationId, limit]
    );
    return result.rows.map(toTurn).reverse();
  },

  async insertTurn(
    conversationId: number,
    prompt: string,
    responseText: string
  ): Promise<TurnItem> {
    const result = await pool.query<TurnRow>(
      `INSERT INTO ai_conversation_turns (conversation_id, prompt, response_text)
       VALUES ($1, $2, $3)
       RETURNING id, prompt, response_text, created_at`,
      [conversationId, prompt, responseText]
    );
    return toTurn(result.rows[0]);
  },
};
