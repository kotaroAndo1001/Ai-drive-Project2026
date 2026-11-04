import { pool } from '../../../db';

export type Todo = {
  id: number;
  title: string;
  isDone: boolean;
  createdAt: string;
};

type TodoRow = {
  id: number;
  title: string;
  is_done: boolean;
  created_at: Date | string;
};

function toTodo(row: TodoRow): Todo {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    title: row.title,
    isDone: row.is_done,
    createdAt,
  };
}

export const TodoModel = {
  async findAll(): Promise<Todo[]> {
    const result = await pool.query<TodoRow>(
      'SELECT id, title, is_done, created_at FROM todo_tasks ORDER BY id ASC'
    );
    return result.rows.map(toTodo);
  },

  async create(title: string): Promise<Todo> {
    const result = await pool.query<TodoRow>(
      `INSERT INTO todo_tasks (title)
       VALUES ($1)
       RETURNING id, title, is_done, created_at`,
      [title]
    );
    return toTodo(result.rows[0]);
  },

  async updateDone(id: number, isDone: boolean): Promise<Todo | null> {
    const result = await pool.query<TodoRow>(
      `UPDATE todo_tasks
       SET is_done = $1
       WHERE id = $2
       RETURNING id, title, is_done, created_at`,
      [isDone, id]
    );
    return result.rows[0] ? toTodo(result.rows[0]) : null;
  },

  async remove(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM todo_tasks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
