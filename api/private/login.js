// 비밀번호를 확인하고 30일짜리 로그인 쿠키를 줘요.
import { configuredPassword, makeToken, normalizePassword, safeEqual, sessionCookie } from '../../lib/private-session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

  const secret = configuredPassword();
  if (!secret) { res.statusCode = 503; return res.json({ error: 'not_configured' }); }

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const ok = await safeEqual(normalizePassword(body.password), secret);
  if (!ok) {
    await new Promise(r => setTimeout(r, 800)); // 마구 대입하기 어렵게 조금 늦게 답해요.
    res.statusCode = 401;
    return res.json({ error: 'wrong_password' });
  }
  res.setHeader('Set-Cookie', sessionCookie(await makeToken(secret)));
  return res.json({ ok: true });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
