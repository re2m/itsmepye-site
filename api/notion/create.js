// 앱이 보낸 설계(spec)대로, 사용자가 허용한 노션 페이지 아래에 페이지 1개와
// 서로 관계로 이어진 데이터베이스들(목표 · KPI · 액션 플랜 · 습관 · 데일리 체크 · 회고)을 만들어요.
// 접근 토큰은 쿠키에서 읽고, 끝나면 바로 지워요. 서버에는 아무것도 저장하지 않아요.
const NV = '2022-06-28';
const LIMITS = { dbs: 8, rows: 300, cols: 20, links: 12, rollups: 8, text: 1900, intro: 20 };
const TIME_BUDGET = 48000; // 줄 만들기를 멈출 시점(ms). 한 번에 최대 3개 요청이 끝나길 기다려도 60초 안에 들어와요.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clip = (s, n = LIMITS.text) => String(s ?? '').slice(0, n);
const rt = s => [{ type: 'text', text: { content: clip(s) } }];
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const optName = s => clip(s, 100).replace(/,/g, ' ');
const COLORS = ['orange', 'blue', 'green', 'purple', 'pink', 'yellow', 'red', 'brown', 'gray'];
const ROLLUP_FNS = new Set(['percent_checked', 'checked', 'count', 'sum', 'average', 'max', 'min', 'percent_not_empty']);

function parseCookies(h) {
  return Object.fromEntries((h || '').split(';').map(s => s.trim().split('=')).filter(p => p[0])
    .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', 'ntk=; Path=/api/notion; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.end(JSON.stringify(body));
}

async function notion(token, path, body, method = 'POST') {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://api.notion.com/v1' + path, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': NV, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 || r.status >= 500) {
      const wait = Number(r.headers.get('retry-after')) || (attempt + 1);
      await sleep(Math.min(wait, 5) * 1000);
      continue;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || `notion ${r.status}`); e.status = r.status; e.code = j.code; throw e; }
    return j;
  }
  const e = new Error('notion busy'); e.status = 429; throw e;
}

// spec 열 종류 → 노션 속성 정의
function propDef(type, opts) {
  const options = () => (opts || []).slice(0, 30).map((name, i) => ({ name: optName(name), color: COLORS[i % COLORS.length] }));
  switch (type) {
    case 'title': return { title: {} };
    case 'number': return { number: { format: 'number' } };
    case 'checkbox': return { checkbox: {} };
    case 'date': return { date: {} };
    case 'select': return { select: { options: options() } };
    case 'multi_select': return { multi_select: { options: options() } };
    default: return { rich_text: {} };
  }
}
// 값 → 노션 속성 값
function propVal(type, v) {
  if (v === undefined || v === null || v === '') return null;
  switch (type) {
    case 'title': return { title: rt(v) };
    case 'number': { const n = Number(v); return Number.isFinite(n) ? { number: n } : null; }
    case 'checkbox': return { checkbox: !!v };
    case 'date':
      if (isDate(v)) return { date: { start: v } };
      if (v && isDate(v.start)) return { date: isDate(v.end) && v.end > v.start ? { start: v.start, end: v.end } : { start: v.start } };
      return null;
    case 'select': return { select: { name: optName(v) } };
    case 'multi_select': return Array.isArray(v) && v.length ? { multi_select: v.slice(0, 30).map(n => ({ name: optName(n) })) } : null;
    default: return { rich_text: rt(v) };
  }
}

function validate(spec) {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.dbs)) return 'bad_spec';
  if (spec.dbs.length === 0 || spec.dbs.length > LIMITS.dbs) return 'bad_spec';
  const links = spec.links || [], rollups = spec.rollups || [];
  if (!Array.isArray(links) || !Array.isArray(rollups) || links.length > LIMITS.links || rollups.length > LIMITS.rollups) return 'bad_spec';
  const keys = new Set(), names = {};
  let rows = 0;
  for (const db of spec.dbs) {
    if (!db || !db.key || keys.has(db.key) || !Array.isArray(db.cols) || !Array.isArray(db.rows)) return 'bad_spec';
    if (db.cols.length === 0 || db.cols.length > LIMITS.cols) return 'bad_spec';
    if (db.cols.filter(c => c.type === 'title').length !== 1) return 'bad_spec';
    const set = new Set(db.cols.map(c => c.name));
    if (set.size !== db.cols.length || [...set].some(n => !n || String(n).length > 100)) return 'bad_spec';
    keys.add(db.key); names[db.key] = set;
    rows += db.rows.length;
  }
  if (rows > LIMITS.rows) return 'too_big';
  // 관계 속성 이름이 기존 열과 겹치지 않아야 해요
  for (const l of links) {
    if (!keys.has(l.from) || !keys.has(l.to) || l.from === l.to || !l.name || !l.back) return 'bad_spec';
    if (names[l.from].has(l.name) || names[l.to].has(l.back)) return 'bad_spec';
    names[l.from].add(l.name); names[l.to].add(l.back);
  }
  for (const r of rollups) {
    if (!keys.has(r.db) || !r.name || !r.rel || !r.of || !ROLLUP_FNS.has(r.fn) || names[r.db].has(r.name)) return 'bad_spec';
    names[r.db].add(r.name);
  }
  return null;
}

