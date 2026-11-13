// 노션 로그인(권한 허용) 화면으로 보내요.
// 위조 요청을 막기 위해 무작위 state 값을 10분짜리 보안 쿠키에 담아 두고, callback에서 확인해요.
import { randomBytes } from 'node:crypto';

export default function handler(req, res) {
  const { NOTION_CLIENT_ID, NOTION_REDIRECT_URI } = process.env;
  if (!NOTION_CLIENT_ID || !NOTION_REDIRECT_URI) {
    res.statusCode = 302;
    res.setHeader('Location', '/things/goal/?notion=error');
    return res.end();
  }
  const state = randomBytes(16).toString('hex');
  const url = new URL('https://api.notion.com/v1/oauth/authorize');
  url.searchParams.set('client_id', NOTION_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('owner', 'user');
  url.searchParams.set('redirect_uri', NOTION_REDIRECT_URI);
  url.searchParams.set('state', state);

  res.setHeader('Set-Cookie', `nst=${state}; Path=/api/notion; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.end();
}
