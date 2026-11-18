import { Request, Response } from 'express';
import { aiError } from '../aiError';
import { V2Model } from './v2Model';
import {
  buildGeminiContents,
  contentRoles,
  generateAnswerWithContents,
} from './v2Service';

const MAX_TITLE = 50;
const MAX_PROMPT = 2000;

function codePointLength(text: string): number {
  return Array.from(text).length;
}

function parseConversationId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const V2Controller = {
  async listConversations(_req: Request, res: Response): Promise<void> {
    try {
      const items = await V2Model.listConversations();
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error('V2会話一覧の取得に失敗しました', error);
      res.status(503).json(aiError('UNAVAILABLE', '会話一覧を取得できません'));
    }
  },

  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body || typeof req.body !== 'object' || typeof req.body.title !== 'string') {
        res.status(400).json(aiError('BAD_REQUEST', 'titleが必要です'));
        return;
      }
      const title = req.body.title.trim();
      const length = codePointLength(title);
      if (length < 1 || length > MAX_TITLE) {
        res
          .status(422)
          .json(aiError('VALIDATION_ERROR', 'titleは1〜50文字です'));
        return;
      }

      const item = await V2Model.createConversation(title);
      res.status(201).json({ success: true, item });
    } catch (error) {
      console.error('V2会話の作成に失敗しました', error);
      res.status(503).json(aiError('UNAVAILABLE', '会話を作成できません'));
    }
  },

  async listTurns(req: Request, res: Response): Promise<void> {
    try {
      const id = parseConversationId(req.params.id);
      if (id === null) {
        res.status(400).json(aiError('BAD_REQUEST', '会話IDが不正です'));
        return;
      }

      const conversation = await V2Model.findConversation(id);
      if (!conversation) {
        res.status(404).json(aiError('NOT_FOUND', '会話が見つかりません'));
        return;
      }

      const items = await V2Model.listLatestTurns(id, 20);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error('V2履歴の取得に失敗しました', error);
      res.status(503).json(aiError('UNAVAILABLE', '履歴を取得できません'));
    }
  },

  async createTurn(req: Request, res: Response): Promise<void> {
    try {
      const id = parseConversationId(req.params.id);
      if (id === null) {
        res.status(400).json(aiError('BAD_REQUEST', '会話IDが不正です'));
        return;
      }

      if (!req.body || typeof req.body !== 'object' || typeof req.body.prompt !== 'string') {
        res.status(400).json(aiError('BAD_REQUEST', 'promptが必要です'));
        return;
      }

      const prompt = req.body.prompt.trim();
      const length = codePointLength(prompt);
      if (length < 1) {
        res.status(400).json(aiError('BAD_REQUEST', 'promptが空です'));
        return;
      }
      if (length > MAX_PROMPT) {
        res
          .status(422)
          .json(aiError('VALIDATION_ERROR', 'promptは1〜2000文字です'));
        return;
      }

      const conversation = await V2Model.findConversation(id);
      if (!conversation) {
        res.status(404).json(aiError('NOT_FOUND', '会話が見つかりません'));
        return;
      }

      const pastTurns = await V2Model.listLatestTurns(id, 5);
      const contents = buildGeminiContents(pastTurns, prompt);
      const roles = contentRoles(contents);
      console.log('V2 Gemini roles', { conversationId: id, roles });

      let answer: string;
      try {
        answer = await generateAnswerWithContents(contents);
      } catch (error) {
        console.error('V2 AI回答の生成に失敗しました', error);
        res.status(502).json(aiError('AI_FAILED', 'AI回答を取得できませんでした'));
        return;
      }

      const item = await V2Model.insertTurn(id, prompt, answer);
      const body: Record<string, unknown> = { success: true, item };
      if (process.env.AI_V2_DEBUG_CONTEXT === 'true') {
        body.debug = { roles };
      }
      res.status(201).json(body);
    } catch (error) {
      console.error('V2質問の処理に失敗しました', error);
      res.status(503).json(aiError('UNAVAILABLE', '質問を保存できませんでした'));
    }
  },
};
