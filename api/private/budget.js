// 가계부 클라우드 동기화.
//   GET  → 저장된 기록을 돌려줘요.
//   POST → 기기의 기록을 받아 클라우드 기록과 합친 뒤 저장하고, 합친 결과를 돌려줘요.
// 합치는 규칙: 같은 id면 updated(수정 시각)가 더 최근인 쪽이 이겨요. 지운 기록은 deleted 표시로 남겨서
// 다른 기기에서 되살아나지 않게 해요.
import { isAuthed } from '../../lib/private-session.js';
import { getJson, setJson, storeConfigured } from '../../lib/private-store.js';

const KEY = 'private:budget:v1';
const empty = () => ({ items: [], budget: 0, budgetUpdated: 0 });

export function merge(a, b) {
  const byId = new Map();
  for (const it of [...(a.items || []), ...(b.items || [])]) {
    if (!it || typeof it.id !== 'string') continue;
    const prev = byId.get(it.id);
    if (!prev || (it.updated || 0) > (prev.updated || 0)) byId.set(it.id, it);
  }
  const aNewer = (a.budgetUpdated || 0) >= (b.budgetUpdated || 0);
  return {
    items: [...byId.values()],
    budget: aNewer ? +a.budget || 0 : +b.budget || 0,
    budgetUpdated: Math.max(a.budgetUpdated || 0, b.budgetUpdated || 0),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await isAuthed(req))) { res.statusCode = 401; return res.json({ error: 'login_required' }); }
  if (!storeConfigured()) { res.statusCode = 503; return res.json({ error: 'storage_not_configured' }); }

  try {
    const saved = (await getJson(KEY)) || empty();
    if (req.method === 'GET') return res.json(saved);
    if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!Array.isArray(body.items)) { res.statusCode = 400; return res.json({ error: 'bad_request' }); }
    const merged = merge(saved, body);
    await setJson(KEY, merged);
    return res.json(merged);
  } catch (e) {
    console.error('budget sync error', e && e.message);
    res.statusCode = 500;
    return res.json({ error: 'server_error' });
  }
}
