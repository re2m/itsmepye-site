// /private 아래 페이지는 비밀번호를 아는 사람(나)만 볼 수 있게 막아요.
// 브라우저 기본 로그인 창(HTTP Basic 인증)을 띄우고, Vercel 환경 변수에 저장한 값과 비교해요.
//   PRIVATE_USER      아이디 (없으면 아이디는 아무거나 입력해도 돼요)
//   PRIVATE_PASSWORD  비밀번호 (필수 — 없으면 아무도 들어갈 수 없어요)

export const config = {
  matcher: ['/private', '/private/:path*'],
};

const REALM = 'Private';

function unauthorized() {
  return new Response('로그인이 필요해요.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// 길이가 달라도 비교 시간이 일정하도록 해시끼리 비교해요.
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export default async function middleware(request) {
  const { PRIVATE_USER = '', PRIVATE_PASSWORD } = process.env;

  // 비밀번호가 설정되지 않았으면 열어두지 않고 막아요.
  if (!PRIVATE_PASSWORD) {
    return new Response('비공개 페이지 비밀번호가 아직 설정되지 않았어요.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) return unauthorized();

  let decoded;
  try {
    const bytes = Uint8Array.from(atob(auth.slice(6)), c => c.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return unauthorized();
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return unauthorized();
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  const passOk = await safeEqual(pass, PRIVATE_PASSWORD);
  const userOk = PRIVATE_USER ? await safeEqual(user, PRIVATE_USER) : true;
  if (!(passOk && userOk)) return unauthorized();

  // 통과하면 아무것도 반환하지 않아 원래 페이지로 이어져요.
}
