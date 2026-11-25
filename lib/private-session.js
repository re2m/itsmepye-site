// /private 로그인 세션 도구. middleware(엣지)와 api 함수(Node) 양쪽에서 같이 써요.
// 세션 쿠키 값은 "만료시각.서명" 형태예요. 서명 키는 PRIVATE_PASSWORD에서 만들어서,
// 비밀번호를 바꾸면 기존 로그인이 모두 풀려요.

export const COOKIE = 'pv_session';
export const MAX_AGE = 60 * 60 * 24 * 30; // 30일

const enc = new TextEncoder();

// 입력 실수(앞뒤 공백, 한글 조합 방식 차이)로 틀리지 않도록 정리해요.
export const normalizePassword = s => String(s || '').normalize('NFC').trim();

export function configuredPassword() {
  return normalizePassword(process.env.PRIVATE_PASSWORD);
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode('pv-session:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return Array.from(sig, b => b.toString(16).padStart(2, '0')).join('');
}

// 길이가 달라도 비교 시간이 일정하도록 해시끼리 비교해요.
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function makeToken(secret) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${exp}.${await hmac(secret, exp)}`;
}

export async function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export function readCookie(cookieHeader, name = COOKIE) {
  for (const part of String(cookieHeader || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export const sessionCookie = token => `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

// api 함수에서 로그인 여부 확인
export async function isAuthed(req) {
  return verifyToken(readCookie(req.headers.cookie), configuredPassword());
}
