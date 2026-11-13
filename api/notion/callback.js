// 노션이 돌려준 code를 접근 토큰으로 바꿔요.
// 토큰은 서버에 저장하지 않고 10분짜리 보안 쿠키에만 담아요. DB를 만들면 바로 지워요.
const back = (res, status, cookies = []) => {
  res.statusCode = 302;
  res.setHeader('Set-Cookie', ['nst=; Path=/api/notion; Max-Age=0; HttpOnly; Secure; SameSite=Lax', ...cookies]);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', `/things/goal/?notion=${status}`);
  res.end();
};

export default async function handler(req, res) {
  const { NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, NOTION_REDIRECT_URI } = process.env;
  const q = new URL(req.url, 'https://www.itsmepye.site').searchParams;
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

  if (q.get('error')) return back(res, 'denied');
  const code = q.get('code');
  const state = q.get('state');
  if (!code || !state || !cookies.nst || cookies.nst !== state) return back(res, 'expired');
  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET || !NOTION_REDIRECT_URI) return back(res, 'error');

  try {
    const r = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: NOTION_REDIRECT_URI }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      console.error('notion token exchange failed', r.status, j.error || '');
      return back(res, 'error');
    }
    return back(res, 'ready', [`ntk=${encodeURIComponent(j.access_token)}; Path=/api/notion; Max-Age=600; HttpOnly; Secure; SameSite=Lax`]);
  } catch (e) {
    console.error('notion token exchange error', e && e.message);
    return back(res, 'error');
  }
}
