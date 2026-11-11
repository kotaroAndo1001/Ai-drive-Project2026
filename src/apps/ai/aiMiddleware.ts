import { NextFunction, Request, Response } from 'express';
import { aiError } from './aiError';

export function requireAiDemoEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.AI_DEMO_ENABLED !== 'true') {
    res.status(503).json(
      aiError('DEMO_DISABLED', 'AI機能は現在停止中です')
    );
    return;
  }
  next();
}
