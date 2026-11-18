import { Router } from 'express';
import { V2Controller } from './v2Controller';

export const aiV2Router = Router();

aiV2Router.get('/conversations', V2Controller.listConversations);
aiV2Router.post('/conversations', V2Controller.createConversation);
aiV2Router.get('/conversations/:id/turns', V2Controller.listTurns);
aiV2Router.post('/conversations/:id/turns', V2Controller.createTurn);
