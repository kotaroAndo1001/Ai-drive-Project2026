const historyEl = document.getElementById('history');
const formEl = document.getElementById('ask-form');
const promptEl = document.getElementById('prompt');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');

function setBusy(busy) {
  submitBtn.disabled = busy;
  promptEl.disabled = busy;
}

function renderHistory(items) {
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

async function loadHistory() {
  statusEl.textContent = '';
  setBusy(true);
  try {
    const res = await fetch('/api/ai/history');
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success !== true) {
      throw new Error(json?.message || '履歴の取得に失敗しました');
    }
    renderHistory(json.items || []);
  } catch (err) {
    historyEl.textContent = '';
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = err.message || '履歴の取得に失敗しました';
    historyEl.appendChild(p);
  } finally {
    setBusy(false);
  }
}

function codePointLength(text) {
  return Array.from(text).length;
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = '';
  const prompt = promptEl.value.trim();
  const length = codePointLength(prompt);
  if (length < 1 || length > 2000) {
    statusEl.textContent = '質問は1〜2000文字で入力してください';
    return;
  }

  setBusy(true);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const res = await fetch('/api/ai/ask', {
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
    await loadHistory();
  } catch (err) {
    statusEl.textContent =
      err.name === 'AbortError'
        ? '待機時間を超えました。質問は残しています。'
        : err.message || '送信に失敗しました';
  } finally {
    setBusy(false);
  }
});

loadHistory();
