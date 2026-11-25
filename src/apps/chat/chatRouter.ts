import { Router } from 'express';
import { ChatController } from './chatController';

export const chatRouter = Router();

chatRouter.get('/chat', ChatController.page);
chatRouter.get('/api/chat/status', ChatController.status);
