// 로그인 쿠키를 지우고 로그인 화면으로 보내요.
import { clearCookie } from '../../lib/private-session.js';

export default function handler(req, res) {
  res.statusCode = 302;
  res.setHeader('Set-Cookie', clearCookie());
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', '/private/login/');
  res.end();
}
