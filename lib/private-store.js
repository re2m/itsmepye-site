// 가계부 기록을 Upstash Redis(Vercel Storage에서 연결)에 저장해요. 별도 패키지 없이 REST API로 호출해요.
// Vercel에서 Upstash를 프로젝트에 연결하면 아래 환경 변수가 자동으로 들어와요.

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeConfigured = () => Boolean(url() && token());

async function redis(command) {
  const r = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`redis ${r.status} ${j.error || ''}`);
  return j.result;
}

export async function getJson(key) {
  const v = await redis(['GET', key]);
  return v ? JSON.parse(v) : null;
}

export async function setJson(key, value) {
  await redis(['SET', key, JSON.stringify(value)]);
}
