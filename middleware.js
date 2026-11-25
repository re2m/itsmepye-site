// /private 아래 페이지는 로그인한 사람(나)만 볼 수 있게 막아요.
// 로그인하지 않았으면 /private/login/ 으로 보내요. 비밀번호는 Vercel 환경 변수 PRIVATE_PASSWORD 예요.
import { COOKIE, configuredPassword, readCookie, verifyToken } from './lib/private-session.js';

export const config = {
  matcher: ['/private', '/private/:path*'],
};

const text = (body, status) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default async function middleware(request) {
  const url = new URL(request.url);

  // 로그인 화면은 누구나 볼 수 있어야 해요.
  if (url.pathname === '/private/login' || url.pathname.startsWith('/private/login/')) return;

  const secret = configuredPassword();
  // 비밀번호가 설정되지 않았으면 열어두지 않고 막아요.
  if (!secret) return text('비공개 페이지 비밀번호가 아직 설정되지 않았어요.', 503);

  const token = readCookie(request.headers.get('cookie'), COOKIE);
  if (await verifyToken(token, secret)) return; // 통과 → 원래 페이지로

  const login = new URL('/private/login/', url);
  login.searchParams.set('next', url.pathname + url.search);
  return new Response(null, { status: 302, headers: { Location: login.toString(), 'Cache-Control': 'no-store' } });
}
