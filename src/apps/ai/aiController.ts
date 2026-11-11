import { Request, Response } from 'express';
import { aiError } from './aiError';
import { AiModel } from './aiModel';
import { generateAnswer } from './aiService';

const MAX_PROMPT_POINTS = 2000;

function codePointLength(text: string): number {
  return Array.from(text).length;
}

export const AiController = {
  async history(_req: Request, res: Response): Promise<void> {
    try {
      const items = await AiModel.listLatest(20);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error('AI履歴の取得に失敗しました', error);
      res
        .status(503)
        .json(aiError('UNAVAILABLE', '履歴を取得できません'));
    }
  },

  async ask(req: Request, res: Response): Promise<void> {
    try {
      if (req.body === undefined || req.body === null || typeof req.body !== 'object') {
        res.status(400).json(aiError('BAD_REQUEST', 'リクエスト本文が不正です'));
        return;
      }

      if (!('prompt' in req.body) || typeof req.body.prompt !== 'string') {
        res.status(400).json(aiError('BAD_REQUEST', 'promptが必要です'));
        return;
      }

      const prompt = req.body.prompt.trim();
      const length = codePointLength(prompt);
      if (length < 1) {
        res.status(400).json(aiError('BAD_REQUEST', 'promptが空です'));
        return;
      }
      if (length > MAX_PROMPT_POINTS) {
        res
          .status(422)
          .json(aiError('VALIDATION_ERROR', 'promptは1〜2000文字です'));
        return;
      }

      let answer: string;
      try {
        answer = await generateAnswer(prompt);
      } catch (error) {
        console.error('AI回答の生成に失敗しました', error);
        res.status(502).json(aiError('AI_FAILED', 'AI回答を取得できませんでした'));
        return;
      }

      if (!answer || !answer.trim()) {
        res.status(502).json(aiError('AI_FAILED', 'AI回答が空でした'));
        return;
      }

      const saved = await AiModel.insert(prompt, answer.trim());
      res.status(201).json({ success: true, item: saved });
    } catch (error) {
      console.error('AI質問の処理に失敗しました', error);
      res.status(503).json(aiError('UNAVAILABLE', '質問を保存できませんでした'));
    }
  },
};
