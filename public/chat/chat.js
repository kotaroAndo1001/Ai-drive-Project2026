// リアルタイムチャットのブラウザ側処理（docs/chat/03_design.md DES-CHAT-004）
// 描画は textContent のみを使い、innerHTML は使わない。
(() => {
  const USERNAME_MAX = 50;
  const COMMENT_MAX = 500;
  const ACK_TIMEOUT_MS = 8000;

  const statusEl = document.getElementById('chat-status');
  const roomEl = document.getElementById('chat-room');
  const listEl = document.getElementById('message-list');
  const formEl = document.getElementById('chat-form');
  const usernameEl = document.getElementById('username');
  const commentEl = document.getElementById('comment');
  const counterEl = document.getElementById('comment-counter');
  const sendButton = document.getElementById('send-button');
  const formErrorEl = document.getElementById('form-error');
  const fullNoticeEl = document.getElementById('full-notice');
  const fullMessageEl = document.getElementById('full-message');
  const errorNoticeEl = document.getElementById('error-notice');
  const errorTextEl = document.getElementById('error-text');

  if (typeof io !== 'function') {
    statusEl.textContent = 'リアルタイム通信を利用できません（この環境ではチャットサーバーが動いていません）。';
    statusEl.className = 'status error';
    return;
  }

  /** 表示中の投稿（古い順）と、表示済みの投稿ID */
  let messages = [];
  const shownIds = new Set();

  let joined = false;
  let joining = false;
  let sending = false;
  let buffered = [];

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function showOnly(section) {
    roomEl.hidden = section !== 'room';
    fullNoticeEl.hidden = section !== 'full';
    errorNoticeEl.hidden = section !== 'error';
  }

  function updateSendState() {
    sendButton.disabled = !(joined && socket.connected) || sending;
  }

  function compare(a, b) {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (ta !== tb) return ta - tb;
    return a.id - b.id;
  }

  function isValidMessage(m) {
    return m && typeof m.id === 'number' && typeof m.username === 'string' &&
      typeof m.comment === 'string' && typeof m.createdAt === 'string';
  }

  function buildItem(m) {
    const li = document.createElement('li');
    li.dataset.id = String(m.id);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.username;
    const time = document.createElement('time');
    time.dateTime = m.createdAt;
    time.textContent = new Date(m.createdAt).toLocaleString('ja-JP');
    meta.appendChild(name);
    meta.appendChild(time);
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = m.comment;
    li.appendChild(meta);
    li.appendChild(body);
    return li;
  }

  function renderAll() {
    listEl.textContent = '';
    if (messages.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'まだ投稿がありません';
      listEl.appendChild(li);
      return;
    }
    messages.forEach((m) => listEl.appendChild(buildItem(m)));
    listEl.scrollTop = listEl.scrollHeight;
  }

  /** 履歴とバッファを投稿IDで統合して描き直す */
  function replaceAll(list) {
    messages = [];
    shownIds.clear();
    list.filter(isValidMessage).forEach((m) => {
      if (shownIds.has(m.id)) return;
      shownIds.add(m.id);
      messages.push(m);
    });
    messages.sort(compare);
    renderAll();
  }

  /** 新着を1件追加（表示済みIDは無視） */
  function addMessage(m) {
    if (!isValidMessage(m) || shownIds.has(m.id)) return;
    shownIds.add(m.id);
    const last = messages[messages.length - 1];
    messages.push(m);
    if (last && compare(last, m) > 0) {
      messages.sort(compare);
      renderAll();
      return;
    }
    if (messages.length === 1) {
      listEl.textContent = '';
    }
    const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
    listEl.appendChild(buildItem(m));
    if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  // Socket.IO の接続。リスナーはここで1回だけ登録する（再接続でも増えない）
  const socket = io({ reconnection: true });

  function join() {
    if (joining || !socket.connected) return;
    joining = true;
    joined = false;
    buffered = [];
    updateSendState();
    setStatus('入室しています…');

    socket.timeout(ACK_TIMEOUT_MS).emit('chat:join', (err, res) => {
      joining = false;
      if (err) {
        showError('入室の応答がありませんでした。再試行してください。');
        return;
      }
      if (!res || res.ok !== true) {
        if (res && res.code === 'ROOM_FULL') {
          joined = false;
          listEl.textContent = '';
          messages = [];
          shownIds.clear();
          fullMessageEl.textContent = res.message || '満席です。しばらくしてから再試行してください。';
          showOnly('full');
          setStatus('満席のため入室できません', 'warn');
          updateSendState();
          return;
        }
        showError((res && res.message) || '入室できませんでした。再試行してください。');
        return;
      }
      joined = true;
      const history = Array.isArray(res.messages) ? res.messages : [];
      replaceAll(history.concat(buffered));
      buffered = [];
      showOnly('room');
      setStatus(`入室中（${res.occupied} / ${res.capacity} 人）`, 'ok');
      updateSendState();
    });
  }

  function showError(text) {
    joined = false;
    errorTextEl.textContent = text;
    showOnly('error');
    setStatus('エラーが発生しました', 'error');
    updateSendState();
  }

  socket.on('connect', () => {
    join();
  });

  socket.on('disconnect', () => {
    joined = false;
    joining = false;
    sending = false;
    setStatus('接続が切れました。再接続しています…', 'warn');
    updateSendState();
  });

  socket.on('connect_error', () => {
    setStatus('サーバーに接続できません。自動で再試行しています…', 'error');
    updateSendState();
  });

  socket.on('chat:message', (m) => {
    if (joining) {
      buffered.push(m);
      return;
    }
    if (!joined) return;
    addMessage(m);
  });

  document.getElementById('full-retry').addEventListener('click', join);
  document.getElementById('error-retry').addEventListener('click', join);

  commentEl.addEventListener('input', () => {
    counterEl.textContent = `${Array.from(commentEl.value).length} / ${COMMENT_MAX}`;
  });

  function clientValidate(username, comment) {
    const u = Array.from(username.trim()).length;
    const c = Array.from(comment.trim()).length;
    if (u === 0) return 'ユーザー名を入力してください';
    if (u > USERNAME_MAX) return `ユーザー名は${USERNAME_MAX}文字以内で入力してください`;
    if (c === 0) return 'コメントを入力してください';
    if (c > COMMENT_MAX) return `コメントは${COMMENT_MAX}文字以内で入力してください`;
    return '';
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    formErrorEl.textContent = '';

    // 切断中に emit すると Socket.IO が溜めて再接続後に送ってしまうため、ここで止める
    if (!socket.connected || !joined) {
      formErrorEl.textContent = '接続・入室していないため送信できません。再接続をお待ちください。';
      return;
    }
    const username = usernameEl.value;
    const comment = commentEl.value;
    const problem = clientValidate(username, comment);
    if (problem) {
      formErrorEl.textContent = problem;
      return;
    }

    sending = true;
    updateSendState();
    socket.timeout(ACK_TIMEOUT_MS).emit('chat:send', { username, comment }, (err, res) => {
      sending = false;
      updateSendState();
      if (err) {
        formErrorEl.textContent = '保存できたか確認できません。一覧を確認してから再送してください。';
        return;
      }
      if (!res || res.ok !== true) {
        const details = res && Array.isArray(res.details)
          ? res.details.map((d) => d.issue).join(' / ')
          : '';
        formErrorEl.textContent = details || (res && res.message) || '送信できませんでした。';
        if (res && res.code === 'NOT_JOINED') join();
        return;
      }
      commentEl.value = '';
      counterEl.textContent = `0 / ${COMMENT_MAX}`;
      // 一覧への追加は chat:message の受信時に行う（二重表示を防ぐ）
    });
  });
})();