// 검색 결과(하위 페이지·DB 줄일 수 있어요)에서 부모를 따라 올라가, 접근할 수 있는 가장 위 페이지를 찾아요.
// 앱은 사용자가 허용한 페이지와 그 하위만 볼 수 있으니, 더 못 올라가는 곳이 바로 허용한 페이지예요.
async function topPage(token, start) {
  let cur = start, best = start;
  for (let hop = 0; hop < 12; hop++) {
    const p = cur.parent || {};
    const path = p.type === 'page_id' ? '/pages/' + p.page_id
      : p.type === 'database_id' ? '/databases/' + p.database_id
      : p.type === 'block_id' ? '/blocks/' + p.block_id : null;
    if (!path) break;                         // workspace 등: 더 위가 없어요
    try { cur = await notion(token, path, null, 'GET'); } catch { break; }  // 권한 밖이면 멈춰요
    if (cur.object === 'page' && !cur.archived && !cur.in_trash) best = cur;
  }
  return best;
}

// 동시에 n개씩 처리해요 (노션 속도 제한: 초당 약 3회)
async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k]); await sleep(300); }
  });
  await Promise.all(workers);
}

export default async function handler(req, res) {
  const started = Date.now();
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const token = parseCookies(req.headers.cookie).ntk;
  if (!token) return send(res, 401, { error: 'no_token' });

  let spec = req.body;
  if (typeof spec === 'string') { try { spec = JSON.parse(spec); } catch { spec = null; } }
  const bad = validate(spec);
  if (bad) return send(res, 400, { error: bad });

  try {
    // 1) 사용자가 허용한 페이지 찾기
    // 검색 결과에는 허용한 페이지의 하위 페이지·DB 줄도 섞여 나와요. 그래서 가장 위에 있는 페이지를 골라요.
    const found = await notion(token, '/search', { filter: { property: 'object', value: 'page' }, page_size: 100 });
    const pages = (found.results || []).filter(p => !p.archived && !p.in_trash);
    const ids = new Set(pages.map(p => p.id));
    const first = pages.find(p => p.parent && p.parent.type === 'workspace')
      || pages.find(p => p.parent && p.parent.type === 'page_id' && !ids.has(p.parent.page_id))
      || pages[0];
    const parent = first && await topPage(token, first);
    if (!parent) return send(res, 400, { error: 'no_page' });

    // 2) 담을 페이지 만들기
    const intro = (spec.intro || []).slice(0, LIMITS.intro).map(t => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(t) } }));
    const page = await notion(token, '/pages', {
      parent: { page_id: parent.id },
      icon: { type: 'emoji', emoji: '🎯' },
      properties: { title: { title: rt(clip(spec.title || '나의 목표 시스템', 200)) } },
      children: intro,
    });

    // 3) 데이터베이스 만들기 (페이지 안에 순서대로 놓여요)
    const dbId = {};
    for (const db of spec.dbs) {
      const properties = {};
      for (const c of db.cols) properties[c.name] = propDef(c.type, c.options);
      const made = await notion(token, '/databases', {
        parent: { type: 'page_id', page_id: page.id }, is_inline: true,
        title: rt(clip(db.title || '데이터베이스', 200)), properties,
      });
      dbId[db.key] = made.id;
    }

    // 4) 데이터베이스끼리 관계 잇기 (양방향) → 반대쪽에 생긴 속성 이름 바꾸기
    const linked = new Set();
    for (const l of spec.links || []) {
      try {
        const upd = await notion(token, '/databases/' + dbId[l.from], {
          properties: { [l.name]: { relation: { database_id: dbId[l.to], type: 'dual_property', dual_property: {} } } },
        }, 'PATCH');
        const dual = upd.properties && upd.properties[l.name] && upd.properties[l.name].relation && upd.properties[l.name].relation.dual_property;
        const syncedKey = dual && (dual.synced_property_id || dual.synced_property_name);
        if (syncedKey) {
          await notion(token, '/databases/' + dbId[l.to], { properties: { [syncedKey]: { name: l.back } } }, 'PATCH')
            .catch(e => console.error('rename failed', l.back, e.message));
        }
        linked.add(l.from + '.' + l.name);
      } catch (e) { console.error('link failed', l.from, l.name, e.message); }
    }

    // 5) 롤업(진행률 등) 추가 — 실패해도 계속해요
    for (const r of spec.rollups || []) {
      await notion(token, '/databases/' + dbId[r.db], { properties: { [r.name]: { rollup: {
        relation_property_name: r.rel, rollup_property_name: r.of, function: r.fn } } } }, 'PATCH')
        .catch(e => console.error('rollup failed', r.db, r.name, e.message));
    }

    // 6) 줄 채우기: 노션은 나중에 만든 줄이 위에 보여서, 거꾸로 만들어 원래 순서로 보이게 해요
    //    서버 시간 한도(60초)에 가까워지면 남은 줄은 건너뛰고, 만든 데까지 링크를 돌려줘요.
    const rowId = {};
    let partial = false;
    for (const db of spec.dbs) {
      const rows = db.rows.slice().reverse();
      await pool(rows, rows.length > 12 ? 3 : 1, async row => {
        if (Date.now() - started > TIME_BUDGET) { partial = true; return; }
        const props = {};
        for (const c of db.cols) { const v = propVal(c.type, row[c.name]); if (v) props[c.name] = v; }
        for (const [name, ref] of Object.entries(row._links || {})) {
          if (!linked.has(db.key + '.' + name)) continue;
          const ids = (Array.isArray(ref) ? ref : [ref]).map(k => rowId[k]).filter(Boolean);
          if (ids.length) props[name] = { relation: ids.slice(0, 50).map(id => ({ id })) };
        }
        const p = await notion(token, '/pages', { parent: { database_id: dbId[db.key] }, properties: props });
        if (row._id) rowId[row._id] = p.id;
      });
    }
    return send(res, 200, partial ? { url: page.url, partial: true } : { url: page.url });
  } catch (e) {
    console.error('notion create failed', e.status, e.code, e.message);
    if (e.status === 401) return send(res, 401, { error: 'no_token' });
    return send(res, 502, { error: 'notion', detail: clip(e.message, 200) });
  }
}
