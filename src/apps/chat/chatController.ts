import { Request, Response } from 'express';
import { ChatModel } from './chatModel';
import { ROOM_ID } from './chatService';

export const ChatController = {
  page(_req: Request, res: Response): void {
    res.render('chat/index');
  },

  /** 定員状況だけを返す（履歴は入室を許可した Socket にだけ返す） */
  async status(_req: Request, res: Response): Promise<void> {
    try {
      const data = await ChatModel.getStatus(ROOM_ID);
      res.status(200).json({ status: 'success', data: { roomId: ROOM_ID, ...data } });
    } catch (error) {
      console.error('チャットの定員状況の取得に失敗しました', error);
      res.status(503).json({
        status: 'error',
        code: 'UNAVAILABLE',
        message: 'チャットの状況を取得できません',
      });
    }
  },
};
