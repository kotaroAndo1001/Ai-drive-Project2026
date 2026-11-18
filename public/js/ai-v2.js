const conversationsEl = document.getElementById('conversations');
const historyEl = document.getElementById('history');
const currentTitleEl = document.getElementById('current-title');
const statusEl = document.getElementById('status');
const newForm = document.getElementById('new-form');
const titleEl = document.getElementById('title');
const newBtn = document.getElementById('new-btn');
const askForm = document.getElementById('ask-form');
const promptEl = document.getElementById('prompt');
const askBtn = document.getElementById('ask-btn');

let selectedId = null;
let busy = false;

function codePointLength(text) {
  return Array.from(text).length;
}

function setBusy(next) {
  busy = next;
  newBtn.disabled = next;
  titleEl.disabled = next;
  promptEl.disabled = next || selectedId === null;
  askBtn.disabled = next || selectedId === null;
}

function showError(message) {
  statusEl.textContent = message || '';
}

function renderConversations(items) {
  conversationsEl.textContent = '';
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '会話がありません';
    conversationsEl.appendChild(p);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'conv' + (item.id === selectedId ? ' active' : '');
    row.textContent = item.title;
    row.addEventListener('click', () => {
      if (busy) return;
      selectConversation(item.id, item.title);
    });
    conversationsEl.appendChild(row);
  });
}

function renderTurns(items) {
  historyEl.textContent = '';
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '履歴がありません';
    historyEl.appendChild(p);
    return;
  }

  items.forEach((item) => {
    const box = document.createElement('div');
    box.className = 'item';
    const q = document.createElement('p');
    q.textContent = 'Q: ' + item.prompt;
    const a = document.createElement('p');
    a.textContent = 'A: ' + item.response;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = item.createdAt;
    box.appendChild(q);
    box.appendChild(a);
    box.appendChild(meta);
    historyEl.appendChild(box);
  });
}

async function loadConversations() {
  showError('');
  setBusy(true);
  try {
    const res = await fetch('/api/ai/v2/conversations');
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success !== true) {
      throw new Error(json?.message || '会話一覧の取得に失敗しました');
    }
    renderConversations(json.items || []);
  } catch (err) {
    conversationsEl.textContent = '';
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = err.message || '会話一覧の取得に失敗しました';
    conversationsEl.appendChild(p);
  } finally {
    setBusy(false);
  }
}

async function selectConversation(id, title) {
  selectedId = id;
  currentTitleEl.textContent = title || ('会話 #' + id);
  showError('');
  setBusy(true);
  try {
    const res = await fetch('/api/ai/v2/conversations/' + id + '/turns');
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success !== true) {
      throw new Error(json?.message || '履歴の取得に失敗しました');
    }
    renderTurns(json.items || []);
    await loadConversations();
  } catch (err) {
    renderTurns([]);
    showError(err.message || '履歴の取得に失敗しました');
  } finally {
    setBusy(false);
  }
}

newForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const title = titleEl.value.trim();
  if (codePointLength(title) < 1 || codePointLength(title) > 50) {
    showError('会話名は1〜50文字で入力してください');
    return;
  }
  setBusy(true);
  try {
    const res = await fetch('/api/ai/v2/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success !== true) {
      throw new Error(json?.message || '会話の作成に失敗しました');
    }
    titleEl.value = '';
    await loadConversations();
    await selectConversation(json.item.id, json.item.title);
  } catch (err) {
    showError(err.message || '会話の作成に失敗しました');
    setBusy(false);
  }
});

askForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  if (selectedId === null) {
    showError('会話を選択してください');
    return;
  }
  const prompt = promptEl.value.trim();
  if (codePointLength(prompt) < 1 || codePointLength(prompt) > 2000) {
    showError('質問は1〜2000文字で入力してください');
    return;
  }

  setBusy(true);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const res = await fetch('/api/ai/v2/conversations/' + selectedId + '/turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success !== true) {
      throw new Error(json?.message || '送信に失敗しました');
    }
    promptEl.value = '';
    await selectConversation(selectedId, currentTitleEl.textContent);
  } catch (err) {
    showError(
      err.name === 'AbortError'
        ? '待機時間を超えました。質問は残しています。'
        : err.message || '送信に失敗しました'
    );
  } finally {
    setBusy(false);
  }
});

loadConversations();
