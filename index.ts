import express, { Request, Response } from 'express';
import path from 'path';
import { pool } from './db';
import { todoRouter } from './src/apps/todo/todoRouter';
import { aiRouter } from './src/apps/ai/aiRouter';
import { requireAiDemoEnabled } from './src/apps/ai/aiMiddleware';


const app = express(); // Expressアプリケーションを作成
const port: number = 3000; // ローカルで使用するポート番号


// ------------------------------
// Expressの基本設定
// ------------------------------
// AI API は 16KiB 制限を先に適用（他 API より前に置く）
app.use(
  '/api/ai',
  express.json({ limit: 16 * 1024 }),
  requireAiDemoEnabled,
  aiRouter
);
app.use(express.json()); // JSON API用（TODO 等）
app.use(express.urlencoded({ extended: true })); // フォームから送信されたデータを受け取れるようにする
app.use(express.static(path.join(process.cwd(), 'public'))); // CSSや画像などの静的ファイルを公開する
app.set('view engine', 'ejs'); // テンプレートエンジンにEJSを設定
app.set('views', path.join(process.cwd(), 'views')); // EJSファイルを保存するフォルダーを指定


// ------------------------------
// ルーティング
// ------------------------------


// 「/」にアクセスされたときの処理
app.get('/', (req: Request, res: Response): void => {
  res.render('index');
});


// 「/api/db-check」にアクセスされたときの処理（Neonへの接続確認）
app.get('/api/db-check', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT 1 AS connection_test');
    res.json({
      status: 'ok',
      database: result.rows[0].connection_test === 1 ? 'connected' : 'error',
    });
  } catch (error) {
    console.error('DB接続確認に失敗しました', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});


type Product = { id: number; name: string; price: number };

// 「/db-sample」にアクセスされたときの処理（商品一覧）
app.get('/db-sample', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<Product>(
      'SELECT id, name, price FROM products ORDER BY id'
    );
    res.render('db-sample', { products: result.rows });
  } catch (error) {
    console.error('商品一覧の取得に失敗しました', error);
    res.status(503).send('商品一覧を表示できません');
  }
});


// 「/todo」画面と TODO API
app.get('/todo', (_req: Request, res: Response): void => {
  res.render('todo/index');
});
app.use('/api/v1/todos', todoRouter);


// 「/ai」画面（API は上部で /api/ai に登録済み）
app.get('/ai', (_req: Request, res: Response): void => {
  res.render('ai/index');
});


// JSON 破損・サイズ超過（AI の 16KiB 含む）
app.use((err: unknown, _req: Request, res: Response, next: express.NextFunction): void => {
  if (!err || typeof err !== 'object') {
    next(err);
    return;
  }
  const anyErr = err as { type?: string; status?: number; statusCode?: number };
  if (anyErr.type === 'entity.too.large') {
    res.status(400).json({
      success: false,
      code: 'BAD_REQUEST',
      message: 'リクエスト本文が大きすぎます',
    });
    return;
  }
  if (anyErr.type === 'entity.parse.failed' || anyErr.status === 400 || anyErr.statusCode === 400) {
    res.status(400).json({
      success: false,
      code: 'BAD_REQUEST',
      message: 'リクエスト本文が不正です',
    });
    return;
  }
  next(err);
});


// ------------------------------
// サーバー起動
// ------------------------------


app.listen(port, (): void => {
  console.log(`Server started: http://localhost:${port}`);
});



