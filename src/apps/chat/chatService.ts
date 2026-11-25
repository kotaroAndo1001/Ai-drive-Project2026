import os from 'os';
import crypto from 'crypto';
import type { Server, Socket } from 'socket.io';
import { ChatModel, ChatMessage } from './chatModel';

export const ROOM_ID = 'lobby';
export const HISTORY_LIMIT = 20;
export const USERNAME_MAX = 50;
export const COMMENT_MAX = 500;

const HEARTBEAT_MS = 10_000;
const POLL_MS = 2_000;
const POLL_LOOKBACK = 20;
const POLL_BATCH = 100;
const DELIVERED_KEEP = 1000;

const MSG_UNAVAILABLE = 'サーバーで処理できませんでした。時間をおいて再試行してください。';

export const INSTANCE_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString('hex')}`;

type Ack = (response: unknown) => void;
type FieldIssue = { field: 'username' | 'comment' | 'body'; issue: string };

export type ValidationResult =
  | { ok: true; username: string; comment: string }
  | { ok: false; details: FieldIssue[] };

function charCount(value: string): number {
  return Array.from(value).length;
}

/** 型・前後空白・文字数を検証し、前後空白を除いた値を返す */
export function validateMessageInput(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, details: [{ field: 'body', issue: '送信内容が不正です' }] };
  }
  const body = payload as Record<string, unknown>;
  const details: FieldIssue[] = [];

  const check = (field: 'username' | 'comment', label: string, max: number): string => {
    const raw = body[field];
    if (typeof raw !== 'string') {
      details.push({ field, issue: `${label}は文字列で入力してください` });
      return '';
    }
    const value = raw.trim();
    const length = charCount(value);
    if (length === 0) {
      details.push({ field, issue: `${label}を入力してください` });
    } else if (length > max) {
      details.push({ field, issue: `${label}は${max}文字以内で入力してください` });
    }
    return value;
  };

  const username = check('username', 'ユーザー名', USERNAME_MAX);
  const comment = check('comment', 'コメント', COMMENT_MAX);

  if (details.length > 0) {
    return { ok: false, details };
  }
  return { ok: true, username, comment };
}

/** 直近に配信した投稿IDを覚え、同じ投稿を同じインスタンスから二重配信しない */
class DeliveredIds {
  private ids = new Set<number>();
  private order: number[] = [];
  maxId = 0;

  has(id: number): boolean {
    return this.ids.has(id);
  }

  add(id: number): void {
    if (this.ids.has(id)) return;
    this.ids.add(id);
    this.order.push(id);
    if (id > this.maxId) this.maxId = id;
    while (this.order.length > DELIVERED_KEEP) {
      const old = this.order.shift();
      if (old !== undefined) this.ids.delete(old);
    }
  }
}

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : () => undefined;
}

function logThrottled(state: { last: number }, message: string, error: unknown): void {
  const now = Date.now();
  if (now - state.last >= 60_000) {
    state.last = now;
    console.error(message, error);
  }
}

/** Socket.IO サーバーにチャットのイベント処理・ハートビート・DB同期を登録する */
export function attachChat(io: Server): { stop: () => Promise<void> } {
  const delivered = new DeliveredIds();
  let syncReady = false;
  const pollLog = { last: 0 };
  const heartbeatLog = { last: 0 };

  const broadcast = (message: ChatMessage): void => {
    if (delivered.has(message.id)) return;
    delivered.add(message.id);
    io.to(ROOM_ID).emit('chat:message', message);
  };

  // 入室済みに加え、入室処理中（席を確保中）の Socket も席の持ち主として扱う
  const seatHolderIds = (): string[] =>
    [...io.of('/').sockets.values()]
      .filter((s) => s.data.joined === true || s.data.joining)
      .map((s) => s.id);

  io.engine.on('connection_error', (err: { code?: number; message?: string }) => {
    console.error('chat: Socket.IO 接続エラー', err.code, err.message);
  });

  io.on('connection', (socket: Socket) => {
    socket.data.joined = false;
    socket.data.joining = null as Promise<unknown> | null;

    socket.on('chat:join', async (ack: unknown) => {
      const reply = safeAck(ack);
      try {
        if (socket.data.joining) {
          reply(await socket.data.joining);
          return;
        }
        const task = joinRoom(socket);
        socket.data.joining = task;
        try {
          reply(await task);
        } finally {
          socket.data.joining = null;
        }
      } catch (error) {
        console.error('chat: 入室処理に失敗しました', error);
        reply({ ok: false, code: 'UNAVAILABLE', message: MSG_UNAVAILABLE });
      }
    });

    socket.on('chat:send', async (payload: unknown, ack: unknown) => {
      const reply = safeAck(ack);
      try {
        if (socket.data.joined !== true) {
          reply({ ok: false, code: 'NOT_JOINED', message: '入室していないため送信できません。' });
          return;
        }
        const input = validateMessageInput(payload);
        if (!input.ok) {
          reply({
            ok: false,
            code: 'VALIDATION_ERROR',
            message: '入力内容を確認してください。',
            details: input.details,
          });
          return;
        }
        const message = await ChatModel.insertMessage(ROOM_ID, input.username, input.comment);
        broadcast(message);
        reply({ ok: true, message });
      } catch (error) {
        console.error('chat: 投稿の保存に失敗しました', error);
        reply({ ok: false, code: 'UNAVAILABLE', message: 'サーバーで保存できませんでした。時間をおいて再試行してください。' });
      }
    });

    socket.on('disconnect', () => {
      socket.data.joined = false;
      ChatModel.releaseSeat(socket.id).catch((error) => {
        console.error('chat: 席の解放に失敗しました（ハートビートで回収します）', error);
      });
    });
  });

  async function joinRoom(socket: Socket): Promise<unknown> {
    if (socket.data.joined === true) {
      const messages = await ChatModel.findLatest(ROOM_ID, HISTORY_LIMIT);
      const status = await ChatModel.getStatus(ROOM_ID);
      return { ok: true, roomId: ROOM_ID, ...status, messages };
    }

    const seat = await ChatModel.reserveSeat(ROOM_ID, socket.id, INSTANCE_ID);
    if (!seat.ok) {
      return {
        ok: false,
        code: 'ROOM_FULL',
        message: `満席です（定員${seat.capacity}人）。しばらくしてから再試行してください。`,
        capacity: seat.capacity,
        occupied: seat.occupied,
      };
    }

    if (!socket.connected) {
      await ChatModel.releaseSeat(socket.id);
      return { ok: false, code: 'UNAVAILABLE', message: MSG_UNAVAILABLE };
    }

    // 先にルームへ参加してから履歴を取得する（取得中の新着を取りこぼさない）
    socket.join(ROOM_ID);
    socket.data.joined = true;
    try {
      const messages = await ChatModel.findLatest(ROOM_ID, HISTORY_LIMIT);
      return {
        ok: true,
        roomId: ROOM_ID,
        capacity: seat.capacity,
        occupied: seat.occupied,
        messages,
      };
    } catch (error) {
      socket.leave(ROOM_ID);
      socket.data.joined = false;
      await ChatModel.releaseSeat(socket.id).catch(() => undefined);
      throw error;
    }
  }

  // 他インスタンスで保存された新着を DB から取得して配信する
  const poll = async (): Promise<void> => {
    try {
      if (!syncReady) {
        const maxId = await ChatModel.findMaxId(ROOM_ID);
        delivered.maxId = Math.max(delivered.maxId, maxId);
        syncReady = true;
        return;
      }
      const from = Math.max(0, delivered.maxId - POLL_LOOKBACK);
      const messages = await ChatModel.findSince(ROOM_ID, from, POLL_BATCH);
      for (const message of messages) {
        broadcast(message);
      }
    } catch (error) {
      logThrottled(pollLog, 'chat: DB同期の取得に失敗しました', error);
    }
  };

  const heartbeat = async (): Promise<void> => {
    try {
      await ChatModel.heartbeat(INSTANCE_ID, seatHolderIds());
    } catch (error) {
      logThrottled(heartbeatLog, 'chat: 席のハートビートに失敗しました', error);
    }
  };

  let polling = false;
  const pollTimer = setInterval(() => {
    if (polling) return;
    polling = true;
    poll().finally(() => {
      polling = false;
    });
  }, POLL_MS);
  const heartbeatTimer = setInterval(() => {
    void heartbeat();
  }, HEARTBEAT_MS);
  void poll();

  return {
    async stop(): Promise<void> {
      clearInterval(pollTimer);
      clearInterval(heartbeatTimer);
      await ChatModel.releaseInstanceSeats(INSTANCE_ID).catch((error) => {
        console.error('chat: 終了時の席解放に失敗しました', error);
      });
    },
  };
}
