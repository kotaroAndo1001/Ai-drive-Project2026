import { Router } from 'express';
import { TodoController } from './todoController';

export const todoRouter = Router();

todoRouter.get('/', TodoController.list);
todoRouter.post('/', TodoController.create);
todoRouter.patch('/:id', TodoController.updateDone);
todoRouter.delete('/:id', TodoController.remove);
