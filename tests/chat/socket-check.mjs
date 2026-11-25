// チャットの Socket.IO 動作確認スクリプト（docs/chat/05_test_spec.md の自動実行分）
// 使い方: 同じ .env で PORT=3000 と PORT=3001 の2プロセスを起動してから
//   node tests/chat/socket-check.mjs
// 注意: 実行すると DB の chat_messages にテスト投稿が保存される。
import 'dotenv/config';
import pg from 'pg';
import { io } from 'socket.io-client';

const A_URL = process.env.CHAT_URL_A || 'http://localhost:3000';
const B_URL = process.env.CHAT_URL_B || 'http://localhost:3001';
const BAD_URL = process.env.CHAT_URL_BADDB; // DB に接続できないサーバー（任意）

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const results = [];
const opened = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(id, title, pass, detail) {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${title} :: ${detail}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const s = io(url, { reconnection: false, forceNew: true, transports: ['websocket'] });
    s.received = [];
    s.on('chat:message', (m) => s.received.push(m));
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
    opened.add(s);
  });
}

const emitAck = (s, ev, ...args) => s.timeout(8000).emitWithAck(ev, ...args);
const join = (s) => emitAck(s, 'chat:join');
const send = (s, username, comment) => emitAck(s, 'chat:send', { username, comment });

async function joined(url) {
  const s = await connect(url);
  const res = await join(s);
  if (!res.ok) throw new Error(`join failed: ${JSON.stringify(res)}`);
  return s;
}

function close(...sockets) {
  sockets.forEach((s) => {
    s.disconnect();
    opened.delete(s);
  });
}

async function closeAll() {
  [...opened].forEach((s) => s.disconnect());
  opened.clear();
  await sleep(800); // 切断による席解放を待つ
}

async function seatCount() {
  const r = await db.query("SELECT COUNT(*)::int AS n FROM chat_room_seats WHERE room_id = 'lobby'");
  return r.rows[0].n;
}
async function messageCount() {
  const r = await db.query("SELECT COUNT(*)::int AS n FROM chat_messages WHERE room_id = 'lobby'");
  return r.rows[0].n;
}

async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(100);
  }
  return fn();
}

const tag = `t${Date.now().toString(36)}`;

