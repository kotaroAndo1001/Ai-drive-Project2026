import { Request, Response } from 'express';
import { TodoModel } from './todoModel';

type ErrorBody = {
  status: 'error';
  code: string;
  message: string;
  details: Array<{ field: string; issue: string }>;
};

function sendError(
  res: Response,
  httpStatus: number,
  code: string,
  message: string,
  details: ErrorBody['details'] = []
): void {
  res.status(httpStatus).json({
    status: 'error',
    code,
    message,
    details,
  } satisfies ErrorBody);
}

function isDbUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as { code?: string; message?: string };
  const code = err.code ?? '';
  const message = (err.message ?? '').toLowerCase();
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === '57P01' ||
    code === '53300' ||
    message.includes('connection') ||
    message.includes('database_url')
  );
}

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

export const TodoController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const data = await TodoModel.findAll();
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      console.error('TODO一覧の取得に失敗しました', error);
      if (isDbUnavailable(error)) {
        sendError(res, 503, 'UNAVAILABLE', 'データベースを利用できません');
        return;
      }
      sendError(res, 500, 'INTERNAL_ERROR', 'サーバーエラーが発生しました');
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.body === undefined || req.body === null || typeof req.body !== 'object') {
        sendError(res, 400, 'BAD_REQUEST', 'リクエスト本文が不正です');
        return;
      }

      if (!('title' in req.body)) {
        sendError(res, 400, 'BAD_REQUEST', 'titleが必要です', [
          { field: 'title', issue: 'titleがありません' },
        ]);
        return;
      }

      if (typeof req.body.title !== 'string') {
        sendError(res, 400, 'BAD_REQUEST', 'titleの型が不正です', [
          { field: 'title', issue: 'titleは文字列である必要があります' },
        ]);
        return;
      }

      const title = req.body.title.trim();
      if (title.length < 1 || title.length > 100) {
        sendError(res, 422, 'VALIDATION_ERROR', '入力内容に不備があります。', [
          { field: 'title', issue: 'titleは1〜100文字です。' },
        ]);
        return;
      }

      const data = await TodoModel.create(title);
      res.status(201).json({ status: 'success', data });
    } catch (error) {
      console.error('TODOの登録に失敗しました', error);
      if (isDbUnavailable(error)) {
        sendError(res, 503, 'UNAVAILABLE', 'データベースを利用できません');
        return;
      }
      sendError(res, 500, 'INTERNAL_ERROR', 'サーバーエラーが発生しました');
    }
  },

  async updateDone(req: Request, res: Response): Promise<void> {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        sendError(res, 400, 'BAD_REQUEST', 'idが不正です', [
          { field: 'id', issue: 'idは1以上の整数です' },
        ]);
        return;
      }

      if (req.body === undefined || req.body === null || typeof req.body !== 'object') {
        sendError(res, 400, 'BAD_REQUEST', 'リクエスト本文が不正です');
        return;
      }

      if (!('isDone' in req.body)) {
        sendError(res, 400, 'BAD_REQUEST', 'isDoneが必要です', [
          { field: 'isDone', issue: 'isDoneがありません' },
        ]);
        return;
      }

      if (typeof req.body.isDone !== 'boolean') {
        sendError(res, 422, 'VALIDATION_ERROR', '入力内容に不備があります。', [
          { field: 'isDone', issue: 'isDoneは真偽値です' },
        ]);
        return;
      }

      const data = await TodoModel.updateDone(id, req.body.isDone);
      if (!data) {
        sendError(res, 404, 'NOT_FOUND', '対象のTODOが見つかりません');
        return;
      }

      res.status(200).json({ status: 'success', data });
    } catch (error) {
      console.error('TODOの更新に失敗しました', error);
      if (isDbUnavailable(error)) {
        sendError(res, 503, 'UNAVAILABLE', 'データベースを利用できません');
        return;
      }
      sendError(res, 500, 'INTERNAL_ERROR', 'サーバーエラーが発生しました');
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        sendError(res, 400, 'BAD_REQUEST', 'idが不正です', [
          { field: 'id', issue: 'idは1以上の整数です' },
        ]);
        return;
      }

      const deleted = await TodoModel.remove(id);
      if (!deleted) {
        sendError(res, 404, 'NOT_FOUND', '対象のTODOが見つかりません');
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('TODOの削除に失敗しました', error);
      if (isDbUnavailable(error)) {
        sendError(res, 503, 'UNAVAILABLE', 'データベースを利用できません');
        return;
      }
      sendError(res, 500, 'INTERNAL_ERROR', 'サーバーエラーが発生しました');
    }
  },
};
