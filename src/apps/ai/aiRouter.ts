import { Router } from 'express';
import { AiController } from './aiController';

export const aiRouter = Router();

aiRouter.get('/history', AiController.history);
aiRouter.post('/ask', AiController.ask);
