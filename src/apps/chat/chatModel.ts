import { pool } from '../../../db';

export const SEAT_EXPIRE_SECONDS = 30;
/** ハートビートで「入室者にない自インスタンスの席」を消すまでの猶予（確保直後の席を守る） */
export const ORPHAN_GRACE_SECONDS = 15;

export type ChatMessage = {
  id: number;
  username: string;
  comment: string;
  createdAt: string;
};

type MessageRow = {
  id: number;
  username: string;
  comment: string;
  created_at: Date | string;
};

export type ReserveResult =
  | { ok: true; capacity: number; occupied: number }
  | { ok: false; reason: 'ROOM_FULL'; capacity: number; occupied: number };

function toMessage(row: MessageRow): ChatMessage {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();
  return {
    id: Number(row.id),
    username: row.username,
    comment: row.comment,
    createdAt,
  };
}

export const ChatModel = {
  /** 投稿を保存し、DBで確定した値を返す */
  async insertMessage(roomId: string, username: string, comment: string): Promise<ChatMessage> {
    const result = await pool.query<MessageRow>(
      `INSERT INTO chat_messages (room_id, username, comment)
       VALUES ($1, $2, $3)
       RETURNING id, username, comment, created_at`,
      [roomId, username, comment]
    );
    return toMessage(result.rows[0]);
  },

  /** 最新 limit 件を選び、古い順に並べて返す */
  async findLatest(roomId: string, limit: number): Promise<ChatMessage[]> {
    const result = await pool.query<MessageRow>(
      `SELECT id, username, comment, created_at FROM (
         SELECT id, username, comment, created_at
         FROM chat_messages
         WHERE room_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2
       ) latest
       ORDER BY created_at ASC, id ASC`,
      [roomId, limit]
    );
    return result.rows.map(toMessage);
  },

  /** 指定IDより大きい投稿を ID 順に返す（複数インスタンスの DB 同期用） */
  async findSince(roomId: string, afterId: number, limit: number): Promise<ChatMessage[]> {
    const result = await pool.query<MessageRow>(
      `SELECT id, username, comment, created_at
       FROM chat_messages
       WHERE room_id = $1 AND id > $2
       ORDER BY id ASC
       LIMIT $3`,
      [roomId, afterId, limit]
    );
    return result.rows.map(toMessage);
  },

  async findMaxId(roomId: string): Promise<number> {
    const result = await pool.query<{ max_id: number | null }>(
      'SELECT MAX(id) AS max_id FROM chat_messages WHERE room_id = $1',
      [roomId]
    );
    return Number(result.rows[0]?.max_id ?? 0);
  },

  /**
   * ルーム行をロックし「期限切れの席の回収→数える→確保」を1トランザクションで行う。
   * 全インスタンスで同じ行をロックするため、同時入室でも定員を超えない。
   */
  async reserveSeat(roomId: string, socketId: string, instanceId: string): Promise<ReserveResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const room = await client.query<{ capacity: number }>(
        'SELECT capacity FROM chat_rooms WHERE room_id = $1 FOR UPDATE',
        [roomId]
      );
      if (room.rows.length === 0) {
        throw new Error(`chat room not found: ${roomId}`);
      }
      const capacity = Number(room.rows[0].capacity);

      await client.query(
        `DELETE FROM chat_room_seats
         WHERE room_id = $1 AND last_seen_at < NOW() - make_interval(secs => $2)`,
        [roomId, SEAT_EXPIRE_SECONDS]
      );

      const existing = await client.query(
        'SELECT 1 FROM chat_room_seats WHERE socket_id = $1',
        [socketId]
      );
      const counted = await client.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM chat_room_seats WHERE room_id = $1',
        [roomId]
      );
      let occupied = Number(counted.rows[0].count);

      if (existing.rows.length === 0) {
        if (occupied >= capacity) {
          await client.query('COMMIT');
          return { ok: false, reason: 'ROOM_FULL', capacity, occupied };
        }
        await client.query(
          `INSERT INTO chat_room_seats (socket_id, room_id, instance_id)
           VALUES ($1, $2, $3)`,
          [socketId, roomId, instanceId]
        );
        occupied += 1;
      }

      await client.query('COMMIT');
      return { ok: true, capacity, occupied };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },

  async releaseSeat(socketId: string): Promise<void> {
    await pool.query('DELETE FROM chat_room_seats WHERE socket_id = $1', [socketId]);
  },

  /**
   * 自インスタンスの席の最終確認時刻を更新し、現在の入室者にない席を消す。
   * 確保直後でまだ入室済みになっていない席を消さないよう、確保から一定時間たった席だけを対象にする。
   */
  async heartbeat(instanceId: string, socketIds: string[]): Promise<void> {
    await pool.query(
      `UPDATE chat_room_seats SET last_seen_at = NOW()
       WHERE instance_id = $1 AND socket_id = ANY($2::text[])`,
      [instanceId, socketIds]
    );
    await pool.query(
      `DELETE FROM chat_room_seats
       WHERE instance_id = $1
         AND NOT (socket_id = ANY($2::text[]))
         AND joined_at < NOW() - make_interval(secs => $3)`,
      [instanceId, socketIds, ORPHAN_GRACE_SECONDS]
    );
  },

  async releaseInstanceSeats(instanceId: string): Promise<void> {
    await pool.query('DELETE FROM chat_room_seats WHERE instance_id = $1', [instanceId]);
  },

  /** 期限切れを除いた入室数と定員 */
  async getStatus(roomId: string): Promise<{ capacity: number; occupied: number }> {
    const result = await pool.query<{ capacity: number; occupied: string }>(
      `SELECT r.capacity,
              (SELECT COUNT(*) FROM chat_room_seats s
               WHERE s.room_id = r.room_id
                 AND s.last_seen_at >= NOW() - make_interval(secs => $2)) AS occupied
       FROM chat_rooms r
       WHERE r.room_id = $1`,
      [roomId, SEAT_EXPIRE_SECONDS]
    );
    if (result.rows.length === 0) {
      throw new Error(`chat room not found: ${roomId}`);
    }
    return {
      capacity: Number(result.rows[0].capacity),
      occupied: Number(result.rows[0].occupied),
    };
  },
};
