class TodoApi {
  async list() {
    const res = await fetch('/api/v1/todos');
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.status !== 'success') {
      throw new Error(json?.message || '一覧の取得に失敗しました');
    }
    return json.data;
  }

  async create(title) {
    const res = await fetch('/api/v1/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.status !== 'success') {
      throw new Error(json?.message || '登録に失敗しました');
    }
    return json.data;
  }

  async updateDone(id, isDone) {
    const res = await fetch(`/api/v1/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.status !== 'success') {
      throw new Error(json?.message || '更新に失敗しました');
    }
    return json.data;
  }

  async remove(id) {
    const res = await fetch(`/api/v1/todos/${id}`, {
      method: 'DELETE',
    });
    if (res.status === 204) {
      return true;
    }
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || '削除に失敗しました');
  }
}