async function main() {
  // 開始前に lobby の席が空であることを確認（他の利用者がいると定員テストが崩れる）
  await db.query("DELETE FROM chat_room_seats WHERE room_id = 'lobby' AND last_seen_at < NOW() - INTERVAL '30 seconds'");
  console.log(`seats at start: ${await seatCount()}`);

  // TST-CHAT-003/004: 2接続の双方向送受信・二重表示なし・DB 1行
  {
    const a = await joined(A_URL);
    const b = await joined(A_URL);
    const before = await messageCount();
    const r1 = await send(a, 'Aさん', `${tag} AからB`);
    await waitFor(() => b.received.length >= 1 && a.received.length >= 1);
    const r2 = await send(b, 'Bさん', `${tag} BからA`);
    await waitFor(() => a.received.length >= 2 && b.received.length >= 2);
    await sleep(2500); // DB 同期ポーリングで同じ投稿が再配信されないことも見る
    const after = await messageCount();
    const ids = (s) => s.received.map((m) => m.id);
    const uniq = (arr) => new Set(arr).size === arr.length;
    const ok =
      r1.ok && r2.ok &&
      JSON.stringify(ids(a)) === JSON.stringify([r1.message.id, r2.message.id]) &&
      JSON.stringify(ids(b)) === JSON.stringify([r1.message.id, r2.message.id]) &&
      uniq(ids(a)) && after - before === 2;
    record('TST-CHAT-003', '2接続の双方向送受信と各1件・DB2行', ok,
      `A受信=${JSON.stringify(ids(a))} B受信=${JSON.stringify(ids(b))} DB増分=${after - before}`);
    close(a, b);
  }
  await closeAll();

  // TST-CHAT-005: 21件以上から最新20件を古い順
  {
    const w = await joined(A_URL);
    const n = await messageCount();
    for (let i = n; i < 23; i += 1) await send(w, 'seed', `${tag} 履歴用 ${i}`);
    close(w);
    await sleep(500);
    const r = await db.query(
      "SELECT id FROM chat_messages WHERE room_id='lobby' ORDER BY created_at DESC, id DESC LIMIT 20"
    );
    const expected = r.rows.map((x) => x.id).reverse();
    const v = await connect(A_URL);
    const res = await join(v);
    const got = res.messages.map((m) => m.id);
    const total = await messageCount();
    record('TST-CHAT-005', '最新20件を古い順で表示', res.ok && got.length === 20 && JSON.stringify(got) === JSON.stringify(expected),
      `DB総数=${total} 受信件数=${got.length} 先頭id=${got[0]} 末尾id=${got[got.length - 1]} 期待と一致=${JSON.stringify(got) === JSON.stringify(expected)}`);
    close(v);
  }
  await closeAll();

  // TST-CHAT-006: 履歴取得と新着が重なっても1件
  {
    const a = await joined(A_URL);
    let okCount = 0;
    for (let round = 0; round < 5; round += 1) {
      const x = await connect(A_URL);
      const joinP = join(x);
      const sendP = send(a, 'Aさん', `${tag} 入室と同時 ${round}`);
      const [jr, sr] = await Promise.all([joinP, sendP]);
      await sleep(300);
      const merged = new Map();
      jr.messages.concat(x.received).forEach((m) => merged.set(m.id, m));
      const hits = [...merged.values()].filter((m) => m.id === sr.message.id).length;
      if (jr.ok && sr.ok && hits === 1) okCount += 1;
      close(x);
      await sleep(300);
    }
    record('TST-CHAT-006', '履歴取得中の新着をIDで統合して1件', okCount === 5, `5回中${okCount}回 統合後に1件`);
    close(a);
  }
  await closeAll();

  // TST-CHAT-007/008: 5接続は入室可、6接続目は満席・受信なし・投稿拒否、1席空けば入室
  {
    const five = [];
    for (let i = 0; i < 5; i += 1) five.push(await joined(i % 2 ? B_URL : A_URL));
    const sixth = await connect(A_URL);
    const full = await join(sixth);
    const seats5 = await seatCount();
    const sendRes = await send(sixth, '6人目', `${tag} 満席から送信`);
    await send(five[0], 'Aさん', `${tag} 満席中の新着`);
    await sleep(2500);
    record('TST-CHAT-007', '5接続入室後、6接続目は満席', full.ok === false && full.code === 'ROOM_FULL' && seats5 === 5 && !('messages' in full),
      `6接続目=${full.code} 履歴返却=${'messages' in full} 席数=${seats5}`);
    record('TST-CHAT-008', '満席の接続は投稿・受信できない', sendRes.ok === false && sendRes.code === 'NOT_JOINED' && sixth.received.length === 0,
      `投稿=${sendRes.code} 受信件数=${sixth.received.length}`);
    close(five[4]);
    await sleep(800);
    const retry = await join(sixth);
    record('TST-CHAT-009', '1席空けば再試行で入室', retry.ok === true && retry.messages.length > 0 && (await seatCount()) === 5,
      `再試行=${retry.ok} 履歴件数=${retry.messages?.length} 席数=${await seatCount()}`);
  }
  await closeAll();

  // TST-CHAT-010: 切断中の投稿は再入室で履歴に反映、反復しても1件
  {
    const a = await joined(A_URL);
    let b = await joined(A_URL);
    close(b);
    await sleep(800);
    const seatsAfterLeave = await seatCount();
    const posted = await send(a, 'Aさん', `${tag} Bが切断中の投稿`);
    let ok = true;
    for (let i = 0; i < 3; i += 1) {
      b = await connect(A_URL);
      const res = await join(b);
      const hits = res.messages.filter((m) => m.id === posted.message.id).length;
      if (!(res.ok && hits === 1)) ok = false;
      close(b);
      await sleep(500);
    }
    record('TST-CHAT-010', '切断で席解放・再入室で切断中の投稿を1件表示', ok && seatsAfterLeave === 1,
      `切断後の席数=${seatsAfterLeave} 再入室3回とも1件=${ok}`);
    close(a);
  }
  await closeAll();

  // TST-CHAT-011〜013: 入力検証（保存・配信されない）
  {
    const a = await joined(A_URL);
    const b = await joined(A_URL);
    const before = await messageCount();
    const cases = [
      ['空文字', { username: 'A', comment: '' }, false],
      ['空白のみ（全角含む）', { username: 'A', comment: ' 　\n\t ' }, false],
      ['ユーザー名空白のみ', { username: '   ', comment: 'こんにちは' }, false],
      ['commentが数値', { username: 'A', comment: 123 }, false],
      ['usernameが配列', { username: ['A'], comment: 'x' }, false],
      ['payloadが文字列', 'hello', false],
      ['payloadなし', undefined, false],
      ['ユーザー名51文字', { username: 'あ'.repeat(51), comment: 'x' }, false],
      ['コメント501文字', { username: 'A', comment: 'a'.repeat(501) }, false],
      ['ユーザー名50文字ちょうど', { username: 'あ'.repeat(50), comment: `${tag} 上限ちょうど` }, true],
      ['コメント500文字ちょうど', { username: 'A', comment: 'b'.repeat(500) }, true],
      ['絵文字50文字のユーザー名', { username: '😀'.repeat(50), comment: `${tag} 絵文字` }, true],
      ['前後空白は除去して保存', { username: '  Trim  ', comment: `  ${tag} 前後空白  ` }, true],
    ];
    const lines = [];
    let ok = true;
    let expectedSaved = 0;
    for (const [name, payload, shouldPass] of cases) {
      const res = await emitAck(a, 'chat:send', payload);
      if (res.ok !== shouldPass) ok = false;
      if (shouldPass) expectedSaved += 1;
      lines.push(`${name}=${res.ok ? 'OK' : res.code + '(' + (res.details || []).map((d) => d.issue).join('/') + ')'}`);
    }
    await sleep(2500);
    const after = await messageCount();
    const trimmed = b.received.find((m) => m.username === 'Trim');
    ok = ok && after - before === expectedSaved && b.received.length === expectedSaved && trimmed?.comment === `${tag} 前後空白`;
    record('TST-CHAT-011', '入力検証（空・空白・型・上限±1）', ok,
      `${lines.join(', ')} | DB増分=${after - before} 配信=${b.received.length}`);
    close(a, b);
  }
  await closeAll();

  // TST-CHAT-014: タグ風文字列は文字列のまま保存・配信（画面表示はブラウザで確認）
  {
    const a = await joined(A_URL);
    const xss = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const res = await send(a, '<b>太字?</b>', xss);
    const row = await db.query('SELECT username, comment FROM chat_messages WHERE id = $1', [res.message.id]);
    record('TST-CHAT-014', 'タグ風文字列をそのまま保存（サーバー側）', res.ok && row.rows[0].comment === xss,
      `id=${res.message.id} 保存値一致=${row.rows[0].comment === xss}`);
    close(a);
  }
  await closeAll();

  // TST-CHAT-017: 別インスタンス間の双方向配信（DB同期）
  {
    const a = await joined(A_URL);
    const b = await joined(B_URL);
    const t0 = Date.now();
    const r1 = await send(a, '3000の人', `${tag} 3000→3001`);
    const got1 = await waitFor(() => b.received.some((m) => m.id === r1.message.id), 6000);
    const d1 = Date.now() - t0;
    const t1 = Date.now();
    const r2 = await send(b, '3001の人', `${tag} 3001→3000`);
    const got2 = await waitFor(() => a.received.some((m) => m.id === r2.message.id), 6000);
    const d2 = Date.now() - t1;
    await sleep(2500);
    const dupA = a.received.filter((m) => m.id === r2.message.id).length;
    const dupB = b.received.filter((m) => m.id === r1.message.id).length;
    record('TST-CHAT-017', '別インスタンス(3000/3001)間の双方向配信', got1 && got2 && dupA === 1 && dupB === 1,
      `3000→3001 ${got1 ? d1 + 'ms' : '未着'}、3001→3000 ${got2 ? d2 + 'ms' : '未着'}、重複なし=${dupA === 1 && dupB === 1}`);
    close(a, b);
  }
  await closeAll();

  // TST-CHAT-018: 2台合計4接続から両台で同時入室 → 成功は1件、合計5
  {
    let okRounds = 0;
    const detail = [];
    for (let round = 0; round < 5; round += 1) {
      const base = [await joined(A_URL), await joined(A_URL), await joined(B_URL), await joined(B_URL)];
      const x = await connect(A_URL);
      const y = await connect(B_URL);
      const [rx, ry] = await Promise.all([join(x), join(y)]);
      const seats = await seatCount();
      const success = [rx, ry].filter((r) => r.ok).length;
      detail.push(`${success}件成功/席${seats}`);
      if (success === 1 && seats === 5) okRounds += 1;
      close(...base, x, y);
      await closeAll();
    }
    record('TST-CHAT-018', '2台同時入室で5席目は1件だけ', okRounds === 5, `5回: ${detail.join(', ')}`);
  }

  // TST-CHAT-019: 異常終了で残った席（30秒更新なし）を回収
  {
    for (let i = 0; i < 5; i += 1) {
      await db.query(
        `INSERT INTO chat_room_seats (socket_id, room_id, instance_id, last_seen_at)
         VALUES ($1, 'lobby', 'crashed-instance', NOW() - INTERVAL '31 seconds')`,
        [`stale-${tag}-${i}`]
      );
    }
    const statusBefore = await (await fetch(`${A_URL}/api/chat/status`)).json();
    const s = await connect(A_URL);
    const res = await join(s);
    const left = await db.query("SELECT COUNT(*)::int AS n FROM chat_room_seats WHERE instance_id = 'crashed-instance'");
    record('TST-CHAT-019', '期限切れの席を回収して入室', res.ok && left.rows[0].n === 0 && statusBefore.data.occupied === 0,
      `期限切れ5席あり→status.occupied=${statusBefore.data.occupied} 入室=${res.ok} 残存=${left.rows[0].n}`);
    close(s);
  }
  await closeAll();

  // TST-CHAT-020: DB に接続できないサーバーでは入室・投稿を拒否し、プロセスは継続
  if (BAD_URL) {
    const s = await connect(BAD_URL);
    const res = await join(s);
    const sendRes = await send(s, 'A', 'x');
    const top = await fetch(`${BAD_URL}/`);
    const status = await fetch(`${BAD_URL}/api/chat/status`);
    record('TST-CHAT-020', 'DB障害時に入室拒否・案内、プロセス継続', res.ok === false && res.code === 'UNAVAILABLE' && sendRes.code === 'NOT_JOINED' && top.status === 200 && status.status === 503,
      `join=${res.code} message="${res.message}" send=${sendRes.code} TOP=${top.status} status API=${status.status}`);
    close(s);
  } else {
    record('TST-CHAT-020', 'DB障害時の挙動', false, '未実施（CHAT_URL_BADDB 未指定）');
  }

  console.log(`seats at end: ${await seatCount()}`);
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await db.end();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error('テスト実行エラー', error);
  await db.end().catch(() => undefined);
  process.exit(2);
});
