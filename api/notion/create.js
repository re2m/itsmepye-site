// 앱이 보낸 결과(spec)로 사용자가 허용한 노션 페이지 아래에 페이지 1개 + 데이터베이스들을 만들어요.
// 접근 토큰은 쿠키에서 읽고, 끝나면 바로 지워요. 서버에는 아무것도 저장하지 않아요.
const NV = '2022-06-28';
const LIMITS = { dbs: 6, rows: 300, cols: 20, text: 1900, intro: 20 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clip = (s, n = LIMITS.text) => String(s ?? '').slice(0, n);
const rt = s => [{ type: 'text', text: { content: clip(s) } }];
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const SELECT_COLORS = ['orange', 'blue', 'green', 'purple', 'pink', 'yellow', 'red', 'brown', 'gray'];

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

// spec 스키마 → 노션 속성 정의
function propDef(type, opts) {
  switch (type) {
    case 'title': return { title: {} };
    case 'number': return { number: { format: 'number' } };
    case 'checkbox': return { checkbox: {} };
    case 'date': return { date: {} };
    case 'select': return { select: { options: (opts || []).slice(0, 30).map((name, i) => ({ name: clip(name, 100).replace(/,/g, ' '), color: SELECT_COLORS[i % SELECT_COLORS.length] })) } };
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
    case 'select': return { select: { name: clip(v, 100).replace(/,/g, ' ') } };
    default: return { rich_text: rt(v) };
  }
}

function validate(spec) {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.dbs)) return 'bad_spec';
  if (spec.dbs.length === 0 || spec.dbs.length > LIMITS.dbs) return 'bad_spec';
  let rows = 0;
  for (const db of spec.dbs) {
    if (!db || !Array.isArray(db.cols) || !Array.isArray(db.rows)) return 'bad_spec';
    if (db.cols.length === 0 || db.cols.length > LIMITS.cols) return 'bad_spec';
    if (db.cols.filter(c => c.type === 'title').length !== 1) return 'bad_spec';
    const names = new Set(db.cols.map(c => c.name));
    if (names.size !== db.cols.length || [...names].some(n => !n || String(n).length > 100)) return 'bad_spec';
    if (db.relation && [db.relation.name, db.relation.back, db.relation.rollup && db.relation.rollup.name].some(n => n && names.has(n))) return 'bad_spec';
    rows += db.rows.length;
  }
  if (rows > LIMITS.rows) return 'too_big';
  return null;
}

// 같은 DB 안에서 줄끼리 잇는 관계 속성(상위 목표 ↔ 하위 항목)과 진행률(롤업)을 추가해요.
// 실패해도 DB 자체는 쓸 수 있으니 관계 없이 계속 진행해요.
async function addSelfRelation(token, dbId, rel) {
  try {
    const upd = await notion(token, '/databases/' + dbId, {
      properties: { [rel.name]: { relation: { database_id: dbId, type: 'dual_property', dual_property: {} } } },
    }, 'PATCH');
    const props = upd.properties || {};
    const back = Object.keys(props).find(k => k !== rel.name && props[k].type === 'relation'
      && String(props[k].relation && props[k].relation.database_id).replace(/-/g, '') === dbId.replace(/-/g, ''));
    let backName = back;
    if (back && rel.back && back !== rel.back) {
      await notion(token, '/databases/' + dbId, { properties: { [back]: { name: rel.back } } }, 'PATCH');
      backName = rel.back;
    }
    if (backName && rel.rollup) {
      try {
        await notion(token, '/databases/' + dbId, { properties: { [rel.rollup.name]: { rollup: {
          relation_property_name: backName, rollup_property_name: rel.rollup.of, function: rel.rollup.fn || 'percent_checked' } } } }, 'PATCH');
      } catch (e) { console.error('rollup failed', e.message); }
    }
    return true;
  } catch (e) {
    console.error('dual relation failed, trying single', e.message);
    try {
      await notion(token, '/databases/' + dbId, {
        properties: { [rel.name]: { relation: { database_id: dbId, type: 'single_property', single_property: {} } } },
      }, 'PATCH');
      return true;
    } catch (e2) { console.error('relation failed', e2.message); return false; }
  }
}

// 동시에 3개씩 행을 만들어요 (노션 속도 제한: 초당 약 3회)
async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k]); await sleep(300); }
  });
  await Promise.all(workers);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const token = parseCookies(req.headers.cookie).ntk;
  if (!token) return send(res, 401, { error: 'no_token' });

  let spec = req.body;
  if (typeof spec === 'string') { try { spec = JSON.parse(spec); } catch { spec = null; } }
  const bad = validate(spec);
  if (bad) return send(res, 400, { error: bad });

  try {
    // 1) 사용자가 허용한 페이지 찾기
    const found = await notion(token, '/search', { filter: { property: 'object', value: 'page' }, page_size: 20 });
    const pages = (found.results || []).filter(p => !p.archived && !p.in_trash);
    const parent = pages.find(p => p.parent && p.parent.type === 'workspace') || pages[0];
    if (!parent) return send(res, 400, { error: 'no_page' });

    // 2) 담을 페이지 만들기
    const intro = (spec.intro || []).slice(0, LIMITS.intro).map(t => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(t) } }));
    const page = await notion(token, '/pages', {
      parent: { page_id: parent.id },
      icon: { type: 'emoji', emoji: '🎯' },
      properties: { title: { title: rt(clip(spec.title || '나의 목표 시스템', 200)) } },
      children: intro,
    });

    // 3) 데이터베이스 만들기 → 4) 행 채우기
    for (const db of spec.dbs) {
      const properties = {};
      for (const c of db.cols) properties[c.name] = propDef(c.type, c.options);
      const made = await notion(token, '/databases', {
        parent: { type: 'page_id', page_id: page.id },
        is_inline: true,
        title: rt(clip(db.title || '데이터베이스', 200)),
        properties,
      });
      const rel = db.relation && db.relation.name ? db.relation : null;
      const linked = rel ? await addSelfRelation(token, made.id, rel) : false;
      const ids = {};
      const makeRow = async row => {
        const props = {};
        for (const c of db.cols) { const v = propVal(c.type, row[c.name]); if (v) props[c.name] = v; }
        if (linked && row._parent && ids[row._parent]) props[rel.name] = { relation: [{ id: ids[row._parent] }] };
        const p = await notion(token, '/pages', { parent: { database_id: made.id }, properties: props });
        if (row._key) ids[row._key] = p.id;
      };
      // 상위 줄(목표)을 먼저 순서대로 만들고, 나머지는 행이 많으면 3개씩 동시에 만들어요 (날짜 열로 정렬 가능)
      const heads = db.rows.filter(r => r._key), rest = db.rows.filter(r => !r._key);
      await pool(heads, 1, makeRow);
      await pool(rest, rest.length > 12 ? 3 : 1, makeRow);
    }
    return send(res, 200, { url: page.url });
  } catch (e) {
    console.error('notion create failed', e.status, e.code, e.message);
    if (e.status === 401) return send(res, 401, { error: 'no_token' });
    return send(res, 502, { error: 'notion', detail: clip(e.message, 200) });
  }
}
